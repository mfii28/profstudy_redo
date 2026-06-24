from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.config import settings
from app.core.security import get_current_user
from app.models.models import Course, TutorDetail, Order, User
from app.api.v1.endpoints.rag import get_course_markdown_text
import google.generativeai as genai
import json
import urllib.parse
from typing import Dict, Any, Optional

router = APIRouter()

PERSONAS = {'Friendly', 'Strict', 'Beginner', 'Expert', 'Exam Coach'}

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
        try:
            model = genai.GenerativeModel(
                model_name="gemini-2.5-flash",
                system_instruction=system_instruction
            )
            response_stream = model.generate_content(user_content, stream=True)
            for chunk in response_stream:
                if chunk.text:
                    yield chunk.text
        except Exception as e:
            yield f"\n\nUnable to stream from AI model: {str(e)}"
            
    return StreamingResponse(
        generate(),
        media_type="text/plain",
        headers={
            "Cache-Control": "no-store",
            "X-Tutor-Source-Docs": meta_header
        }
    )
