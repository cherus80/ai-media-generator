"""
Web Authentication API endpoints.

Endpoints:
- POST /auth/register - Регистрация через Email/Password
- POST /auth/login - Вход через Email/Password
- POST /auth/google - Вход через Google OAuth
- POST /auth/vk - Вход через VK ID OAuth
- GET /auth/me - Получение текущего профиля пользователя
- POST /auth/logout - Выход (для будущего расширения)
"""

import logging
import time
from collections import defaultdict, deque
import secrets
from datetime import datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import CurrentUser, DBSession
from app.core.config import settings
from app.models.user import User, AuthProvider, UserRole
from app.models.user_consent import UserConsent
from app.services.billing_v5 import BillingV5Service
from app.schemas.auth_web import (
    RegisterRequest,
    LoginRequest,
    LoginResponse,
    PasswordResetRequest,
    PasswordResetResponse,
    PasswordResetConfirmRequest,
    PasswordResetConfirmResponse,
    GoogleOAuthRequest,
    GoogleOAuthResponse,
    VKOAuthRequest,
    VKOAuthPKCERequest,
    VKOAuthResponse,
    UserProfile,
    UserProfileResponse,
    SendVerificationEmailResponse,
    VerifyEmailRequest,
    VerifyEmailResponse,
)
from app.utils.jwt import create_user_access_token
from app.utils.password import hash_password, verify_password, is_strong_password
from app.utils.google_oauth import verify_google_id_token, GoogleOAuthError
from app.utils.vk_oauth import (
    verify_vk_silent_token,
    exchange_vk_authorization_code_pkce,
    verify_vk_id_token,
    VKOAuthError,
)
from app.utils.referrals import generate_referral_code
from app.services.email import email_service
from app.models.email_verification import EmailVerificationToken
from app.models.password_reset import PasswordResetToken

router = APIRouter(prefix="/auth-web", tags=["Web Authentication"])
# In-memory rate limit for registrations
_register_hits: defaultdict[str, deque] = defaultdict(deque)
_REGISTER_WINDOW_SEC = 60
# Rate limit for VK PKCE endpoint
_vk_pkce_hits: defaultdict[str, deque] = defaultdict(deque)
_VK_PKCE_WINDOW_SEC = 60
_VK_PKCE_MAX_REQUESTS_PER_WINDOW = 30

# In-memory rate limit for email verification resend
_verification_resend_hits_per_user: defaultdict[int, deque] = defaultdict(deque)
_verification_resend_hits_per_ip: defaultdict[str, deque] = defaultdict(deque)
_VERIFICATION_WINDOW_SEC = 3600  # 1 hour


async def _save_pd_consent(
    db: AsyncSession,
    user: User,
    consent_version: str | None,
    source: str,
    request: Request | None,
) -> None:
    """
    Сохранить факт согласия на обработку ПДн.

    Не блокирует основной поток: ошибки пишем в лог и продолжаем.
    """
    version = consent_version or settings.PD_CONSENT_VERSION
    if not version:
        return

    ip = request.client.host if request and request.client else None
    ua = request.headers.get("User-Agent") if request else None

    # Не дублируем одинаковое согласие по email (или user_id) и версии
    if user.email:
        existing = await db.execute(
            select(UserConsent.id)
            .join(User, User.id == UserConsent.user_id)
            .where(
                User.email == user.email,
                UserConsent.consent_version == version,
            )
            .limit(1)
        )
        if existing.scalars().first():
            return
    else:
        existing = await db.execute(
            select(UserConsent.id).where(
                UserConsent.user_id == user.id,
                UserConsent.consent_version == version,
            ).limit(1)
        )
        if existing.scalars().first():
            return

    consent = UserConsent(
        user_id=user.id,
        consent_version=version,
        source=source,
        ip_address=ip,
        user_agent=ua,
    )

    db.add(consent)
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        logger = logging.getLogger(__name__)
        logger.warning("Failed to persist PD consent for user %s", user.id, exc_info=True)


