from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import select, and_
from app.core.database import get_db
from app.core.config import settings
from app.core.security import get_current_user
from app.models.models import User, Course, CourseRagSource, TutorDetail, Order
from app.services.r2_service import r2_service
import hashlib
import httpx
import base64
import zipfile
import xml.etree.ElementTree as ET
from io import BytesIO
from typing import Dict, Any, Optional, List

router = APIRouter()

# Helper: SHA256 hashing
def sha256_hex(input_str: str) -> str:
    return hashlib.sha256(input_str.encode('utf-8')).hexdigest()

# Helper: verify tutor or admin has course management permissions
def verify_course_manager(course_id: str, current_user: Dict, db: Session) -> Course:
    uid = current_user["id"]
    role = current_user.get("role", "student")
    
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")
        
    is_staff = role in ['admin', 'superadmin', 'subadmin']
    tutor = db.query(TutorDetail).filter(TutorDetail.userId == uid).first()
    is_owner = tutor is not None and course.tutorId == tutor.id
    
    if not is_staff and not is_owner:
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to manage AI materials for this course."
        )
    return course

# Helper: docx text extractor
def extract_docx_text(buffer: bytes) -> str:
    try:
        with zipfile.ZipFile(BytesIO(buffer)) as docx:
            xml_content = docx.read('word/document.xml')
            root = ET.fromstring(xml_content)
            texts = []
            for elem in root.iter():
                if elem.tag.endswith('t'):
                    texts.append(elem.text or "")
            return " ".join(texts)
    except Exception as e:
        raise ValueError(f"Failed to extract text from DOCX: {str(e)}")

# Helper: Gemini PDF transcription
async def convert_pdf_to_markdown(pdf_bytes: bytes, content_type: str) -> str:
    if not settings.GEMINI_API_KEY:
        raise ValueError("Gemini API key is not configured in backend settings.")
        
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={settings.GEMINI_API_KEY}"
    
    base64_data = base64.b64encode(pdf_bytes).decode('utf-8')
    prompt = ("Extract the contents of this document into clean, structured Markdown. "
              "Maintain heading hierarchy, lists, and construct Markdown tables for any tabular data. "
              "Do not skip any text. Output ONLY clean Markdown without code fences (do not wrap with ```markdown).")
              
    payload = {
        "contents": [{
            "parts": [
                {
                    "inlineData": {
                        "mimeType": content_type,
                        "data": base64_data
                    }
                },
                {
                    "text": prompt
                }
            ]
        }]
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, json=payload, timeout=60.0)
            res_data = response.json()
        except Exception as e:
            raise ValueError(f"Failed to reach Gemini: {str(e)}")
            
    if response.status_code != 200:
        raise ValueError(f"Gemini API returned error: {response.text}")
        
    try:
        candidates = res_data.get("candidates", [])
        if candidates:
            parts = candidates[0].get("content", {}).get("parts", [])
            if parts:
                return parts[0].get("text", "")
        raise ValueError("Empty response from Gemini.")
    except Exception as e:
        raise ValueError(f"Failed to parse Gemini response: {str(e)}")

# Helper: update unified materials markdown file sections
def replace_or_append_source_section(existing_markdown: str, source_label: str, new_content: str) -> str:
    normalized = existing_markdown.replace('\r\n', '\n').strip()
    prepended = '\n' + normalized
    sections = prepended.split('\n## Source: ')
    
    header_clean = source_label.strip().lower()
    kept_sections = []
    
    for idx, sec in enumerate(sections):
        if idx == 0:
            kept_sections.append(sec)
            continue
        first_line_end = sec.find('\n')
        name = (sec if first_line_end == -1 else sec[:first_line_end]).strip().lower()
        if name != header_clean:
            kept_sections.append(sec)
            
    result = '\n## Source: '.join(kept_sections).strip()
    if result:
        result += f"\n\n## Source: {source_label.strip()}\n{new_content.strip()}"
    else:
        result = f"## Source: {source_label.strip()}\n{new_content.strip()}"
    return result

# Helper: download unified materials markdown from R2
async def get_course_markdown_text(course_id: str) -> str:
    key = f"private/courses/{course_id}/rag/materials.md"
    try:
        # Since boto3 is blocking, we can use a threadpool or run directly if volume is small
        # For simplicity, we just download via our R2 service
        url = r2_service.generate_download_url(key)
        if not url:
            return ""
        async with httpx.AsyncClient() as client:
            res = await client.get(url)
            if res.status_code == 200:
                return res.text
            return ""
    except Exception:
        return ""

# Helper: upload unified materials markdown back to R2
async def save_course_markdown_text(course_id: str, markdown_text: str):
    key = f"private/courses/{course_id}/rag/materials.md"
    # Get upload URL
    url = r2_service.generate_upload_url(key)
    if not url:
         raise ValueError("Failed to generate upload URL for course materials.")
    async with httpx.AsyncClient() as client:
        res = await client.put(url, content=markdown_text.encode('utf-8'), headers={"Content-Type": "text/markdown"})
        if res.status_code != 200:
            raise ValueError("Failed to upload course materials to R2 bucket.")

