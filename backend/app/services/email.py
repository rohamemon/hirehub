"""Email abstraction. `console` backend logs a preview (dev); `smtp` really sends."""
import logging
import smtplib
from email.message import EmailMessage

from app.core.config import get_settings

logger = logging.getLogger("hirehub.email")


def send_email(to: str, subject: str, body: str) -> None:
    s = get_settings()
    if s.email_backend == "smtp" and s.smtp_host:
        msg = EmailMessage()
        msg["From"], msg["To"], msg["Subject"] = s.email_from, to, subject
        msg.set_content(body)
        try:
            with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=10) as smtp:
                smtp.starttls()
                if s.smtp_user:
                    smtp.login(s.smtp_user, s.smtp_password)
                smtp.send_message(msg)
        except Exception:  # email failure must never break the request
            logger.exception("Failed to send email to %s", to)
        return
    # Dev mode: nothing is actually delivered.
    logger.info("[DEV EMAIL - not delivered] to=%s subject=%r\n%s", to, subject, body)