def user_to_profile(user: User) -> UserProfile:
    """
    Конвертация User модели в UserProfile schema.

    Args:
        user: Объект пользователя из БД

    Returns:
        UserProfile: Pydantic модель профиля
    """
    referral_code = generate_referral_code(user.id)

    return UserProfile(
        id=user.id,
        auth_provider=user.auth_provider.value,
        email=user.email,
        email_verified=user.email_verified,
        telegram_id=user.telegram_id,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        balance_credits=user.balance_credits,
        subscription_type=user.subscription_type.value if user.subscription_type else None,
        subscription_started_at=user.subscription_started_at,
        subscription_expires_at=user.subscription_end,
        subscription_ops_limit=user.subscription_ops_limit,
        subscription_ops_used=user.subscription_ops_used,
        subscription_ops_remaining=user.actions_remaining,
        subscription_ops_reset_at=user.subscription_ops_reset_at,
        freemium_actions_used=user.freemium_actions_used,
        freemium_reset_at=user.freemium_reset_at or datetime.utcnow(),
        freemium_actions_remaining=0,
        freemium_actions_limit=0,
        can_use_freemium=False,
        free_trial_granted=user.free_trial_granted,
        is_blocked=user.is_banned,
        created_at=user.created_at,
        last_activity_at=user.updated_at,
        role=user.role,
        referral_code=referral_code,
        referred_by_id=None,  # TODO: Add через relationship позже
    )


# ============================================================================
# Email/Password Registration & Login
# ============================================================================


@router.post("/register", response_model=LoginResponse, status_code=status.HTTP_201_CREATED)
async def register_with_email(
    request: Request,
    request_body: RegisterRequest,
    db: DBSession,
) -> LoginResponse:
    """
    Регистрация нового пользователя через Email/Password.

    Args:
        request: Данные для регистрации
        db: Database session

    Returns:
        LoginResponse: JWT токен и профиль пользователя

    Raises:
        HTTPException 400: Если email уже занят или пароль слабый
    """
    # Rate limit by client IP
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    hits = _register_hits[client_ip]
    while hits and now - hits[0] > _REGISTER_WINDOW_SEC:
        hits.popleft()
    hits.append(now)
    if len(hits) > settings.REGISTER_RATE_LIMIT_PER_MINUTE:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Слишком много попыток регистрации. Попробуйте позже.",
        )

    # Domain whitelist (if configured)
    if settings.allowed_email_domains:
        domain = request_body.email.split("@")[-1].lower()
        if domain not in settings.allowed_email_domains:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Регистрация с этим доменом недоступна. Используйте разрешённый домен.",
            )

    # Проверка, что email не занят
    result = await db.execute(
        select(User).where(User.email == request_body.email)
    )
    existing_user = result.scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Дополнительная проверка силы пароля (уже есть в схеме, но на всякий случай)
    is_valid, error_msg = is_strong_password(request_body.password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg,
        )

    # Хешируем пароль
    password_hash = hash_password(request_body.password)

    # Создаём нового пользователя
    user = User(
        email=request_body.email,
        email_verified=False,  # TODO: Добавить email verification позже
        password_hash=password_hash,
        auth_provider=AuthProvider.email,
        first_name=request_body.first_name,
        last_name=request_body.last_name,
        username=request_body.email.split('@')[0],  # Временный username из email
        balance_credits=0,
        freemium_actions_used=0,
        freemium_reset_at=datetime.utcnow(),
        is_active=True,
        is_banned=False,
    )

    # Автоматическое назначение роли ADMIN, если email в whitelist
    if user.email and user.email.lower() in settings.admin_email_list:
        user.role = UserRole.ADMIN

    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Free trial кредиты (однократно)
    billing = BillingV5Service(db)
    try:
        await billing.grant_free_trial(
            user,
            meta={"reason": "email_signup"},
        )
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error("Failed to grant free trial on signup: %s", e)

    # Создаём JWT токен
    access_token = create_user_access_token(
        user_id=user.id,
        email=user.email,
    )

    # Отправляем письмо верификации (если включено)
    if settings.EMAIL_VERIFICATION_ENABLED and settings.SMTP_HOST and settings.SMTP_USER:
        try:
            from datetime import timedelta

            # Генерируем токен верификации
            token_string = secrets.token_urlsafe(32)
            expires_at = datetime.utcnow() + timedelta(minutes=settings.EMAIL_VERIFICATION_TOKEN_TTL_MIN)

            # Сохраняем токен в БД
            verification_token = EmailVerificationToken(
                user_id=user.id,
                token=token_string,
                expires_at=expires_at,
                request_ip=request.client.host if request.client else "unknown",
                user_agent=None,  # Не всегда доступно при регистрации
            )
            db.add(verification_token)
            await db.commit()

            # Отправляем email (не блокируем регистрацию если не удалось)
            user_name = user.first_name or user.username
            email_service.send_verification_email(
                to_email=user.email,
                verification_token=token_string,
                user_name=user_name,
            )
        except Exception as e:
            # Логируем ошибку, но не блокируем регистрацию
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to send verification email during registration: {e}")

    await _save_pd_consent(
        db=db,
        user=user,
        consent_version=request_body.consent_version,
        source="register",
        request=request,
    )

    # Формируем ответ
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_to_profile(user),
    )


