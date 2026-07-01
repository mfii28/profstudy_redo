from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.config import settings
from app.core.security import get_current_user, rate_limit
from app.models.models import Course, TutorDetail, Order, User
from app.api.v1.endpoints.rag import get_course_markdown_text
import google.generativeai as genai
import json
import urllib.parse
import re
import logging
from typing import Dict, Any, Optional
from datetime import datetime, date

logger = logging.getLogger(__name__)

router = APIRouter()

PERSONAS = {'Friendly', 'Strict', 'Beginner', 'Expert', 'Exam Coach'}

# ── Prompt injection detection ─────────────────────────────
PROMPT_INJECTION_PATTERNS = [
    r"(?i)(ignore|disregard|forget|override)\s+(all\s+)?(previous|above|below|instructions|prompts)",
    r"(?i)(you are (now|not) )|(act as if)|(pretend to be)|(new (instruction|rule))",
    r"(?i)(system prompt|system message|developer prompt)",
    r"(?i)(print|output|show|display)\s+(the\s+)?(above|system|prompt|instruction|text)",
    r"(?i)(forget|clear|reset|erase)\s+(context|history|memory|conversation)",
]

# ── Per-user daily cost tracker (in-memory) ────────────────
# Production: replace with Redis
_daily_usage: dict = {}  # {user_id + date: token_count}

def _check_daily_quota(user_id: str, max_tokens: int = 100_000) -> bool:
    """Check if user has exceeded daily AI token quota."""
    key = f"{user_id}:{date.today().isoformat()}"
    used = _daily_usage.get(key, 0)
    return used < max_tokens

def _record_usage(user_id: str, tokens: int):
    key = f"{user_id}:{date.today().isoformat()}"
    _daily_usage[key] = _daily_usage.get(key, 0) + tokens

def _detect_prompt_injection(text: str) -> bool:
    """Basic prompt injection detection."""
    for pattern in PROMPT_INJECTION_PATTERNS:
        if re.search(pattern, text):
            return True
    return False

def _sanitize_output(text: str) -> str:
    """Remove potential XSS vectors from AI output."""
    # Strip HTML tags since output may contain user-controlled data
    text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.DOTALL)
    text = re.sub(r'<[^>]*onerror=[^>]*>', '', text)
    return text

def build_tutor_system_instruction(persona: str) -> str:
    return f"""You are a professional AI tutor for the Profs Training Solutions platform.
Answer STRICTLY from the source material provided in the user message. Do not invent facts.

### YOUR PERSONA: {persona}
- Friendly: Warm, supportive, simple language, use emojis.
- Strict: Formal, rigorous, precise.
- Beginner: Patient, analogies, explains all jargon.
- Expert: Highly technical, industry-standard terminology.
- Exam Coach: Exam strategy, ICAG/CITG marking keywords, time management.

### CONSTRAINTS
- Use ONLY the source material provided below.
- If the answer is not found, say: "This isn't covered in your course materials."
- At the end of your answer, briefly mention which document(s) you used (e.g., "— Source: Chapter 3 Notes.pdf")."""

def build_tutor_user_content(question: str, context_text: Optional[str], lesson_outline: Optional[str]) -> str:
    if context_text and context_text.strip():
        source_block = f"--- [Course materials (Combined), chunk 0] ---\n{context_text.strip()}"
    elif lesson_outline and lesson_outline.strip():
        source_block = lesson_outline.strip()
    else:
        source_block = "(No course materials or outline were provided.)"
        
    return f"""### SOURCE MATERIAL
{source_block}

### STUDENT QUESTION
{question}

Your answer:"""

@router.post("/ai-tutor-stream")
async def ai_tutor_stream(
    payload: Dict[str, Any],
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Streams Gemini chat responses for the AI Tutor RAG flow.
    """
    course_id = payload.get("courseId")
    question = payload.get("question", "").strip()[:2000]
    persona = payload.get("persona", "Friendly")
    lesson_outline = payload.get("lessonOutline", "")
    
    if not course_id or not question:
        raise HTTPException(status_code=404, detail="courseId and question are required.")
    
    # ── Prompt injection check ──
    if _detect_prompt_injection(question):
        logger.warning(f"[AI Tutor] Prompt injection blocked for user {uid}")
        raise HTTPException(status_code=400, detail="Question contains prohibited patterns.")
    
    # ── Daily quota check ──
    if not _check_daily_quota(uid):
        raise HTTPException(status_code=429, detail="Daily AI query limit reached.")
        
    if persona not in PERSONAS:
        persona = "Friendly"
        
    uid = current_user["id"]
    role = current_user.get("role", "student")
    
    # 1. Verify course existence
    course_result = await db.execute(select(Course).where(Course.id == course_id))
    course = course_result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")
        
    # 2. Verify enrollment or tutor/admin permissions
    is_staff = role in ['admin', 'superadmin', 'subadmin']
    tutor_result = await db.execute(select(TutorDetail).where(TutorDetail.userId == uid))
    tutor = tutor_result.scalar_one_or_none()
    is_owner = tutor is not None and course.tutorId == tutor.id
    
    has_access = is_staff or is_owner
    if not has_access:
        user_result = await db.execute(select(User).where(User.id == uid))
        user = user_result.scalar_one_or_none()
        if user:
            enrollments = user.enrollments or []
            has_access = any(e.get("courseId") == course_id for e in enrollments)
            
    if not has_access:
        raise HTTPException(status_code=403, detail="Permission denied.")
        
    # 3. Retrieve materials from R2
    try:
        materials_text = await get_course_markdown_text(course_id)
    except Exception as e:
        print(f"[AI Tutor Stream] Failed to read materials: {str(e)}")
        materials_text = ""
        
    # 4. Configure Gemini
    if not settings.GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="AI is not configured.")
        
    genai.configure(api_key=settings.GEMINI_API_KEY)
    
    system_instruction = build_tutor_system_instruction(persona)
    user_content = build_tutor_user_content(question, materials_text, lesson_outline)
    
    source_docs = ["Course materials (Combined)"] if materials_text else []
    meta_header = urllib.parse.quote(json.dumps(source_docs))
    
    def generate():
        token_count = 0
        try:
            model = genai.GenerativeModel(
                model_name="gemini-2.5-flash",
                system_instruction=system_instruction
            )
            response_stream = model.generate_content(user_content, stream=True)
            for chunk in response_stream:
                if chunk.text:
                    sanitized = _sanitize_output(chunk.text)
                    token_count += len(chunk.text.split())
                    yield sanitized
        except Exception as e:
            yield f"\n\nUnable to stream from AI model: {str(e)}"
        finally:
            _record_usage(uid, token_count)
            
    return StreamingResponse(
        generate(),
        media_type="text/plain",
        headers={
            "Cache-Control": "no-store",
            "X-Tutor-Source-Docs": meta_header
        }
    )
