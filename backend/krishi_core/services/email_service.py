"""
Centralized email service for KrishiMitra.

Supports:
1. Brevo Transactional Email API over HTTPS (Port 443) - primary for Render Free
2. Django SMTP (send_mail) fallback - for local SMTP or legacy configs
3. Console logging fallback - for local testing without email credentials
"""
import logging
import requests
from django.conf import settings

logger = logging.getLogger(__name__)

BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"


class EmailService:
    @staticmethod
    def send_email(to_email: str, subject: str, html_content: str, text_content: str = "") -> tuple[bool, str]:
        """
        Sends an email using Brevo HTTPS API, falling back to Django SMTP, then console logging.
        Returns (success: bool, message: str).
        """
        brevo_key = getattr(settings, "BREVO_API_KEY", "")
        sender_email = getattr(settings, "BREVO_SENDER_EMAIL", "") or getattr(settings, "EMAIL_HOST_USER", "") or "noreply@krishimitra.com"
        sender_name = getattr(settings, "BREVO_SENDER_NAME", "KrishiMitra")

        # 1. Brevo HTTPS API (Primary for Render Free deployment)
        if brevo_key:
            headers = {
                "api-key": brevo_key,
                "Content-Type": "application/json",
                "Accept": "application/json"
            }
            payload = {
                "sender": {"name": sender_name, "email": sender_email},
                "to": [{"email": to_email}],
                "subject": subject,
                "htmlContent": html_content
            }
            if text_content:
                payload["textContent"] = text_content

            try:
                response = requests.post(BREVO_API_URL, json=payload, headers=headers, timeout=(3.0, 10.0))
                if response.status_code in (200, 201, 202):
                    logger.info("Email successfully sent via Brevo to %s", to_email)
                    return True, "Email sent successfully via Brevo."
                else:
                    logger.error("Brevo API returned status %s: %s", response.status_code, response.text)
                    return False, f"Brevo API error (status {response.status_code})"
            except requests.exceptions.RequestException as exc:
                logger.error("Brevo API request failed: %s", exc)
                return False, "Failed to connect to Brevo email service."

        # 2. Django SMTP Fallback (for local development or environments where SMTP is available)
        smtp_user = getattr(settings, "EMAIL_HOST_USER", "")
        if smtp_user:
            try:
                from django.core.mail import send_mail
                send_mail(
                    subject,
                    text_content or "Please use an HTML-compatible email client to view this message.",
                    sender_email,
                    [to_email],
                    fail_silently=False,
                    html_message=html_content
                )
                logger.info("Email successfully sent via SMTP to %s", to_email)
                return True, "Email sent successfully via SMTP."
            except Exception as exc:
                logger.error("SMTP send_mail failed: %s", exc)
                return False, f"SMTP send failed: {exc}"

        # 3. Development / Headless Console Fallback (neither Brevo nor SMTP configured)
        logger.warning(
            "[DEV EMAIL] No email provider configured (BREVO_API_KEY and EMAIL_HOST_USER absent). "
            "Recipient: %s | Subject: %s\nText preview: %s",
            to_email, subject, text_content[:120] if text_content else "(HTML only)"
        )
        return True, "Email logged to console (no credentials configured)."


email_service = EmailService()
send_email = email_service.send_email