@router.post("/login", response_model=LoginResponse, status_code=status.HTTP_200_OK)
async def login_with_email(
    raw_request: Request,
    payload: LoginRequest,
    db: DBSession,
) -> LoginResponse:
    """
    Вход через Email/Password.

    Args:
        request: Данные для входа
        db: Database session

    Returns:
        LoginResponse: JWT токен и профиль пользователя

    Raises:
        HTTPException 401: Если email не найден или пароль неверный
        HTTPException 403: Если пользователь забанен
    """
    # Ищем пользователя по email
    result = await db.execute(
        select(User).where(User.email == payload.email)
    )
    user = result.scalar_one_or_none()

    # Проверка существования пользователя
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # --- Legacy поддержка старых аккаунтов ---
    # 1) Если пароль отсутствует (старые записи) — принимаем введённый пароль и устанавливаем bcrypt.
    password_ok = False
    if not user.password_hash:
        user.password_hash = hash_password(payload.password)
        await db.commit()
        await db.refresh(user)
        password_ok = True
    else:
        # 2) Нормальная проверка bcrypt
        password_ok = verify_password(payload.password, user.password_hash)

        # 3) Легаси-хэши без bcrypt-префикса: если хранимое значение не начинается с "$2"
        #    попробуем прямое сравнение и мигрируем на bcrypt.
        if not password_ok and not user.password_hash.startswith("$2"):
            if payload.password == user.password_hash:
                user.password_hash = hash_password(payload.password)
                await db.commit()
                await db.refresh(user)
                password_ok = True

    if not password_ok:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # Автонормализация роли админа по whitelist
    if user.email and user.email.lower() in settings.admin_email_list and user.role != UserRole.ADMIN:
        user.role = UserRole.ADMIN
        await db.commit()
        await db.refresh(user)

    # Проверка, что пользователь не забанен
    if user.is_banned:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is blocked",
        )

    # Обновляем время активности
    user.updated_at = datetime.utcnow()

    # Сбрасываем Freemium счётчик, если нужно
    user.reset_freemium_if_needed()

    await db.commit()
    await db.refresh(user)

    # Создаём JWT токен
    access_token = create_user_access_token(
        user_id=user.id,
        email=user.email,
    )

    await _save_pd_consent(
        db=db,
        user=user,
        consent_version=payload.consent_version,
        source="login",
        request=raw_request,
    )

    # Формируем ответ
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_to_profile(user),
    )


@router.post("/password-reset/request", response_model=PasswordResetResponse)
async def request_password_reset(
    request: Request,
    payload: PasswordResetRequest,
    db: DBSession,
    background_tasks: BackgroundTasks,
) -> PasswordResetResponse:
    """
    Запросить письмо для сброса пароля.

    Возвращает одинаковый ответ независимо от существования email.
    """
    if not email_service.is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Сервис отправки email не настроен. Попробуйте позже.",
        )

    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    # Всегда возвращаем одинаковый ответ, чтобы не раскрывать наличие аккаунта
    if not user:
        return PasswordResetResponse(
            message="Если email зарегистрирован, мы отправили ссылку для сброса пароля."
        )

    # Помечаем предыдущие токены как использованные
    now = datetime.utcnow()
    existing_tokens = await db.execute(
        select(PasswordResetToken).where(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.consumed_at.is_(None),
        )
    )
    for token in existing_tokens.scalars().all():
        token.consumed_at = now

    token_string = secrets.token_urlsafe(32)
    expires_at = now + timedelta(minutes=settings.PASSWORD_RESET_TOKEN_TTL_MIN)

    reset_token = PasswordResetToken(
        user_id=user.id,
        token=token_string,
        expires_at=expires_at,
        request_ip=request.client.host if request.client else "unknown",
        user_agent=request.headers.get("User-Agent"),
    )
    db.add(reset_token)
    await db.commit()

    user_name = user.first_name or user.username
    background_tasks.add_task(
        email_service.send_password_reset_email,
        to_email=user.email,
        reset_token=token_string,
        user_name=user_name,
    )

    return PasswordResetResponse(
        message="Если email зарегистрирован, мы отправили ссылку для сброса пароля."
    )


