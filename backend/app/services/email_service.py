import httpx
from app.core.config import settings
from typing import Dict, List, Optional
import logging

logger = logging.getLogger(__name__)

class EmailService:
    def __init__(self):
        self.api_key = settings.RESEND_API_KEY
        self.headers = {
            "Authorization": f"Bearer {self.api_key}" if self.api_key else "",
            "Content-Type": "application/json"
        }

    async def send_email(self, to: str, subject: str, html: str, from_email: Optional[str] = None) -> bool:
        """Send a transactional email using Resend API"""
        if not self.api_key:
            print("[Email Service] Warning: RESEND_API_KEY not configured. Skipping email send.")
            return False
            
        url = "https://api.resend.com/emails"
        payload = {
            "from": from_email or "no-reply@mytestingdomain.icu",
            "to": [to],
            "subject": subject,
            "html": html
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, json=payload, headers=self.headers)
                if response.status_code == 200 or response.status_code == 201:
                    return True
                else:
                    print(f"[Email Service] Failed to send email: {response.text}")
                    return False
            except Exception as e:
                print(f"[Email Service] Error connecting to Resend: {str(e)}")
                return False

    async def send_transactional_email(
        self,
        email_type: str,
        to: str,
        recipient_name: str,
        **kwargs
    ) -> dict:
        """Port of sendTransactionalEmail from Next.js."""
        if not self.api_key:
            logger.warning("RESEND_API_KEY not configured.")
            return {"success": False, "error": "RESEND_API_KEY not configured"}

        subject = ""
        html = ""

        if email_type == "welcome":
            subject = f"Welcome to Profs Training Solutions, {recipient_name}!"
            html = f"<p>Welcome to <strong>Profs Training Solutions</strong>, {recipient_name}!</p>"
        elif email_type == "enrollment":
            course_title = kwargs.get("courseTitle", "Course")
            subject = f"Enrollment Confirmed: {course_title}"
            html = f"<p>Hi {recipient_name}, you have been enrolled in <strong>{course_title}</strong>.</p>"
        else:
            subject = f"Update from Profs Training Solutions"
            html = f"<p>Hi {recipient_name}, you have a new update.</p>"

        success = await self.send_email(to, subject, html)
        if success:
            return {"success": True}
        else:
            return {"success": False, "error": "Email delivery failed"}

    async def send_platform_email(
        self,
        to: str,
        subject: str,
        message: str,
        email_type: str = "Info"
    ) -> dict:
        """Port of sendPlatformEmail."""
        if not self.api_key:
            return {"success": False, "error": "RESEND_API_KEY not configured"}
            
        html = f"<p>{message}</p>"
        success = await self.send_email(to, subject, html)
        if success:
            return {"success": True, "sentCount": 1}
        else:
            return {"success": False, "error": "Email delivery failed"}

email_service = EmailService()
