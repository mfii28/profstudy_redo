from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any, List, Optional
import os
import json
import base64
import google.generativeai as genai
from pydantic import BaseModel

from app.core.security import get_current_user

router = APIRouter()

# Initialize Gemini API
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

class QuizRequest(BaseModel):
    text: Optional[str] = None
    fileBase64: Optional[str] = None
    mimeType: Optional[str] = None
    topic: str = ""
    questionCount: int = 5

class AnnouncementRequest(BaseModel):
    text: str
    tone: str = "Professional"

class SecurityAlertRequest(BaseModel):
    incidentType: str

@router.post("/quiz")
async def generate_quiz(
    req: QuizRequest,
    current_user: Dict = Depends(get_current_user)
):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="AI is not configured on the server")
        
    count = max(1, min(req.questionCount, 20))
    topic_text = f' about "{req.topic}"' if req.topic else ''
    
    prompt = f"""
    You are an expert quiz creator. Generate {count} multiple-choice quiz questions{topic_text}.
    Each question must have 2 to 5 answer options and exactly one correct answer.
    Return ONLY valid JSON matching this schema:
    {{
      "quiz": [
        {{
          "questionText": "string",
          "options": ["string", "string", ...],
          "correctAnswerIndex": number,
          "explanation": "string"
        }}
      ]
    }}
    """
    
    model = genai.GenerativeModel('gemini-1.5-pro')
    
    try:
        contents = [prompt]
        
        if req.fileBase64 and req.mimeType:
            if req.mimeType == 'text/plain':
                text_content = base64.b64decode(req.fileBase64).decode('utf-8')
                contents.append(text_content)
            else:
                # Provide as inline data for Gemini
                contents.append({
                    "mime_type": req.mimeType,
                    "data": req.fileBase64
                })
        elif req.text:
            contents.append(req.text)
        else:
            raise HTTPException(status_code=400, detail="No content provided")
            
        response = model.generate_content(contents)
        
        # Clean the response text (it might contain markdown blocks like ```json)
        res_text = response.text.strip()
        if res_text.startswith("```json"):
            res_text = res_text[7:]
        if res_text.startswith("```"):
            res_text = res_text[3:]
        if res_text.endswith("```"):
            res_text = res_text[:-3]
            
        quiz_data = json.loads(res_text.strip())
        return quiz_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/announcement/refine")
async def refine_announcement(
    req: AnnouncementRequest,
    current_user: Dict = Depends(get_current_user)
):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="AI is not configured on the server")
        
    prompt = f"""
    You are an expert communications manager. Refine the following announcement for a {req.tone} tone.
    Ensure the message is clear, concise, and professional. Return ONLY the refined text.
    
    Original Text:
    {req.text}
    """
    
    model = genai.GenerativeModel('gemini-1.5-flash')
    
    try:
        response = model.generate_content(prompt)
        return {"result": {"message": response.text.strip()}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/announcement/security-alert")
async def generate_security_alert(
    req: SecurityAlertRequest,
    current_user: Dict = Depends(get_current_user)
):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="AI is not configured on the server")
        
    prompt = f"""
    You are an expert security officer. Generate a security alert announcement regarding: {req.incidentType}.
    The alert should be urgent but reassuring, providing clear instructions if necessary.
    Return ONLY the alert text.
    """
    
    model = genai.GenerativeModel('gemini-1.5-flash')
    
    try:
        response = model.generate_content(prompt)
        return {"result": {"message": response.text.strip()}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class DashboardInsightRequest(BaseModel):
    data: Dict[str, Any]

class CourseInsightRequest(BaseModel):
    data: Dict[str, Any]

@router.post("/insights/dashboard")
async def generate_dashboard_insight(
    req: DashboardInsightRequest,
    current_user: Dict = Depends(get_current_user)
):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="AI is not configured on the server")
        
    prompt = f"""
    You are an expert data analyst for an e-learning platform.
    Analyze the following dashboard metrics and provide a 2-3 sentence actionable insight for the admin:
    {json.dumps(req.data)}
    """
    
    model = genai.GenerativeModel('gemini-1.5-flash')
    
    try:
        response = model.generate_content(prompt)
        return {"insight": response.text.strip(), "tokensUsed": 0, "premium": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/insights/course")
async def generate_course_insight(
    req: CourseInsightRequest,
    current_user: Dict = Depends(get_current_user)
):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="AI is not configured on the server")
        
    prompt = f"""
    You are an expert educational data analyst.
    Analyze the following course performance metrics and provide a 2-3 sentence actionable insight for the instructor:
    {json.dumps(req.data)}
    """
    
    model = genai.GenerativeModel('gemini-1.5-flash')
    
    try:
        response = model.generate_content(prompt)
        return {"insight": response.text.strip(), "tokensUsed": 0, "premium": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