@router.post("/password-reset/confirm", response_model=PasswordResetConfirmResponse)
async def confirm_password_reset(
    payload: PasswordResetConfirmRequest,
    db: DBSession,
) -> PasswordResetConfirmResponse:
    """
    Подтвердить сброс пароля по токену.
    """
    result = await db.execute(
        select(PasswordResetToken).where(PasswordResetToken.token == payload.token)
    )
    reset_token = result.scalar_one_or_none()

    if not reset_token or not reset_token.is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Некорректный или истёкший токен",
        )

    user = await db.get(User, reset_token.user_id)
    if not user or not user.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Некорректный токен",
        )

    user.password_hash = hash_password(payload.new_password)
    if not user.email_verified:
        user.email_verified = True
        user.email_verified_at = datetime.utcnow()

    reset_token.consumed_at = datetime.utcnow()
    await db.commit()

    return PasswordResetConfirmResponse(
        message="Пароль обновлён. Войдите с новым паролем."
    )


# ============================================================================
# Google OAuth
# ============================================================================


@router.post("/google", response_model=GoogleOAuthResponse, status_code=status.HTTP_200_OK)
async def login_with_google(
    request: GoogleOAuthRequest,
    db: DBSession,
    raw_request: Request,
) -> GoogleOAuthResponse:
    """
    Вход/Регистрация через Google OAuth.

    Args:
        request: Google ID token
        db: Database session

    Returns:
        GoogleOAuthResponse: JWT токен, профиль пользователя, флаг is_new_user

    Raises:
        HTTPException 401: Если Google ID token невалидный
        HTTPException 403: Если пользователь забанен
        HTTPException 503: Если Google OAuth не настроен
    """
    # Проверка настройки Google OAuth
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth is not configured. Please use email/password authentication.",
        )

    # Валидация Google ID token
    try:
        google_user_info = verify_google_id_token(request.id_token)
    except GoogleOAuthError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Google ID token: {str(e)}",
        )

    # Извлекаем данные из Google
    google_sub = google_user_info['sub']
    email = google_user_info.get('email')
    email_verified = google_user_info.get('email_verified', False)
    first_name = google_user_info.get('given_name')
    last_name = google_user_info.get('family_name')
    full_name = google_user_info.get('name')

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email not provided by Google. Please allow email access.",
        )

    # Ищем существующего пользователя по Google ID или email
    result = await db.execute(
        select(User).where(
            (User.oauth_provider_id == google_sub) |
            (User.email == email)
        )
    )
    user = result.scalar_one_or_none()

    is_new_user = False

    if user:
        # Обновляем существующего пользователя
        # Если пользователь был с email/password, переключаем на Google OAuth
        if user.auth_provider == AuthProvider.email:
            user.auth_provider = AuthProvider.google
            user.oauth_provider_id = google_sub

        # Обновляем данные профиля
        user.email = email
        user.email_verified = email_verified
        user.first_name = first_name or user.first_name
        user.last_name = last_name or user.last_name
        user.updated_at = datetime.utcnow()

        # Автоназначение роли ADMIN по whitelist
        if user.email and user.email.lower() in settings.admin_email_list and user.role != UserRole.ADMIN:
            user.role = UserRole.ADMIN

        # Сбрасываем Freemium счётчик, если нужно
        user.reset_freemium_if_needed()

        await db.commit()
        await db.refresh(user)

    else:
        # Создаём нового пользователя
        is_new_user = True

        user = User(
            email=email,
            email_verified=email_verified,
            auth_provider=AuthProvider.google,
            oauth_provider_id=google_sub,
            first_name=first_name,
            last_name=last_name,
            username=email.split('@')[0],  # Временный username из email
            balance_credits=0,
            freemium_actions_used=0,
            freemium_reset_at=datetime.utcnow(),
            is_active=True,
            is_banned=False,
        )

        # Автоназначение роли ADMIN по whitelist
        if user.email and user.email.lower() in settings.admin_email_list:
            user.role = UserRole.ADMIN

        db.add(user)
        await db.commit()
        await db.refresh(user)

        billing = BillingV5Service(db)
        try:
            await billing.grant_free_trial(user, meta={"reason": "google_oauth"})
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error("Failed to grant free trial (google): %s", e)

    # Проверка, что пользователь не забанен
    if user.is_banned:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is blocked",
        )

    # Создаём JWT токен
    access_token = create_user_access_token(
        user_id=user.id,
        email=user.email,
    )

    await _save_pd_consent(
        db=db,
        user=user,
        consent_version=request.consent_version,
        source="google",
        request=raw_request,
    )

    # Формируем ответ
    return GoogleOAuthResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_to_profile(user),
        is_new_user=is_new_user,
    )


