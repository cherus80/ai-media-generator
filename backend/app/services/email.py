"""
Email Service — Сервис для отправки email через SMTP.

Поддерживает:
- Отправку писем верификации email
- HTML и текстовые шаблоны
- Настройка через переменные окружения
"""

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from app.core.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    """Сервис для отправки email через SMTP"""

    @staticmethod
    def is_configured() -> bool:
        """Проверить, настроен ли SMTP для отправки писем."""
        return bool(settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD)

    @staticmethod
    def _create_verification_email_html(
        user_name: str,
        verification_link: str,
        token_ttl_minutes: int,
    ) -> str:
        """
        Создать HTML-шаблон письма верификации.

        Args:
            user_name: Имя пользователя
            verification_link: Ссылка для верификации
            token_ttl_minutes: Время жизни токена в минутах

        Returns:
            str: HTML-код письма
        """
        return f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Подтверждение Email</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">ИИ Генератор</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Подтверждение Email</p>
    </div>

    <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
        <h2 style="color: #333; margin-top: 0;">Здравствуйте{', ' + user_name if user_name else ''}!</h2>

        <p>Спасибо за регистрацию в ИИ Генератор. Для завершения регистрации и активации вашего аккаунта, пожалуйста, подтвердите ваш email-адрес.</p>

        <div style="text-align: center; margin: 30px 0;">
            <a href="{verification_link}"
               style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                      color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px;
                      font-weight: bold; font-size: 16px;">
                Подтвердить Email
            </a>
        </div>

        <p style="color: #666; font-size: 14px;">
            Если кнопка не работает, скопируйте и вставьте эту ссылку в браузер:<br>
            <a href="{verification_link}" style="color: #667eea; word-break: break-all;">{verification_link}</a>
        </p>

        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; color: #666; font-size: 14px;">
                <strong>Важно:</strong> Эта ссылка действительна в течение {token_ttl_minutes} минут.
            </p>
        </div>

        <p style="color: #999; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
            Если вы не регистрировались на нашем сайте, просто проигнорируйте это письмо.<br>
            Если у вас есть вопросы, свяжитесь с нами: ai-generator@mix4.ru
        </p>
    </div>
</body>
</html>
"""

    @staticmethod
    def _create_verification_email_text(
        user_name: str,
        verification_link: str,
        token_ttl_minutes: int,
    ) -> str:
        """
        Создать текстовую версию письма верификации.

        Args:
            user_name: Имя пользователя
            verification_link: Ссылка для верификации
            token_ttl_minutes: Время жизни токена в минутах

        Returns:
            str: Текст письма
        """
        greeting = f"Здравствуйте, {user_name}!" if user_name else "Здравствуйте!"
        return f"""
{greeting}

Спасибо за регистрацию в ИИ Генератор.

Для завершения регистрации и активации вашего аккаунта, пожалуйста, подтвердите ваш email-адрес, перейдя по ссылке:

{verification_link}

ВАЖНО: Эта ссылка действительна в течение {token_ttl_minutes} минут.

Если вы не регистрировались на нашем сайте, просто проигнорируйте это письмо.

Если у вас есть вопросы, свяжитесь с нами: ai-generator@mix4.ru

