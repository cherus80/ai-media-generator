# Обновление существующих тестов для Billing v4

## Общие рекомендации

Все существующие тесты, которые проверяют списание кредитов, должны быть обновлены для поддержки Billing v4.

### Ключевые изменения:

1. **Включение Billing v4 в тестах**:
   ```python
   import os
   os.environ["BILLING_V4_ENABLED"] = "true"
   os.environ["BILLING_LEDGER_ENABLED"] = "true"
   ```

2. **Обновление фикстур пользователей**:
   - Использовать новые фикстуры из `conftest.py`:
     - `test_user_with_subscription_v4`
     - `test_user_freemium_v4`
     - `test_user_credits_only_v4`
     - `test_user_no_funds_v4`

3. **Проверка приоритета списаний**:
   - Подписка → Freemium → Кредиты
   - Убедиться, что тесты проверяют правильный источник списания

4. **Проверка ledger записей**:
   - После каждой операции проверять создание записи в `credits_ledger`
   - Проверять `idempotency_key`, `type`, `source`, `amount`

## test_fitting_integration.py

### Обновления:

1. **Тест с подпиской**:
   ```python
   async def test_fitting_with_subscription_v4(
       self,
       authenticated_test_client: AsyncClient,
       test_user_with_subscription_v4: User,
       test_db: AsyncSession,
       sample_jpeg_bytes: bytes,
   ):
       """Примерка с подпиской списывает ops, не кредиты"""
       import os
       os.environ["BILLING_V4_ENABLED"] = "true"

       initial_ops_used = test_user_with_subscription_v4.subscription_ops_used
       initial_credits = test_user_with_subscription_v4.balance_credits

       # ... выполнить примерку ...

       await test_db.refresh(test_user_with_subscription_v4)

       # Проверяем, что списались ops подписки
       assert test_user_with_subscription_v4.subscription_ops_used == initial_ops_used + 1
       # Кредиты не тратятся
       assert test_user_with_subscription_v4.balance_credits == initial_credits
   ```

2. **Тест с freemium**:
   ```python
   async def test_fitting_with_freemium_v4(
       self,
       authenticated_test_client: AsyncClient,
       test_user_freemium_v4: User,
       test_db: AsyncSession,
       sample_jpeg_bytes: bytes,
   ):
       """Примерка с freemium"""
       import os
       os.environ["BILLING_V4_ENABLED"] = "true"

       initial_freemium_used = test_user_freemium_v4.freemium_actions_used

       # ... выполнить примерку ...

       await test_db.refresh(test_user_freemium_v4)

       assert test_user_freemium_v4.freemium_actions_used == initial_freemium_used + 1
   ```

3. **Тест NOT_ENOUGH_CREDITS**:
   ```python
   async def test_fitting_not_enough_credits_v4(
       self,
       authenticated_test_client: AsyncClient,
       test_user_no_funds_v4: User,
       test_db: AsyncSession,
       sample_jpeg_bytes: bytes,
   ):
       """Ошибка 402 при нехватке средств"""
       import os
       os.environ["BILLING_V4_ENABLED"] = "true"

       response = await authenticated_test_client.post(
           "/api/v1/fitting/generate",
           files={...},
           data={...}
       )

       assert response.status_code == 402
       assert "NOT_ENOUGH_CREDITS" in str(response.json())
   ```

## test_editing_integration.py

### Обновления:

1. **Ассистент (только кредиты)**:
   ```python
   async def test_editing_assistant_v4(
       self,
       authenticated_test_client: AsyncClient,
       test_user_credits_only_v4: User,
       test_db: AsyncSession,
   ):
       """AI-ассистент списывает только кредиты"""
       import os
       os.environ["BILLING_V4_ENABLED"] = "true"

       initial_credits = test_user_credits_only_v4.balance_credits
       initial_freemium = test_user_credits_only_v4.freemium_actions_used

       # ... запрос к ассистенту ...

       await test_db.refresh(test_user_credits_only_v4)

       # Списались кредиты (1 кредит)
       assert test_user_credits_only_v4.balance_credits == initial_credits - 1
       # Freemium НЕ тратится
       assert test_user_credits_only_v4.freemium_actions_used == initial_freemium
   ```

2. **Итоговая генерация (приоритет)**:
   ```python
   async def test_editing_final_generation_v4(
       self,
       authenticated_test_client: AsyncClient,
       test_user_with_subscription_v4: User,
       test_db: AsyncSession,
   ):
       """Финальная генерация использует приоритет"""
       import os
       os.environ["BILLING_V4_ENABLED"] = "true"

       initial_ops = test_user_with_subscription_v4.subscription_ops_used

       # ... финальная генерация ...

       await test_db.refresh(test_user_with_subscription_v4)

       # Списались ops подписки
       assert test_user_with_subscription_v4.subscription_ops_used == initial_ops + 1
   ```