# ============================================================================
# VK ID OAuth
# ============================================================================


@router.post("/vk/pkce", response_model=VKOAuthResponse, status_code=status.HTTP_200_OK)
async def login_with_vk_pkce(
    request: VKOAuthPKCERequest,
    db: DBSession,
    raw_request: Request,
) -> VKOAuthResponse:
    """
    Вход/Регистрация через VK ID OAuth 2.1 (PKCE).

    Args:
        request: Authorization code, code_verifier, redirect_uri, device_id
        db: Database session

    Returns:
        VKOAuthResponse: JWT токен, профиль пользователя, флаг is_new_user
    """
    if not settings.VK_APP_ID or not settings.VK_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="VK OAuth is not configured. Please use email/password authentication.",
        )

    # Rate limit по client IP
    client_ip = raw_request.client.host if raw_request.client else "unknown"
    now = time.time()
    hits = _vk_pkce_hits[client_ip]
    while hits and now - hits[0] > _VK_PKCE_WINDOW_SEC:
        hits.popleft()
    hits.append(now)
    if len(hits) > _VK_PKCE_MAX_REQUESTS_PER_WINDOW:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Слишком много попыток входа через VK ID. Попробуйте позже.",
        )

    # Обмен кода на токены
    try:
        token_payload = exchange_vk_authorization_code_pkce(
            code=request.code,
            code_verifier=request.code_verifier,
            redirect_uri=request.redirect_uri,
            device_id=request.device_id,
        )
    except VKOAuthError as e:
        # Простое логирование для трассировки ошибок обмена кода
        print(f"[VK_PKCE] code exchange failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid VK authorization code: {str(e)}",
        )

    access_token = token_payload.get("access_token")
    refresh_token = token_payload.get("refresh_token")
    expires_in = token_payload.get("expires_in")
    if not access_token:
        print(f"[VK_PKCE] missing access_token in response: {token_payload}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="VK OAuth response missing access_token",
        )

    # Верифицируем id_token подпись, aud/iss и nonce, если пришёл
    id_token = token_payload.get("id_token")
    if id_token:
        try:
            verify_vk_id_token(id_token, expected_nonce=request.nonce)
        except VKOAuthError as e:
            # VK JWKS endpoint у VK ID периодически отвечает 404; не блокируем вход, если access_token валиден
            print(f"[VK_PKCE] id_token verification failed (will continue with access_token): {e}")

    # Получаем профиль пользователя через user_info endpoint
    try:
        vk_user_info = verify_vk_silent_token(access_token, request.device_id or "")
    except VKOAuthError as e:
        print(f"[VK_PKCE] user_info fetch failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid VK token: {str(e)}",
        )

    if not vk_user_info:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="VK user info is empty",
        )

    vk_user_id = vk_user_info.get("user_id") or token_payload.get("user_id")
    email = vk_user_info.get("email")  # Может быть None
    first_name = vk_user_info.get("first_name")
    last_name = vk_user_info.get("last_name")

    if not vk_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="VK user ID not provided by VK.",
        )

    vk_user_id_str = str(vk_user_id)

    if email:
        result = await db.execute(
            select(User).where(
                (User.oauth_provider_id == vk_user_id_str) |
                (User.email == email)
            )
        )
    else:
        result = await db.execute(
            select(User).where(User.oauth_provider_id == vk_user_id_str)
        )

    user = result.scalar_one_or_none()

    is_new_user = False

    if user:
        if user.auth_provider == AuthProvider.email:
            user.auth_provider = AuthProvider.vk
            user.oauth_provider_id = vk_user_id_str

        if email:
            user.email = email

        # VK подтверждает личность — считаем аккаунт верифицированным,
        # даже если пользователь не отдал email
        if not user.email_verified:
            user.email_verified = True
            user.email_verified_at = datetime.utcnow()
        elif not user.email_verified_at:
            user.email_verified_at = datetime.utcnow()

        user.first_name = first_name or user.first_name
        user.last_name = last_name or user.last_name
        user.updated_at = datetime.utcnow()
        if refresh_token:
            user.oauth_refresh_token = refresh_token
        if expires_in:
            user.oauth_access_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)

        if user.email and user.email.lower() in settings.admin_email_list and user.role != UserRole.ADMIN:
            user.role = UserRole.ADMIN

        user.reset_freemium_if_needed()

        await db.commit()
        await db.refresh(user)

    else:
        is_new_user = True
        username = f"{first_name}_{vk_user_id}" if first_name else f"vk_user_{vk_user_id}"

        user = User(
            email=email,
            # Считаем VK-пользователя верифицированным, даже если email не выдан
            email_verified=True,
            email_verified_at=datetime.utcnow(),
            auth_provider=AuthProvider.vk,
            oauth_provider_id=vk_user_id_str,
            oauth_refresh_token=refresh_token,
            oauth_access_expires_at=(datetime.utcnow() + timedelta(seconds=expires_in)) if expires_in else None,
            first_name=first_name,
            last_name=last_name,
            username=username,
            balance_credits=0,
            freemium_actions_used=0,
            freemium_reset_at=datetime.utcnow(),
            is_active=True,
            is_banned=False,
        )

        if user.email and user.email.lower() in settings.admin_email_list:
            user.role = UserRole.ADMIN

        db.add(user)
        await db.commit()
        await db.refresh(user)

        billing = BillingV5Service(db)
        try:
            await billing.grant_free_trial(user, meta={"reason": "vk_oauth"})
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error("Failed to grant free trial (vk): %s", e)

    if user.is_banned:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is blocked",
        )

    access_token_jwt = create_user_access_token(
        user_id=user.id,
        email=user.email,
    )

    await _save_pd_consent(
        db=db,
        user=user,
        consent_version=request.consent_version,
        source="vk_pkce",
        request=raw_request,
    )

    return VKOAuthResponse(
        access_token=access_token_jwt,
        token_type="bearer",
        user=user_to_profile(user),
        is_new_user=is_new_user,
    )


