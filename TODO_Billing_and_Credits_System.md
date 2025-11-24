# TODO: Billing & Credits System v4 (Freemium + Subscription + Credits)

## Цели и охват
- Заменить минимальную биллинговую логику на v4-модель: приоритет списаний подписка → freemium → кредиты; генерации = 2 кредита, ассистент = 1 кредит.
- Отразить тарифы/пакеты/лимиты из спецификации, добавить ledger и идемпотентность платежей ЮKassa.
- Покрыть backend (модели, сервисы, API, задачи), frontend (UI/UX предупреждения, остатки лимитов), миграции и тесты.

## Конфиг и константы
- ✅ Вынести тарифы/лимиты/цены в `backend/app/core/config.py` + `.env.example` (`SUBSCRIPTION_TIERS`, `CREDITS_PACKAGES`, `FREEMIUM_OPS_LIMIT=5`, `FREE_TRIAL_CREDITS=10`, `GENERATION_COST_CREDITS=2`, `ASSISTANT_COST_CREDITS=1`, `BILLING_LEDGER_ENABLED`, `BILLING_MUTEX_TIMEOUT_MS`, `YOOKASSA_IDEMPOTENCY_HEADER`).
- ⏳ Удалить/обновить старые константы (тестовые 100 кредитов в auth_web/register/login и др.).

## Миграции и модель данных (alembic)
- ✅ `users`: поля `subscription_ops_limit`, `subscription_ops_used`, `subscription_ops_reset_at` добавлены (freemium поля уже были).
- ✅ `credits_ledger` таблица (type/source enums, idempotency_key, индексы).
- ⏳ `subscription_states` или расширение `payments` (ops_used_this_month, auto_renew и т.п.).
- ⏳ Обновить `payments`/`yookassa` записи: `idempotency_key`, `raw_payload`, `status`, индекс по `payment_id`.
- ⏳ Row-level lock friendly репозитории (select_for_update хелперы).

## Backend сервисы
- ✅ Новый `BillingV4Service` (charge_generation/charge_assistant) с приоритетом подписка → freemium → кредиты, select_for_update, сброс лимитов.
- ⏳ Переписать/объединить `app/services/credits.py` под Billing v4, добавить `award_free_trial`, `reset_*` публично.
- ⏳ Переписать `app/services/billing.py` под новые тарифы (ops_limit), убрать выдачу кредитов за подписку.
- ⏳ Добавить `app/services/ledger.py` (create_entry, find_by_idempotency_key).
- ⏳ Free Trial: хук после регистрации (auth_web) → +10 кредитов, ledger `credit_purchase/free_trial`.

## API слой
- ✅ Новый роутер `app/api/v1/endpoints/billing.py`: `GET /billing/state`, `GET /billing/ledger`.
- ✅ Внедрен Billing v4 в `fitting.generate` и `editing` (assist + финальная генерация) с фичефлагом.
- ⏳ Добавить внутренние `POST /billing/charge-generation`, `POST /billing/charge-assistant` (если требуются).
- ⏳ `POST /billing/purchase-package` (создание платежа), `POST /billing/webhook/yookassa`, `POST /billing/subscriptions/{plan}/create|cancel` (reset ops_used on renewal, fallback to freemium on fail).

## UI/Frontend
- ⏳ Добавить запрос `GET /billing/state` в bootstrap сессии (store auth/profile).
- ⏳ В шапке/профиле: кредиты, остаток подписки, остаток freemium, ближайший reset.
- ⏳ Перед генерацией/ассистентом: модалка «будет списано X, источник Y, останется Z».
- ⏳ Страница истории платежей: вывод ledger (тип, источник, сумма, дата, meta).
- ⏳ Обновить тексты ошибок по `NOT_ENOUGH_CREDITS`.

## Платежи и идемпотентность
- ⏳ ЮKassa webhook: `idempotency_key` → проверка в `credits_ledger`/`payments` перед начислением.
- ⏳ Подписки: при продлении сброс `subscription_ops_used`=0, обновление `subscription_ops_reset_at`; при fail → `subscription_type=NULL`, freemium активен.
- ⏳ Покупка пакетов: начислять кредиты по таблице пакетов; ledger `credit_purchase`, meta=payment_id, amount=+N.

## Resets и фоновые задачи
- ⏳ Celery/Beat: ежедневный чек `freemium_ops_reset_at` (30 дней) и ежемесячный reset подписки по `subscription_ops_reset_at`.
- ⏳ Он-рид доступ: при заходе пользователя вызывать `reset_freemium_if_needed`/`reset_subscription_if_needed` (логика есть в `BillingV4Service`, нужно вызвать при загрузке профиля/auth).

## Данные и миграции существующих пользователей
- ⏳ Миграция: сбросить тестовые 100 кредитов → выдать только free trial (10) новым; стратегия для существующих (сохранить баланс как кредиты, freemium_ops_used = min(текущего, FREEMIUM_OPS_LIMIT)).
- ⏳ Проставить `subscription_ops_limit` по активным подпискам (если были), `subscription_ops_used=0`, `subscription_ops_reset_at=now`.
- ⏳ Обновить тарифы в `payments`/UI (basic/pro/premium → basic/standard/premium).

## Тестирование
- ⏳ Unit: приоритет списаний, отказ при недостатке средств, reset freemium/subscription, free trial начисление, ledger идемпотентность, параллельные списания (race test).
- ⏳ Integration/API: billing/state, charge endpoints, purchase/webhook идемпотентность, подписка продление/откат, freemium лимит.
- ⏳ E2E: сценарии A/B/C из спецификации, повторный webhook, одновременные генерации, блокировка при нехватке кредитов.
- ⏳ Обновить `e2e_fitting_test.py` (стоимость 2 кредита, NOT_ENOUGH_CREDITS).

## Rollout и флаги
- ⏳ Фичефлаг `BILLING_V4_ENABLED`: на время миграции держать старый путь, после валидации удалить старый код/константы.
- ⏳ Документация: README/QUICK_START/ADMIN_PANEL описать новые тарифы и поведение UI.
- ⏳ Мониторинг: логирование списаний и webhook обработок (без персональных фото), алерты на ошибки идемпотентности и блокировки.
