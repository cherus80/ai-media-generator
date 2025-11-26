"""
API endpoints для админки.

Endpoints:
- GET /api/v1/admin/dashboard/stats — общая статистика (защищено role=ADMIN)
- GET /api/v1/admin/dashboard/user-registrations — динамика регистраций (защищено role=ADMIN)
- GET /api/v1/admin/dashboard/user-activity — активность пользователей (защищено role=ADMIN)
- GET /api/v1/admin/users — список пользователей (защищено role=ADMIN)
- GET /api/v1/admin/users/{user_id} — детали пользователя (защищено role=ADMIN)
- POST /api/v1/admin/users/{user_id}/add-credits — начислить кредиты (защищено role=ADMIN)
- GET /api/v1/admin/referrals/stats — статистика рефералов (защищено role=ADMIN)
- GET /api/v1/admin/export/users — экспорт пользователей CSV (защищено role=ADMIN)
- GET /api/v1/admin/export/payments — экспорт платежей CSV/JSON (защищено role=ADMIN)
- GET /api/v1/admin/export/generations — экспорт генераций CSV (защищено role=ADMIN)
"""

import csv
import io
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response
import sqlalchemy as sa
from sqlalchemy import and_, func, select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import AdminUser, SuperAdminUser, DBSession, get_current_admin
from app.core.config import settings
from app.db.session import get_db
from app.models import ChatHistory, Generation, Payment, Referral, User
from app.schemas.admin import (
    AddCreditsRequest,
    AddCreditsResponse,
    AdminChartsData,
    AdminStats,
    AdminUsersRequest,
    AdminUsersResponse,
    AdminUserItem,
    ChartDataPoint,
    DeleteUserResponse,
    MakeAdminRequest,
    MakeAdminResponse,
    PaymentExportItem,
    PaymentExportRequest,
    PaymentExportResponse,
    ReferralStatsItem,
    ReferralStatsResponse,
    TopUserByGenerations,
    UserActivityStats,
    UserDetailsResponse,
    UserRegistrationData,
)
from app.utils.tax import (
    calculate_npd_tax,
    calculate_yukassa_commission,
    calculate_net_amount,
)

router = APIRouter()


# ============================================================================
# Dashboard Статистика
# ============================================================================