@router.post("/vk", response_model=VKOAuthResponse, status_code=status.HTTP_200_OK)
async def login_with_vk(
    request: VKOAuthRequest,
    db: DBSession,
    raw_request: Request,
) -> VKOAuthResponse:
    """
    Вход/Регистрация через VK ID OAuth.

    Args:
        request: VK ID silent token и UUID устройства
        db: Database session

    Returns:
        VKOAuthResponse: JWT токен, профиль пользователя, флаг is_new_user

    Raises:
        HTTPException 401: Если VK ID token невалидный
        HTTPException 403: Если пользователь забанен
        HTTPException 503: Если VK OAuth не настроен
    """
    # Проверка настройки VK OAuth
    if not settings.VK_APP_ID or not settings.VK_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="VK OAuth is not configured. Please use email/password authentication.",
        )

    # Валидация VK ID silent token
    try:
        vk_user_info = verify_vk_silent_token(request.token, request.uuid)
    except VKOAuthError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid VK ID token: {str(e)}",
        )

    # Извлекаем данные из VK
    vk_user_id = vk_user_info['user_id']
    email = vk_user_info.get('email')  # Может быть None
    first_name = vk_user_info.get('first_name')
    last_name = vk_user_info.get('last_name')

    if not vk_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="VK user ID not provided by VK.",
        )

    # Конвертируем VK user_id в строку для хранения в oauth_provider_id
    vk_user_id_str = str(vk_user_id)

    # Ищем существующего пользователя по VK ID или email (если email есть)
    if email:
        result = await db.execute(
            select(User).where(
                (User.oauth_provider_id == vk_user_id_str) |
                (User.email == email)
            )
        )
    else:
        # Если email нет, ищем только по VK ID
        result = await db.execute(
            select(User).where(User.oauth_provider_id == vk_user_id_str)
        )

    user = result.scalar_one_or_none()

    is_new_user = False

    if user:
        # Обновляем существующего пользователя
        # Если пользователь был с email/password, переключаем на VK OAuth
        if user.auth_provider == AuthProvider.email:
            user.auth_provider = AuthProvider.vk
            user.oauth_provider_id = vk_user_id_str

        # Обновляем данные профиля
        if email:
            user.email = email

        # VK подтверждает личность — считаем аккаунт верифицированным,
        # даже если email не отдан
        if not user.email_verified:
            user.email_verified = True
            user.email_verified_at = datetime.utcnow()
        elif not user.email_verified_at:
            user.email_verified_at = datetime.utcnow()

        user.first_name = first_name or user.first_name
        user.last_name = last_name or user.last_name
        user.updated_at = datetime.utcnow()

        # Автоназначение роли ADMIN по whitelist (если email есть)
        if user.email and user.email.lower() in settings.admin_email_list and user.role != UserRole.ADMIN:
            user.role = UserRole.ADMIN

        # Сбрасываем Freemium счётчик, если нужно
        user.reset_freemium_if_needed()

        await db.commit()
        await db.refresh(user)

    else:
        # Создаём нового пользователя
        is_new_user = True

        # Генерируем username из имени или VK ID
        if first_name:
            username = f"{first_name}_{vk_user_id}"
        else:
            username = f"vk_user_{vk_user_id}"

        user = User(
            email=email,  # Может быть None
            email_verified=True,  # VK подтверждает личность, даже без email
            email_verified_at=datetime.utcnow(),
            auth_provider=AuthProvider.vk,
            oauth_provider_id=vk_user_id_str,
            first_name=first_name,
            last_name=last_name,
            username=username,
            balance_credits=0,
            freemium_actions_used=0,
            freemium_reset_at=datetime.utcnow(),
            is_active=True,
            is_banned=False,
        )

        # Автоназначение роли ADMIN по whitelist (если email есть)
        if user.email and user.email.lower() in settings.admin_email_list:
            user.role = UserRole.ADMIN

        db.add(user)
        await db.commit()
        await db.refresh(user)

        billing = BillingV5Service(db)
        try:
            await billing.grant_free_trial(user, meta={"reason": "vk_oauth_pkce"})
        except Exception as e:
            logger = logging.getLogger(__name__)
            logger.error("Failed to grant free trial (vk pkce): %s", e)

    # Проверка, что пользователь не забанен
    if user.is_banned:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is blocked",
        )

    # Создаём JWT токен
    access_token = create_user_access_token(
        user_id=user.id,
        email=user.email,  # Может быть None, но это ок
    )

    await _save_pd_consent(
        db=db,
        user=user,
        consent_version=request.consent_version,
        source="vk",
        request=raw_request,
    )

    # Формируем ответ
    return VKOAuthResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_to_profile(user),
        is_new_user=is_new_user,
    )


