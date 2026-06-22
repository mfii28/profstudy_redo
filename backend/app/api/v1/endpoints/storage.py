from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.core.database import get_db
from app.core.security import get_current_user
from app.services.r2_service import r2_service
import re
import time
from typing import Dict, Optional, List

router = APIRouter()

# Whitelists for content types by context
ALLOWED_CONTENT_TYPES = {
    'avatar': [re.compile(r'^image\/')],
    'assignment': [re.compile(r'^.+\/.+$')],
    'lesson': [re.compile(r'^.+\/.+$')],
    'library': [re.compile(r'^.+\/.+$')],
    'product': [re.compile(r'^image\/')],
    'branding': [re.compile(r'^image\/')],
    'course_thumbnail': [re.compile(r'^image\/')],
    'kyc': [re.compile(r'^image\/'), re.compile(r'^application\/pdf$')],
    'book_cover': [re.compile(r'^image\/')],
    'book_file': [re.compile(r'^application\/pdf$')],
    'rich_content': [re.compile(r'^.+\/.+$')],
    'classroom': [re.compile(r'^.+\/.+$')],
    'course_rag': [re.compile(r'^.+\/.+$')],
}

EXTENSION_MIME_MAP = {
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'txt': 'text/plain',
    'md': 'text/markdown',
    'csv': 'text/csv',
    'mp4': 'video/mp4',
    'mov': 'video/quicktime',
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'webp': 'image/webp',
}

BLOCKED_EXTENSIONS = {'xls', 'xlsx', 'xlsm', 'xlt', 'xltx', 'xltm'}
BLOCKED_MIME_PATTERNS = [
    re.compile(r'^application\/vnd\.ms-excel$'),
    re.compile(r'^application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet$'),
    re.compile(r'^application\/vnd\.ms-excel\.sheet\.macroenabled\.12$'),
    re.compile(r'^application\/vnd\.ms-excel\.template\.macroenabled\.12$'),
    re.compile(r'^application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.template$'),
]

def sanitize_key(key: str) -> str:
    """Sanitize filename to prevent directory traversal and remove illegal chars."""
    import urllib.parse
    decoded = key
    try:
        decoded = urllib.parse.unquote(key)
    except Exception:
        pass
    
    # Remove traversal patterns recursively
    prev = ''
    while prev != decoded:
        prev = decoded
        decoded = re.sub(r'\.\.[/\\]', '', decoded)
        decoded = re.sub(r'%2e%2e[/\\%]', '', decoded, flags=re.IGNORECASE)
        
    decoded = re.sub(r'[<>:"|?*\\]', '', decoded)
    return re.sub(r'\s+', '_', decoded)

def verify_user_role(user_id: str, allowed_roles: List[str], db) -> bool:
    user = db["User"].find_one({"_id": user_id})
    return user is not None and user.get("role") in allowed_roles

def derive_secure_path(uid: str, upload_type: str, file_name: str, context_id: Optional[str], db) -> str:
    clean_name = sanitize_key(file_name)
    timestamp = int(time.time() * 1000)
    
    if upload_type == 'avatar':
        return f"public/avatars/user-{uid}_{timestamp}_{clean_name}"
    elif upload_type == 'assignment':
        return f"private/users/{uid}/assignments/{timestamp}_{clean_name}"
    elif upload_type == 'lesson':
        if not context_id:
            raise HTTPException(status_code=400, detail="Course context (contextId) is required.")
        return f"private/courses/{context_id}/lessons/{timestamp}_{clean_name}"
    elif upload_type == 'library':
        return f"private/tutors/{uid}/library/{timestamp}_{clean_name}"
    elif upload_type == 'course_thumbnail':
        if not context_id:
            raise HTTPException(status_code=400, detail="Course context (contextId) is required.")
        return f"public/courses/{context_id}/thumbnail_{timestamp}_{clean_name}"
    elif upload_type == 'product':
        if not verify_user_role(uid, ['admin', 'superadmin'], db):
            raise HTTPException(status_code=403, detail="Unauthorized upload context.")
        return f"public/products/{timestamp}_{clean_name}"
    elif upload_type == 'branding':
        if not verify_user_role(uid, ['superadmin'], db):
            raise HTTPException(status_code=403, detail="Unauthorized upload context.")
        return f"public/branding/{timestamp}_{clean_name}"
    elif upload_type == 'kyc':
        return f"private/tutors/{uid}/kyc/{timestamp}_{clean_name}"
    elif upload_type == 'book_cover':
        if not verify_user_role(uid, ['admin', 'superadmin', 'subadmin'], db):
            raise HTTPException(status_code=403, detail="Unauthorized upload context.")
        return f"public/books/covers/{timestamp}_{clean_name}"
    elif upload_type == 'book_file':
        if not verify_user_role(uid, ['admin', 'superadmin', 'subadmin'], db):
            raise HTTPException(status_code=403, detail="Unauthorized upload context.")
        if not context_id:
            raise HTTPException(status_code=400, detail="Book context (contextId) is required.")
        return f"private/books/{context_id}/content/{timestamp}_{clean_name}"
    elif upload_type == 'rich_content':
        if not verify_user_role(uid, ['admin', 'superadmin', 'subadmin', 'tutor'], db):
            raise HTTPException(status_code=403, detail="Unauthorized upload context.")
        return f"public/rich-content/{timestamp}_{clean_name}"
    elif upload_type == 'classroom':
        if not context_id:
            raise HTTPException(status_code=400, detail="Classroom context (contextId) is required.")
        return f"private/classrooms/{context_id}/files/{timestamp}_{clean_name}"
    elif upload_type == 'course_rag':
        if not context_id:
            raise HTTPException(status_code=400, detail="Course context (contextId) is required.")
        if not verify_user_role(uid, ['admin', 'superadmin', 'subadmin', 'tutor'], db):
            raise HTTPException(status_code=403, detail="Unauthorized upload context.")
        return f"private/courses/{context_id}/rag/uploads/{timestamp}_{clean_name}"
    else:
        raise HTTPException(status_code=400, detail="Invalid upload context type.")