@router.get("/dashboard/stats", response_model=AdminStats)
async def get_dashboard_stats(
    admin: AdminUser,
    db: DBSession,
) -> AdminStats:
    """
    Получить общую статистику приложения.

    Требует роль: ADMIN
    """
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)
    month_start = today_start - timedelta(days=30)

    # Пользователи
    total_users = await db.scalar(select(func.count(User.id)))

    active_users_today = await db.scalar(
        select(func.count(User.id)).where(User.last_active_at >= today_start)
    )
    active_users_week = await db.scalar(
        select(func.count(User.id)).where(User.last_active_at >= week_start)
    )
    active_users_month = await db.scalar(
        select(func.count(User.id)).where(User.last_active_at >= month_start)
    )

    new_users_today = await db.scalar(
        select(func.count(User.id)).where(User.created_at >= today_start)
    )
    new_users_week = await db.scalar(
        select(func.count(User.id)).where(User.created_at >= week_start)
    )
    new_users_month = await db.scalar(
        select(func.count(User.id)).where(User.created_at >= month_start)
    )

    # Генерации
    total_generations = await db.scalar(select(func.count(Generation.id)))
    generations_today = await db.scalar(
        select(func.count(Generation.id)).where(Generation.created_at >= today_start)
    )
    generations_week = await db.scalar(
        select(func.count(Generation.id)).where(Generation.created_at >= week_start)
    )
    generations_month = await db.scalar(
        select(func.count(Generation.id)).where(Generation.created_at >= month_start)
    )

    fitting_generations = await db.scalar(
        select(func.count(Generation.id)).where(Generation.type == "fitting")
    )
    editing_generations = await db.scalar(
        select(func.count(Generation.id)).where(Generation.type == "editing")
    )

    # Платежи
    total_payments = await db.scalar(select(func.count(Payment.id)))
    successful_payments = await db.scalar(
        select(func.count(Payment.id)).where(Payment.status == "succeeded")
    )

    total_revenue_result = await db.scalar(
        select(func.sum(Payment.amount)).where(Payment.status == "succeeded")
    )
    total_revenue = total_revenue_result or Decimal("0")

    revenue_today_result = await db.scalar(
        select(func.sum(Payment.amount)).where(
            and_(Payment.status == "succeeded", Payment.created_at >= today_start)
        )
    )
    revenue_today = revenue_today_result or Decimal("0")

    revenue_week_result = await db.scalar(
        select(func.sum(Payment.amount)).where(
            and_(Payment.status == "succeeded", Payment.created_at >= week_start)
        )
    )
    revenue_week = revenue_week_result or Decimal("0")

    revenue_month_result = await db.scalar(
        select(func.sum(Payment.amount)).where(
            and_(Payment.status == "succeeded", Payment.created_at >= month_start)
        )
    )
    revenue_month = revenue_month_result or Decimal("0")

    average_payment = (
        total_revenue / successful_payments if successful_payments > 0 else Decimal("0")
    )

    # Подписки
    active_subscriptions_basic = await db.scalar(
        select(func.count(User.id)).where(
            and_(
                User.subscription_type == "basic",
                User.subscription_end > now
            )
        )
    )
    active_subscriptions_pro = await db.scalar(
        select(func.count(User.id)).where(
            and_(
                User.subscription_type == "pro",
                User.subscription_end > now
            )
        )
    )
    active_subscriptions_premium = await db.scalar(
        select(func.count(User.id)).where(
            and_(
                User.subscription_type == "premium",
                User.subscription_end > now
            )
        )
    )

    # Рефералы
    total_referrals = await db.scalar(select(func.count(Referral.id)))
    active_referrals = await db.scalar(
        select(func.count(Referral.id)).where(Referral.is_awarded == True)
    )

    # Freemium
    freemium_users = await db.scalar(
        select(func.count(User.id)).where(User.freemium_actions_used < 10)
    )
    freemium_generations_today = await db.scalar(
        select(func.count(Generation.id)).where(
            and_(
                Generation.has_watermark == True,
                Generation.created_at >= today_start
            )
        )
    )

    return AdminStats(
        total_users=total_users or 0,
        active_users_today=active_users_today or 0,
        active_users_week=active_users_week or 0,
        active_users_month=active_users_month or 0,
        new_users_today=new_users_today or 0,
        new_users_week=new_users_week or 0,
        new_users_month=new_users_month or 0,
        total_generations=total_generations or 0,
        generations_today=generations_today or 0,
        generations_week=generations_week or 0,
        generations_month=generations_month or 0,
        fitting_generations=fitting_generations or 0,
        editing_generations=editing_generations or 0,
        total_payments=total_payments or 0,
        successful_payments=successful_payments or 0,
        total_revenue=total_revenue,
        revenue_today=revenue_today,
        revenue_week=revenue_week,
        revenue_month=revenue_month,
        average_payment=average_payment,
        active_subscriptions_basic=active_subscriptions_basic or 0,
        active_subscriptions_pro=active_subscriptions_pro or 0,
        active_subscriptions_premium=active_subscriptions_premium or 0,
        total_referrals=total_referrals or 0,
        active_referrals=active_referrals or 0,
        freemium_users=freemium_users or 0,
        freemium_generations_today=freemium_generations_today or 0,
    )


# ============================================================================
# GET /api/v1/admin/dashboard/user-registrations — Динамика регистраций
# ============================================================================

@router.get("/dashboard/user-registrations", response_model=list[UserRegistrationData])
async def get_user_registrations(
    admin: AdminUser,
    db: DBSession,
    days: int = Query(default=30, ge=1, le=365, description="Количество дней для статистики"),
) -> list[UserRegistrationData]:
    """
    Получить динамику регистраций пользователей по дням.

    Требует роль: ADMIN
    """
    now = datetime.now(timezone.utc)
    days_ago = now - timedelta(days=days)

    # График новых пользователей по дням
    users_data = await db.execute(
        select(
            func.date(User.created_at).label("date"),
            func.count(User.id).label("count")
        )
        .where(User.created_at >= days_ago)
        .group_by(func.date(User.created_at))
        .order_by(func.date(User.created_at))
    )

    return [
        UserRegistrationData(date=str(row.date), count=row.count)
        for row in users_data.all()
    ]