# ============================================================================
# Current User Profile
# ============================================================================


@router.get("/me", response_model=UserProfileResponse, status_code=status.HTTP_200_OK)
async def get_current_user_profile(
    current_user: CurrentUser,
) -> UserProfileResponse:
    """
    Получение профиля текущего авторизованного пользователя.

    Args:
        current_user: Текущий пользователь из JWT токена

    Returns:
        UserProfileResponse: Профиль пользователя
    """
    return UserProfileResponse(
        user=user_to_profile(current_user)
    )


# ============================================================================
# Email Verification
# ============================================================================


@router.post("/send-verification", response_model=SendVerificationEmailResponse, status_code=status.HTTP_200_OK)
async def send_verification_email(
    request: Request,
    current_user: CurrentUser,
    db: DBSession,
) -> SendVerificationEmailResponse:
    """
    Отправить письмо для верификации email.

    Args:
        request: FastAPI Request (для получения IP)
        current_user: Текущий пользователь из JWT токена
        db: Database session

    Returns:
        SendVerificationEmailResponse: Сообщение об успешной отправке

    Raises:
        HTTPException 400: Если email уже подтверждён
        HTTPException 429: Если превышен лимит отправки
        HTTPException 503: Если email verification отключена
    """
    # Проверка, что email verification включена
    if not settings.EMAIL_VERIFICATION_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Email verification is disabled",
        )

    # Проверка, что у пользователя есть email
    if not current_user.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User does not have an email address",
        )

    # Если email уже подтверждён
    if current_user.email_verified:
        return SendVerificationEmailResponse(
            message="Email уже подтверждён"
        )

    # Проверка конфигурации SMTP заранее, чтобы не падать 500
    if not email_service.is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Сервис отправки email не настроен. Попробуйте позже или свяжитесь с поддержкой.",
        )

    # Rate limit по user_id
    now = time.time()
    user_hits = _verification_resend_hits_per_user[current_user.id]
    while user_hits and now - user_hits[0] > _VERIFICATION_WINDOW_SEC:
        user_hits.popleft()
    if len(user_hits) >= settings.EMAIL_VERIFICATION_RESEND_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Вы можете отправить не более {settings.EMAIL_VERIFICATION_RESEND_LIMIT} писем в час",
        )

    # Rate limit по IP
    client_ip = request.client.host if request.client else "unknown"
    ip_hits = _verification_resend_hits_per_ip[client_ip]
    while ip_hits and now - ip_hits[0] > _VERIFICATION_WINDOW_SEC:
        ip_hits.popleft()
    if len(ip_hits) >= settings.EMAIL_VERIFICATION_RESEND_PER_IP_PER_HOUR:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Слишком много запросов с вашего IP. Попробуйте позже",
        )

    # Инвалидируем предыдущие активные токены пользователя
    result = await db.execute(
        select(EmailVerificationToken).where(
            EmailVerificationToken.user_id == current_user.id,
            EmailVerificationToken.consumed_at.is_(None),
        )
    )
    old_tokens = result.scalars().all()
    for old_token in old_tokens:
        old_token.consumed_at = datetime.utcnow()
    await db.commit()

    # Генерируем новый токен
    from datetime import timedelta
    token_string = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(minutes=settings.EMAIL_VERIFICATION_TOKEN_TTL_MIN)

    # Сохраняем токен в БД
    verification_token = EmailVerificationToken(
        user_id=current_user.id,
        token=token_string,
        expires_at=expires_at,
        request_ip=client_ip,
        user_agent=request.headers.get("User-Agent"),
    )
    db.add(verification_token)
    await db.commit()

    # Отправляем email
    user_name = current_user.first_name or current_user.username
    email_sent = email_service.send_verification_email(
        to_email=current_user.email,
        verification_token=token_string,
        user_name=user_name,
    )

    if not email_sent:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Не удалось отправить письмо. Попробуйте позже или обратитесь в поддержку.",
        )

    # Обновляем rate limits
    user_hits.append(now)
    ip_hits.append(now)

    return SendVerificationEmailResponse(
        message="Письмо для подтверждения отправлено на ваш email"
    )


