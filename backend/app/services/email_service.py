import httpx
from app.core.config import settings
from typing import Dict, List, Optional

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

email_service = EmailService()