# ============================================================================
# GET /api/v1/admin/dashboard/user-activity — Активность пользователей
# ============================================================================

@router.get("/dashboard/user-activity", response_model=UserActivityStats)
async def get_user_activity(
    admin: AdminUser,
    db: DBSession,
) -> UserActivityStats:
    """
    Получить статистику активности пользователей.

    Требует роль: ADMIN
    """
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)
    month_start = today_start - timedelta(days=30)

    # Активные пользователи
    active_today = await db.scalar(
        select(func.count(User.id)).where(User.last_active_at >= today_start)
    ) or 0

    active_this_week = await db.scalar(
        select(func.count(User.id)).where(User.last_active_at >= week_start)
    ) or 0

    active_this_month = await db.scalar(
        select(func.count(User.id)).where(User.last_active_at >= month_start)
    ) or 0

    # Топ 10 пользователей по генерациям
    top_users_data = await db.execute(
        select(
            User.id,
            User.email,
            User.username,
            func.count(Generation.id).label("generations_count")
        )
        .join(Generation, User.id == Generation.user_id)
        .group_by(User.id, User.email, User.username)
        .order_by(func.count(Generation.id).desc())
        .limit(10)
    )

    top_users = [
        TopUserByGenerations(
            id=row.id,
            email=row.email,
            username=row.username,
            generations_count=row.generations_count
        )
        for row in top_users_data.all()
    ]

    # Средн количество генераций на пользователя
    total_users = await db.scalar(select(func.count(User.id))) or 1
    total_generations = await db.scalar(select(func.count(Generation.id))) or 0
    avg_generations = total_generations / total_users if total_users > 0 else 0.0

    # Всего потрачено кредитов (по полю credits_spent в Generation)
    total_credits_result = await db.scalar(
        select(func.sum(Generation.credits_spent))
    )
    total_credits_spent = int(total_credits_result or 0)

    return UserActivityStats(
        active_today=active_today,
        active_this_week=active_this_week,
        active_this_month=active_this_month,
        top_users=top_users,
        avg_generations_per_user=avg_generations,
        total_credits_spent=total_credits_spent,
    )


# ============================================================================
# GET /api/v1/admin/users — Список пользователей
# ============================================================================