@router.get("/verify", response_model=VerifyEmailResponse, status_code=status.HTTP_200_OK)
async def verify_email(
    token: str,
    db: DBSession,
) -> VerifyEmailResponse:
    """
    Верифицировать email по токену.

    Args:
        token: Токен верификации из email
        db: Database session

    Returns:
        VerifyEmailResponse: Сообщение об успешной верификации и обновлённый профиль

    Raises:
        HTTPException 400: Если токен невалиден, истёк или уже использован
        HTTPException 404: Если токен не найден
    """
    logger = logging.getLogger(__name__)
    token_preview = f"{token[:8]}..." if token else "missing"

    # Ищем токен
    result = await db.execute(
        select(EmailVerificationToken).where(
            EmailVerificationToken.token == token
        )
    )
    verification_token = result.scalar_one_or_none()

    if not verification_token:
        logger.warning("Email verification token not found: %s", token_preview)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Токен не найден",
        )

    # Проверяем, не использован ли токен
    if verification_token.is_consumed:
        result = await db.execute(
            select(User).where(User.id == verification_token.user_id)
        )
        user = result.scalar_one_or_none()
        if user and user.email_verified:
            logger.info("Email already verified, token reused: %s", token_preview)
            return VerifyEmailResponse(
                message="Email уже подтверждён",
                user=user_to_profile(user),
            )

        logger.warning("Email verification token already used: %s", token_preview)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Токен уже использован",
        )

    # Проверяем, не истёк ли токен
    if verification_token.is_expired:
        logger.warning("Email verification token expired: %s", token_preview)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Срок действия токена истёк. Запросите новое письмо",
        )

    # Получаем пользователя
    result = await db.execute(
        select(User).where(User.id == verification_token.user_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        logger.error("Email verification user not found for token: %s", token_preview)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден",
        )

    # Обновляем пользователя
    user.email_verified = True
    user.email_verified_at = datetime.utcnow()

    # Помечаем токен как использованный
    verification_token.consumed_at = datetime.utcnow()

    await db.commit()
    await db.refresh(user)

    access_token = create_user_access_token(
        user_id=user.id,
        telegram_id=user.telegram_id,
        email=user.email,
    )

    return VerifyEmailResponse(
        message="Email успешно подтверждён",
        user=user_to_profile(user),
        access_token=access_token,
        token_type="bearer",
    )