## Проверка ledger записей

Добавить в существующие тесты проверку ledger:

```python
from app.models.credits_ledger import CreditsLedger, LedgerEntryType, LedgerSource
from sqlalchemy import select

# После операции
ledger_entries = await test_db.execute(
    select(CreditsLedger)
    .where(CreditsLedger.user_id == user.id)
    .order_by(CreditsLedger.created_at.desc())
)
latest_entry = ledger_entries.scalar()

assert latest_entry is not None
assert latest_entry.type == LedgerEntryType.TRYON
assert latest_entry.source == LedgerSource.SUBSCRIPTION  # или FREEMIUM/CREDITS
assert latest_entry.amount == -2  # для генерации
```

## Race condition тесты

Создать тесты для параллельных списаний:

```python
import asyncio

async def test_concurrent_generations_v4(
    test_db: AsyncSession,
    test_user_credits_only_v4: User,
):
    """Параллельные генерации не уводят баланс в минус"""
    import os
    os.environ["BILLING_V4_ENABLED"] = "true"

    from app.services.billing_v4 import BillingV4Service

    service1 = BillingV4Service(test_db)
    service2 = BillingV4Service(test_db)

    # У пользователя только 2 кредита (на 1 генерацию)
    test_user_credits_only_v4.balance_credits = 2

    async def charge1():
        try:
            return await service1.charge_generation(test_user_credits_only_v4.id)
        except HTTPException:
            return None

    async def charge2():
        try:
            return await service2.charge_generation(test_user_credits_only_v4.id)
        except HTTPException:
            return None

    # Запускаем параллельно
    results = await asyncio.gather(charge1(), charge2())

    # Только одна операция должна пройти
    successful = [r for r in results if r is not None]
    assert len(successful) == 1

    # Баланс = 0 (не в минусе!)
    await test_db.refresh(test_user_credits_only_v4)
    assert test_user_credits_only_v4.balance_credits == 0
```

## E2E тесты (опционально)

Если есть Playwright/Cypress тесты:

1. **Проверка UI баланса**:
   - Вызов `/api/v1/billing/state` в bootstrap
   - Отображение кредитов, подписки, freemium
   - Модалка предупреждения перед генерацией

2. **Сценарии пользователей**:
   - Сценарий A: пользователь с подпиской делает 5 примерок → лимит уменьшается
   - Сценарий B: freemium пользователь исчерпывает лимит → блокировка
   - Сценарий C: платная генерация после freemium

## Запуск обновленных тестов

```bash
# Подготовка
cd ai-image-bot/backend
alembic upgrade head

# Убедиться что .env настроен
export BILLING_V4_ENABLED=true
export BILLING_LEDGER_ENABLED=true
export PAYMENT_MOCK_MODE=true

# Юнит-тесты
pytest tests/test_billing_v4.py -v

# Интеграционные API тесты
pytest tests/test_billing_api.py -v

# Обновленные фиттинг тесты
pytest tests/test_fitting_integration.py -v -k "v4"

# Обновленные editing тесты
pytest tests/test_editing_integration.py -v -k "v4"

# Все billing тесты
pytest tests/ -m billing -v

# Race condition тесты
pytest tests/test_billing_v4.py::TestBillingV4RaceConditions -v
```

## Чеклист обновления

- [ ] Добавить `BILLING_V4_ENABLED=true` в test env
- [ ] Обновить фикстуры пользователей
- [ ] Обновить тесты примерки для приоритета
- [ ] Обновить тесты ассистента (только кредиты)
- [ ] Добавить проверки ledger записей
- [ ] Добавить race condition тесты
- [ ] Обновить тесты ошибок (402 NOT_ENOUGH_CREDITS)
- [ ] Тесты для admin bypass
- [ ] Тесты сброса лимитов (30 дней)
- [ ] Тесты идемпотентности
- [ ] E2E тесты (опционально)

## Примечания

- **Mock режим**: Для тестов без реальных платежей используйте `PAYMENT_MOCK_MODE=true`
- **Изоляция**: Каждый тест должен создавать своего пользователя или использовать transaction rollback
- **Ledger**: Проверяйте создание записей только если `BILLING_LEDGER_ENABLED=true`
- **Celery**: Мокайте Celery таски (`generate_fitting_task.delay`) для unit/integration тестов