@router.get("/users", response_model=AdminUsersResponse)
async def get_admin_users(
    admin: AdminUser,
    db: DBSession,
    page: int = Query(default=1, ge=1, description="Номер страницы"),
    page_size: int = Query(default=50, ge=1, le=200, description="Размер страницы"),
    sort_by: str = Query(default="created_at", description="Поле для сортировки"),
    order: str = Query(default="desc", description="Порядок сортировки (asc/desc)"),
    search: str | None = Query(default=None, description="Поиск по email/username/telegram_id"),
    filter_subscription: str | None = Query(default=None, description="Фильтр по подписке"),
    filter_active: bool | None = Query(default=None, description="Фильтр по активности"),
    role: str | None = Query(default=None, description="Фильтр по роли (USER/ADMIN/SUPER_ADMIN)"),
) -> AdminUsersResponse:
    """
    Получить список пользователей с фильтрацией и пагинацией.

    Требует роль: ADMIN
    """
    now = datetime.now(timezone.utc)
    month_ago = now - timedelta(days=30)

    # Базовый запрос
    query = select(User)

    # Фильтрация по поиску (по email, username, telegram_id)
    if search:
        query = query.where(
            or_(
                User.email.ilike(f"%{search}%"),
                User.username.ilike(f"%{search}%"),
                func.cast(User.telegram_id, sa.String).ilike(f"%{search}%")
            )
        )

    # Фильтрация по подписке
    if filter_subscription:
        query = query.where(User.subscription_type == filter_subscription)

    # Фильтрация по активности
    if filter_active is not None:
        if filter_active:
            query = query.where(User.last_active_at >= month_ago)
        else:
            query = query.where(
                (User.last_active_at < month_ago) | (User.last_active_at.is_(None))
            )

    # Фильтрация по роли
    if role:
        from app.models.user import UserRole
        try:
            user_role = UserRole(role)
            query = query.where(User.role == user_role)
        except ValueError:
            # Если передана некорректная роль, игнорируем фильтр
            pass

    # Сортировка
    if order == "desc":
        query = query.order_by(getattr(User, sort_by).desc())
    else:
        query = query.order_by(getattr(User, sort_by).asc())

    # Подсчёт общего количества
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query) or 0

    # Пагинация
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)

    result = await db.execute(query)
    users = result.scalars().all()

    # Формирование ответа с дополнительными данными
    user_items = []
    for user in users:
        # Подсчёт генераций пользователя
        total_generations = await db.scalar(
            select(func.count(Generation.id)).where(Generation.user_id == user.id)
        ) or 0

        # Подсчёт потраченных денег
        total_spent_result = await db.scalar(
            select(func.sum(Payment.amount)).where(
                and_(Payment.user_id == user.id, Payment.status == "succeeded")
            )
        )
        total_spent = total_spent_result or Decimal("0")

        # Подсчёт рефералов
        referrals_count = await db.scalar(
            select(func.count(Referral.id)).where(Referral.referrer_id == user.id)
        ) or 0

        # Проверка активности
        is_active = user.last_active_at is not None and user.last_active_at >= month_ago

        user_items.append(
            AdminUserItem(
                id=user.id,
                email=user.email,
                telegram_id=user.telegram_id,
                username=user.username,
                first_name=user.first_name,
                last_name=user.last_name,
                balance_credits=user.balance_credits,
                subscription_type=user.subscription_type,
                subscription_expires_at=user.subscription_end,
                freemium_actions_remaining=10 - user.freemium_actions_used if user.can_use_freemium else 0,
                freemium_reset_at=user.freemium_reset_at,
                created_at=user.created_at,
                last_active_at=user.last_active_at,
                role=user.role.value if user.role else "user",
                total_generations=total_generations,
                total_spent=total_spent,
                referrals_count=referrals_count,
                is_active=is_active,
            )
        )

    total_pages = (total + page_size - 1) // page_size

    return AdminUsersResponse(
        users=user_items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


# ============================================================================
# GET /api/v1/admin/export/payments — Экспорт платежей
# ============================================================================

@router.get("/export/payments")
async def export_payments(
    admin: AdminUser,
    db: DBSession,
    date_from: datetime | None = Query(default=None, description="Начальная дата"),
    date_to: datetime | None = Query(default=None, description="Конечная дата"),
    status: str = Query(default="succeeded", description="Статус платежа"),
    format: str = Query(default="csv", description="Формат экспорта (csv/json)"),
):
    """
    Экспортировать платежи в CSV или JSON.

    Требует роль: ADMIN
    """
    # Базовый запрос
    query = (
        select(Payment, User)
        .join(User, Payment.user_id == User.id)
        .where(Payment.status == status)
    )

    if date_from:
        query = query.where(Payment.created_at >= date_from)
    if date_to:
        query = query.where(Payment.created_at <= date_to)

    query = query.order_by(Payment.created_at.desc())

    result = await db.execute(query)
    rows = result.all()

    # Формирование данных
    export_items = []
    total_amount = Decimal("0")
    total_npd_tax = Decimal("0")
    total_yukassa_commission = Decimal("0")
    total_net_amount = Decimal("0")

    for payment, user in rows:
        npd_tax = calculate_npd_tax(payment.amount)
        yukassa_commission = calculate_yukassa_commission(payment.amount)
        net_amount = calculate_net_amount(payment.amount)

        export_items.append(
            PaymentExportItem(
                payment_id=str(payment.id),
                user_id=user.id,
                telegram_id=user.telegram_id,
                username=user.username,
                payment_type=payment.payment_type,
                amount=payment.amount,
                status=payment.status,
                created_at=payment.created_at,
                paid_at=payment.paid_at,
                subscription_type=payment.subscription_type,
                credits_amount=payment.credits_amount,
                yukassa_payment_id=payment.yukassa_payment_id,
                npd_tax=npd_tax,
                yukassa_commission=yukassa_commission,
                net_amount=net_amount,
            )
        )

        total_amount += payment.amount
        total_npd_tax += npd_tax
        total_yukassa_commission += yukassa_commission
        total_net_amount += net_amount

    # JSON формат
    if format == "json":
        export_response = PaymentExportResponse(
            payments=export_items,
            total_count=len(export_items),
            total_amount=total_amount,
            total_npd_tax=total_npd_tax,
            total_yukassa_commission=total_yukassa_commission,
            total_net_amount=total_net_amount,
            date_from=date_from,
            date_to=date_to,
        )
        return export_response

    # CSV формат
    output = io.StringIO()
    writer = csv.writer(output)

    # Заголовки
    writer.writerow([
        "Payment ID",
        "User ID",
        "Telegram ID",
        "Username",
        "Payment Type",
        "Amount (₽)",
        "Status",
        "Created At",
        "Paid At",
        "Subscription Type",
        "Credits Amount",
        "YuKassa Payment ID",
        "НПД 4% (₽)",
        "ЮKassa 2.8% (₽)",
        "Net Amount (₽)",
    ])

    # Данные
    for item in export_items:
        writer.writerow([
            item.payment_id,
            item.user_id,
            item.telegram_id,
            item.username or "",
            item.payment_type,
            float(item.amount),
            item.status,
            item.created_at.isoformat(),
            item.paid_at.isoformat() if item.paid_at else "",
            item.subscription_type or "",
            item.credits_amount or "",
            item.yukassa_payment_id or "",
            float(item.npd_tax),
            float(item.yukassa_commission),
            float(item.net_amount),
        ])

    # Итоговая строка
    writer.writerow([])
    writer.writerow([
        "ИТОГО:",
        "",
        "",
        "",
        "",
        float(total_amount),
        "",
        "",
        "",
        "",
        "",
        "",
        float(total_npd_tax),
        float(total_yukassa_commission),
        float(total_net_amount),
    ])

    csv_content = output.getvalue()
    output.close()

    # Возвращаем CSV файл
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=payments_export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
        }
    )