---
ИИ Генератор
"""

    @staticmethod
    def send_verification_email(
        to_email: str,
        verification_token: str,
        user_name: Optional[str] = None,
    ) -> bool:
        """
        Отправить письмо верификации email.

        Args:
            to_email: Email получателя
            verification_token: Токен для верификации
            user_name: Имя пользователя (опционально)

        Returns:
            bool: True если письмо отправлено успешно, False иначе

        Raises:
            Exception: Если настройки SMTP не сконфигурированы
        """
        # Проверка настроек SMTP
        if not EmailService.is_configured():
            logger.warning("SMTP settings not configured. Email verification disabled.")
            return False

        # Формируем ссылку верификации
        verification_link = f"{settings.FRONTEND_URL}/verify?token={verification_token}"

        # Создаем письмо
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Подтверждение Email — ИИ Генератор"
        msg["From"] = f"{settings.EMAIL_FROM_NAME} <{settings.EMAIL_FROM or settings.SMTP_USER}>"
        msg["To"] = to_email

        # Текстовая и HTML версии
        text_content = EmailService._create_verification_email_text(
            user_name=user_name or "",
            verification_link=verification_link,
            token_ttl_minutes=settings.EMAIL_VERIFICATION_TOKEN_TTL_MIN,
        )
        html_content = EmailService._create_verification_email_html(
            user_name=user_name or "",
            verification_link=verification_link,
            token_ttl_minutes=settings.EMAIL_VERIFICATION_TOKEN_TTL_MIN,
        )

        part1 = MIMEText(text_content, "plain", "utf-8")
        part2 = MIMEText(html_content, "html", "utf-8")

        msg.attach(part1)
        msg.attach(part2)

        # Отправка письма
        try:
            if settings.SMTP_USE_TLS:
                # TLS (порт 587)
                server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT)
                server.starttls()
            else:
                # SSL (порт 465) или без шифрования
                server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT)

            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
            server.quit()

            logger.info(f"Verification email sent successfully to {to_email}")
            return True

        except smtplib.SMTPException as e:
            logger.error(f"SMTP error while sending email to {to_email}: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error while sending email to {to_email}: {e}")
            return False

    @staticmethod
    def _create_password_reset_email_html(
        user_name: str,
        reset_link: str,
        token_ttl_minutes: int,
    ) -> str:
        return f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Сброс пароля</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">ИИ Генератор</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Сброс пароля</p>
    </div>

    <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
        <h2 style="color: #333; margin-top: 0;">Здравствуйте{', ' + user_name if user_name else ''}!</h2>

        <p>Мы получили запрос на сброс пароля для вашего аккаунта.</p>

        <div style="text-align: center; margin: 30px 0;">
            <a href="{reset_link}"
               style="display: inline-block; background: linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%);
                      color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px;
                      font-weight: bold; font-size: 16px;">
                Сбросить пароль
            </a>
        </div>

        <p style="color: #666; font-size: 14px;">
            Если кнопка не работает, скопируйте и вставьте эту ссылку в браузер:<br>
            <a href="{reset_link}" style="color: #0ea5e9; word-break: break-all;">{reset_link}</a>
        </p>

        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; color: #666; font-size: 14px;">
                <strong>Важно:</strong> Ссылка действительна в течение {token_ttl_minutes} минут.
            </p>
        </div>

        <p style="color: #999; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
            Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.<br>
            Если у вас есть вопросы, свяжитесь с нами: ai-generator@mix4.ru
        </p>
    </div>
</body>
</html>
"""

    @staticmethod
    def _create_password_reset_email_text(
        user_name: str,
        reset_link: str,
        token_ttl_minutes: int,
    ) -> str:
        greeting = f"Здравствуйте, {user_name}!" if user_name else "Здравствуйте!"
        return f"""
{greeting}

Мы получили запрос на сброс пароля для вашего аккаунта.

Чтобы сбросить пароль, перейдите по ссылке:

{reset_link}

ВАЖНО: Ссылка действительна в течение {token_ttl_minutes} минут.

Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.

Если у вас есть вопросы, свяжитесь с нами: ai-generator@mix4.ru

---
ИИ Генератор
"""

    @staticmethod
    def send_password_reset_email(
        to_email: str,
        reset_token: str,
        user_name: Optional[str] = None,
    ) -> bool:
        if not EmailService.is_configured():
            logger.warning("SMTP settings not configured. Password reset disabled.")
            return False

        reset_link = f"{settings.FRONTEND_URL}/reset-password?token={reset_token}"

        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Сброс пароля — ИИ Генератор"
        msg["From"] = f"{settings.EMAIL_FROM_NAME} <{settings.EMAIL_FROM or settings.SMTP_USER}>"
        msg["To"] = to_email

        text_content = EmailService._create_password_reset_email_text(
            user_name=user_name or "",
            reset_link=reset_link,
            token_ttl_minutes=settings.PASSWORD_RESET_TOKEN_TTL_MIN,
        )
        html_content = EmailService._create_password_reset_email_html(
            user_name=user_name or "",
            reset_link=reset_link,
            token_ttl_minutes=settings.PASSWORD_RESET_TOKEN_TTL_MIN,
        )

        part1 = MIMEText(text_content, "plain", "utf-8")
        part2 = MIMEText(html_content, "html", "utf-8")

        msg.attach(part1)
        msg.attach(part2)

        try:
            if settings.SMTP_USE_TLS:
                server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT)
                server.starttls()
            else:
                server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT)

            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
            server.quit()

            logger.info("Password reset email sent successfully to %s", to_email)
            return True

        except smtplib.SMTPException as e:
            logger.error("SMTP error while sending password reset email to %s: %s", to_email, e)
            return False
        except Exception as e:
            logger.error("Unexpected error while sending password reset email to %s: %s", to_email, e)
            return False


# Singleton instance
email_service = EmailService()
