# Activation Block 3 Stage A Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Запустить minimally invasive activation-first flow для новых пользователей с shortest path через examples и базовой аналитикой activation.

**Architecture:** `/app` остаётся тем же маршрутом, но при включённом `activation_onboarding_v1` показывает onboarding-first вариант для пользователей без успешных генераций. Frontend отправляет MVP activation events в новый backend ingestion endpoint, а `first_generate_success` создаётся на backend по факту `Generation.status=completed`, с best-effort наследованием `session_id/flow_id/entry_source` из последнего `first_generate_click`.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, React, Zustand, Jest, Pytest.

---

### Task 1: Activation backend foundation

**Files:**
- Create: `backend/app/models/activation_event.py`
- Create: `backend/app/schemas/activation.py`
- Create: `backend/app/services/activation_events.py`
- Create: `backend/app/api/v1/endpoints/activation.py`
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/app/main.py`
- Modify: `backend/app/core/config.py`
- Create: `backend/alembic/versions/20260321_1800_add_activation_events.py`
- Test: `backend/tests/test_activation_api.py`

**Steps:**
1. Написать падающие backend tests на state endpoint, frontend-ingest endpoint и дедупликацию first-only events.
2. Реализовать модель/схемы/endpoint/service минимальным кодом.
3. Добавить Alembic migration.
4. Прогнать targeted pytest.
5. Commit.

### Task 2: Backend-fact success event and metrics

**Files:**
- Modify: `backend/app/tasks/fitting.py`
- Modify: `backend/app/tasks/editing.py`
- Modify: `backend/app/api/v1/endpoints/activation.py`
- Test: `backend/tests/test_activation_api.py`

**Steps:**
1. Написать падающий test на вычисление activation metrics и backend `first_generate_success`.
2. После `completed` в fitting/editing создать backend event `first_generate_success`.
3. Добавить admin/service endpoint или query endpoint для activation_rate и time_to_first_generate.
4. Прогнать targeted pytest.
5. Commit.

### Task 3: Frontend onboarding-first entry

**Files:**
- Create: `frontend/src/api/activation.ts`
- Create: `frontend/src/types/activation.ts`
- Create: `frontend/src/utils/activationTracking.ts`
- Create: `frontend/src/utils/featureFlags.ts`
- Modify: `frontend/src/pages/HomePage.tsx`
- Test: `frontend/test/home-activation.test.tsx`

**Steps:**
1. Написать падающие frontend tests на onboarding-first variant и fallback к existing hub.
2. Реализовать state fetch + feature flag + onboarding CTA через examples flow.
3. Отправлять `onboarding_start`.
4. Прогнать targeted jest.
5. Commit.

### Task 4: Frontend event hooks and success state

**Files:**
- Modify: `frontend/src/api/authWeb.ts`
- Modify: `frontend/src/store/authStore.ts`
- Modify: `frontend/src/components/editing/ChatInput.tsx`
- Modify: `frontend/src/pages/ExampleGenerationPage.tsx`
- Modify: `frontend/src/components/examples/ExampleGenerationResult.tsx`
- Test: `frontend/test/example-generation-activation.test.tsx`

**Steps:**
1. Написать падающие tests на `first_upload_success`, `first_generate_click` и CTA success state.
2. Добавить auth context headers для `register_success`.
3. Добавить tracking-хуки для examples activation path.
4. Обновить success state до Download + “Сделать ещё одну генерацию”.
5. Прогнать targeted jest.
6. Commit.

### Task 5: Verification and docs

**Files:**
- Create: `docs/plans/2026-03-21-activation-block3-stage-a-report.md`

**Steps:**
1. Прогнать backend/frontend targeted tests.
2. Прогнать `frontend npm run build`.
3. Сделать локальный smoke по register/login -> /app -> examples generate.
4. Задокументировать payload examples, metrics query/endpoint и go/no-go.
5. Commit.