# ============================================================================
# GET /api/v1/admin/users/{user_id} — Детали пользователя
# ============================================================================

@router.get("/users/{user_id}", response_model=UserDetailsResponse)
async def get_user_details(
    user_id: int,
    admin: AdminUser,
    db: DBSession,
) -> UserDetailsResponse:
    """
    Получить детальную информацию о пользователе.

    Требует роль: ADMIN
    """
    # Получаем пользователя
    user = await db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Статистика пользователя
    total_generations = await db.scalar(
        select(func.count(Generation.id)).where(Generation.user_id == user.id)
    ) or 0

    total_spent_result = await db.scalar(
        select(func.sum(Payment.amount)).where(
            and_(Payment.user_id == user.id, Payment.status == "succeeded")
        )
    )
    total_spent = total_spent_result or Decimal("0")

    referrals_count = await db.scalar(
        select(func.count(Referral.id)).where(Referral.referrer_id == user.id)
    ) or 0

    now = datetime.now(timezone.utc)
    month_ago = now - timedelta(days=30)
    is_active = user.last_active_at is not None and user.last_active_at >= month_ago

    # Последние 10 генераций
    generations_result = await db.execute(
        select(Generation)
        .where(Generation.user_id == user.id)
        .order_by(Generation.created_at.desc())
        .limit(10)
    )
    recent_generations = [
        {
            "id": gen.id,
            "type": gen.type.value if gen.type else None,
            "status": gen.status,
            "created_at": gen.created_at.isoformat(),
            "credits_spent": gen.credits_spent,
        }
        for gen in generations_result.scalars().all()
    ]

    # Последние 10 платежей
    payments_result = await db.execute(
        select(Payment)
        .where(Payment.user_id == user.id)
        .order_by(Payment.created_at.desc())
        .limit(10)
    )
    recent_payments = [
        {
            "id": pay.id,
            "amount": float(pay.amount),
            "status": pay.status,
            "payment_type": pay.payment_type,
            "created_at": pay.created_at.isoformat(),
        }
        for pay in payments_result.scalars().all()
    ]

    # Список рефералов
    referrals_result = await db.execute(
        select(User)
        .join(Referral, Referral.referred_id == User.id)
        .where(Referral.referrer_id == user.id)
        .order_by(User.created_at.desc())
    )
    referrals = [
        {
            "id": ref.id,
            "email": ref.email,
            "username": ref.username,
            "created_at": ref.created_at.isoformat(),
        }
        for ref in referrals_result.scalars().all()
    ]

    # Формируем AdminUserItem
    user_item = AdminUserItem(
        id=user.id,
        email=user.email,
        telegram_id=user.telegram_id,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        balance_credits=user.balance_credits,
        subscription_type=user.subscription_type,
        subscription_expires_at=user.subscription_end,
        freemium_actions_remaining=10 - user.freemium_actions_used if user.can_use_freemium else 0,
        freemium_reset_at=user.freemium_reset_at,
        created_at=user.created_at,
        last_active_at=user.last_active_at,
        role=user.role.value if user.role else "user",
        total_generations=total_generations,
        total_spent=total_spent,
        referrals_count=referrals_count,
        is_active=is_active,
    )

    return UserDetailsResponse(
        user=user_item,
        recent_generations=recent_generations,
        recent_payments=recent_payments,
        referrals=referrals,
    )