@router.post("/course/{course_id}/ingest-text")
async def ingest_text(
    course_id: str,
    payload: Dict[str, Any],
    current_user: Dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    source_label = payload.get("sourceLabel")
    text_content = payload.get("text")
    
    if not source_label or not text_content:
        raise HTTPException(status_code=400, detail="sourceLabel and text are required.")
        
    # Verify course permissions
    verify_course_manager(course_id, current_user, db)
    
    normalized_text = text_content.replace('\r\n', '\n').strip()
    if not normalized_text:
        return {"ok": True, "chunkCount": 0}
        
    content_hash = sha256_hex(normalized_text)
    safe_source = source_label.strip()[:200]
    
    # Idempotency check using database
    existing_source = db.query(CourseRagSource).filter(
        and_(CourseRagSource.courseId == course_id, CourseRagSource.sourceFile == safe_source)
    ).first()
    
    if existing_source and existing_source.contentHash == content_hash:
        return {"ok": True, "chunkCount": 1, "skipped": True}
        
    # Fetch, append, and upload markdown
    current_md = await get_course_markdown_text(course_id)
    updated_md = replace_or_append_source_section(current_md, safe_source, normalized_text)
    await save_course_markdown_text(course_id, updated_md)
    
    # Save/update metadata in DB
    if not existing_source:
        existing_source = CourseRagSource(
            id=f"rag-{course_id}-{sha256_hex(safe_source)[:12]}",
            courseId=course_id,
            sourceFile=safe_source,
            contentHash=content_hash,
            chunkCount=1
        )
        db.add(existing_source)
    else:
        existing_source.contentHash = content_hash
        
    db.commit()
    return {"ok": True, "chunkCount": 1}

@router.post("/course/{course_id}/ingest-file")
async def ingest_file(
    course_id: str,
    payload: Dict[str, Any],
    current_user: Dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    source_label = payload.get("sourceLabel")
    file_key = payload.get("fileKey")
    
    if not source_label or not file_key:
        raise HTTPException(status_code=400, detail="sourceLabel and fileKey are required.")
        
    # Verify course permissions
    verify_course_manager(course_id, current_user, db)
    
    # Generate download URL for the file from R2
    download_url = r2_service.generate_download_url(file_key)
    if not download_url:
        raise HTTPException(status_code=500, detail="Failed to locate file in R2.")
        
    async with httpx.AsyncClient() as client:
        try:
            res = await client.get(download_url)
            file_bytes = res.content
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to download RAG source: {str(e)}")
            
    lower_key = file_key.lower()
    extracted_text = ""
    
    try:
        if lower_key.endswith('.pdf'):
            extracted_text = await convert_pdf_to_markdown(file_bytes, 'application/pdf')
        elif lower_key.endswith('.docx'):
            extracted_text = extract_docx_text(file_bytes)
        elif lower_key.endswith('.txt'):
            extracted_text = file_bytes.decode('utf-8')
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format.")
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Text extraction failed: {str(err)}")
        
    if not extracted_text.strip():
        raise HTTPException(status_code=400, detail="No text extracted from file.")
        
    content_hash = sha256_hex(extracted_text)
    safe_source = source_label.strip()[:200]
    
    # Idempotency check using DB
    existing_source = db.query(CourseRagSource).filter(
        and_(CourseRagSource.courseId == course_id, CourseRagSource.sourceFile == safe_source)
    ).first()
    
    if existing_source and existing_source.contentHash == content_hash:
        return {"ok": True, "chunkCount": 1, "skipped": True}
        
    # Fetch, append, upload markdown
    current_md = await get_course_markdown_text(course_id)
    updated_md = replace_or_append_source_section(current_md, safe_source, extracted_text)
    await save_course_markdown_text(course_id, updated_md)
    
    # Update DB
    if not existing_source:
        existing_source = CourseRagSource(
            id=f"rag-{course_id}-{sha256_hex(safe_source)[:12]}",
            courseId=course_id,
            sourceFile=safe_source,
            contentHash=content_hash,
            chunkCount=1
        )
        db.add(existing_source)
    else:
        existing_source.contentHash = content_hash
        
    db.commit()
    return {"ok": True, "chunkCount": 1}

@router.get("/course/{course_id}/stats")
def get_rag_stats(
    course_id: str,
    current_user: Dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    uid = current_user["id"]
    role = current_user.get("role", "student")
    
    # Check course existence
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")
        
    # Verify enrollment or tutor/admin status
    is_staff = role in ['admin', 'superadmin', 'subadmin']
    tutor = db.query(TutorDetail).filter(TutorDetail.userId == uid).first()
    is_owner = tutor is not None and course.tutorId == tutor.id
    
    has_access = is_staff or is_owner
    if not has_access:
        # Check student enrollment via order status (completed orders indicate purchase/enrollment)
        order = db.query(Order).filter(
            and_(Order.userId == uid, Order.status == "completed")
        ).first()
        if order:
            has_access = True
            
    if not has_access:
        raise HTTPException(status_code=403, detail="Permission denied.")
        
    # Fetch sources from DB
    rag_sources = db.query(CourseRagSource).filter(CourseRagSource.courseId == course_id).all()
    sources = [s.sourceFile for s in rag_sources]
    
    return {
        "chunkCount": len(sources),
        "sources": sources
    }