@router.get("/upload-url")
def get_upload_url(
    type: str = Query(...),
    fileName: str = Query(...),
    contentType: str = Query(...),
    contextId: Optional[str] = Query(None),
    lessonType: Optional[str] = Query(None),
    current_user: Dict = Depends(get_current_user),
    db = Depends(get_db)
):
    uid = current_user["id"]
    
    # Block spreadsheets
    ext = fileName.split('.')[-1].lower() if '.' in fileName else ''
    if ext in BLOCKED_EXTENSIONS and not (type == 'lesson' and lessonType == 'resource'):
        raise HTTPException(status_code=400, detail="Spreadsheet uploads (.xls/.xlsx) are not allowed.")
        
    resolved_content_type = contentType.strip().lower()
    if not resolved_content_type or resolved_content_type == 'application/octet-stream':
        resolved_content_type = EXTENSION_MIME_MAP.get(ext, 'application/octet-stream')
        
    # Verify allowed content types
    if type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Invalid upload context type.")
        
    is_allowed = any(pattern.match(resolved_content_type) for pattern in ALLOWED_CONTENT_TYPES[type])
    if not is_allowed:
        raise HTTPException(status_code=400, detail="This file type is not allowed for the selected context.")
        
    # Verify allowed lesson content types
    if type == 'lesson' and lessonType:
        if lessonType == 'document' and resolved_content_type != 'application/pdf':
            raise HTTPException(status_code=400, detail="Document lessons only accept PDF files.")
        if lessonType == 'video' and not resolved_content_type.startswith('video/'):
            raise HTTPException(status_code=400, detail="Video lessons only accept video files.")

    key = derive_secure_path(uid, type, fileName, contextId, db)
    
    # Request PUT url from R2 service
    url = r2_service.generate_upload_url(key)
    if not url:
        raise HTTPException(status_code=500, detail="Storage client initialization failed.")
        
    return {
        "url": url,
        "key": key,
        "contentType": resolved_content_type
    }

@router.get("/download-url")
def get_download_url(
    key: str = Query(...),
    asAttachment: bool = Query(False),
    fileName: Optional[str] = Query(None),
    current_user: Dict = Depends(get_current_user),
    db = Depends(get_db)
):
    uid = current_user["id"]
    clean_key = sanitize_key(key)
    
    # Check permissions for private objects
    if not clean_key.startswith("public/"):
        is_admin = verify_user_role(uid, ["admin", "superadmin", "subadmin"], db)
        has_access = is_admin
        
        if not has_access and clean_key.startswith(f"private/users/{uid}/"):
            has_access = True
        if not has_access and clean_key.startswith(f"private/tutors/{uid}/"):
            has_access = True
            
        # Classroom match checks
        if not has_access and clean_key.startswith("private/classrooms/"):
            classroom_id = clean_key.split('/')[2]
            classroom = db["Classroom"].find_one({"_id": classroom_id})
            if classroom:
                tutor_id = classroom.get("tutorId")
                enrolled_students = classroom.get("enrolledStudentIds") or []
                if tutor_id == uid or uid in enrolled_students:
                    has_access = True
                    
        # Course match checks
        if not has_access and clean_key.startswith("private/courses/"):
            course_id = clean_key.split('/')[2]
            course = db["Course"].find_one({"_id": course_id})
            if course:
                tutor = db["TutorDetail"].find_one({"userId": uid})
                if tutor and course.get("tutorId") == tutor.get("_id"):
                    has_access = True
                else:
                    order = db["Order"].find_one({"userId": uid, "status": "completed"})
                    if order:
                        has_access = True

        # Book purchase checks
        if not has_access and clean_key.startswith("private/books/"):
            book_id = clean_key.split('/')[2]
            purchase = db["BookPurchase"].find_one({"userId": uid, "bookId": book_id})
            if purchase:
                has_access = True
                
        if not has_access:
            raise HTTPException(status_code=403, detail="Permission denied.")
            
    # Generate GET url
    url = r2_service.generate_download_url(clean_key)
    if not url:
        raise HTTPException(status_code=500, detail="Storage client initialization failed.")
        
    return {"url": url}