# ============================================================================
# POST /api/v1/admin/users/{user_id}/add-credits — Начислить кредиты
# ============================================================================

@router.post("/users/{user_id}/add-credits", response_model=AddCreditsResponse)
async def add_user_credits(
    user_id: int,
    request: AddCreditsRequest,
    admin: AdminUser,
    db: DBSession,
) -> AddCreditsResponse:
    """
    Начислить кредиты пользователю.

    Требует роль: ADMIN
    """
    # Получаем пользователя
    user = await db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Начисляем кредиты
    user.balance_credits += request.amount
    await db.commit()
    await db.refresh(user)

    # Логируем действие (можно добавить отдельную таблицу CreditTransaction)
    # Для простоты пропускаем логирование в отдельную таблицу

    return AddCreditsResponse(
        success=True,
        user_id=user.id,
        new_balance=user.balance_credits,
        message=f"Successfully added {request.amount} credits. Reason: {request.reason}"
    )


# ============================================================================
# GET /api/v1/admin/referrals/stats — Статистика рефералов
# ============================================================================

@router.get("/referrals/stats", response_model=ReferralStatsResponse)
async def get_referral_stats(
    admin: AdminUser,
    db: DBSession,
    limit: int = Query(default=100, ge=1, le=1000, description="Количество пользователей"),
) -> ReferralStatsResponse:
    """
    Получить статистику рефералов по пользователям.

    Требует роль: ADMIN
    """
    # Получаем статистику по рефералам
    referral_stats_data = await db.execute(
        select(
            User.id,
            User.email,
            User.username,
            func.count(Referral.id).label("referrals_count"),
            func.sum(
                sa.case((Referral.is_awarded == True, 1), else_=0)
            ).label("active_referrals"),
            func.sum(
                sa.case((Referral.is_awarded == True, Referral.credits_awarded), else_=0)
            ).label("credits_earned"),
        )
        .outerjoin(Referral, User.id == Referral.referrer_id)
        .group_by(User.id, User.email, User.username)
        .having(func.count(Referral.id) > 0)
        .order_by(func.count(Referral.id).desc())
        .limit(limit)
    )

    stats = [
        ReferralStatsItem(
            user_id=row.id,
            email=row.email,
            username=row.username,
            referrals_count=row.referrals_count or 0,
            active_referrals=row.active_referrals or 0,
            credits_earned=row.credits_earned or 0,
        )
        for row in referral_stats_data.all()
    ]

    # Общие показатели
    total_referrals = await db.scalar(select(func.count(Referral.id))) or 0
    total_credits_result = await db.scalar(
        select(func.sum(Referral.credits_awarded)).where(Referral.is_awarded == True)
    )
    total_credits_earned = total_credits_result or 0

    return ReferralStatsResponse(
        stats=stats,
        total_referrals=total_referrals,
        total_credits_earned=total_credits_earned,
    )


# ============================================================================
# GET /api/v1/admin/export/users — Экспорт пользователей
# ============================================================================

@router.get("/export/users")
async def export_users(
    admin: AdminUser,
    db: DBSession,
):
    """
    Экспортировать пользователей в CSV.

    Требует роль: ADMIN
    """
    # Получаем всех пользователей
    users_result = await db.execute(
        select(User).order_by(User.created_at.desc())
    )
    users = users_result.scalars().all()

    # Формирование CSV
    output = io.StringIO()
    writer = csv.writer(output)

    # Заголовки
    writer.writerow([
        "ID",
        "Email",
        "Telegram ID",
        "Username",
        "Balance Credits",
        "Subscription",
        "Role",
        "Created At",
        "Last Active At",
    ])

    # Данные
    for user in users:
        writer.writerow([
            user.id,
            user.email or "",
            user.telegram_id or "",
            user.username or "",
            user.balance_credits,
            user.subscription_type or "freemium",
            user.role.value,
            user.created_at.isoformat(),
            user.last_active_at.isoformat() if user.last_active_at else "",
        ])

    csv_content = output.getvalue()
    output.close()

    # Возвращаем CSV файл
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=users_export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
        }
    )


# ============================================================================
# GET /api/v1/admin/export/generations — Экспорт генераций
# ============================================================================

@router.get("/export/generations")
async def export_generations(
    admin: AdminUser,
    db: DBSession,
    date_from: datetime | None = Query(default=None, description="Начальная дата"),
    date_to: datetime | None = Query(default=None, description="Конечная дата"),
):
    """
    Экспортировать генерации в CSV.

    Требует роль: ADMIN
    """
    # Базовый запрос
    query = select(Generation, User).join(User, Generation.user_id == User.id)

    if date_from:
        query = query.where(Generation.created_at >= date_from)
    if date_to:
        query = query.where(Generation.created_at <= date_to)

    query = query.order_by(Generation.created_at.desc())

    result = await db.execute(query)
    rows = result.all()

    # Формирование CSV
    output = io.StringIO()
    writer = csv.writer(output)

    # Заголовки
    writer.writerow([
        "Generation ID",
        "User ID",
        "User Email",
        "Type",
        "Status",
        "Credits Spent",
        "Has Watermark",
        "Created At",
    ])

    # Данные
    for generation, user in rows:
        writer.writerow([
            generation.id,
            user.id,
            user.email or "",
            generation.type.value if generation.type else "",
            generation.status,
            generation.credits_spent,
            generation.has_watermark,
            generation.created_at.isoformat(),
        ])

    csv_content = output.getvalue()
    output.close()

    # Возвращаем CSV файл
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=generations_export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
        }
    )


# ============================================================================
# Управление правами пользователей
# ============================================================================

@router.post("/users/make-admin", response_model=MakeAdminResponse)
async def make_user_admin(
    request: MakeAdminRequest,
    super_admin: SuperAdminUser,
    db: DBSession,
) -> MakeAdminResponse:
    """
    Назначить пользователя администратором.

    Требует роль: SUPER_ADMIN

    Только главный администратор может назначать других администраторов.
    """
    from app.models.user import UserRole

    # Найти пользователя по email
    result = await db.execute(
        select(User).where(User.email == request.email)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with email '{request.email}' not found"
        )

    # Проверить, не является ли уже админом
    if user.role in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        return MakeAdminResponse(
            success=True,
            user_id=user.id,
            email=user.email,
            role=user.role.value,
            message=f"User {user.email} is already an admin (role: {user.role.value})"
        )

    # Назначить роль ADMIN
    user.role = UserRole.ADMIN
    await db.commit()
    await db.refresh(user)

    return MakeAdminResponse(
        success=True,
        user_id=user.id,
        email=user.email,
        role=user.role.value,
        message=f"User {user.email} is now an admin"
    )


@router.delete("/users/{user_id}", response_model=DeleteUserResponse)
async def delete_user(
    user_id: int,
    admin: AdminUser,
    db: DBSession,
) -> DeleteUserResponse:
    """
    Удалить пользователя из системы.

    Требует роль: ADMIN

    Ограничения:
    - Нельзя удалить себя
    - Обычный ADMIN не может удалить SUPER_ADMIN (только другой SUPER_ADMIN может)
    """
    from app.models.user import UserRole

    # Найти пользователя
    result = await db.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found"
        )

    # Нельзя удалить себя
    if user.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete yourself"
        )

    # Нельзя удалить SUPER_ADMIN (если удаляющий не SUPER_ADMIN)
    if user.role == UserRole.SUPER_ADMIN and admin.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super admin can delete another super admin"
        )

    # Удалить пользователя (cascade удалит связанные данные)
    await db.delete(user)
    await db.commit()

    return DeleteUserResponse(
        success=True,
        user_id=user_id,
        message=f"User with ID {user_id} has been deleted"
    )
