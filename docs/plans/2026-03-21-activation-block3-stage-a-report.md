# Block 3 Stage A Report

## Scope

Stage A внедряет минимально-инвазивный activation-first слой без изменения основной бизнес-логики:

- onboarding-first entry для новых пользователей на `/app`
- primary activation path через examples flow
- MVP activation events
- backend-fact `first_generate_success`
- feature flag `activation_onboarding_v1`
- metrics endpoint и SQL для `activation_rate` и `time_to_first_generate`

## Implemented

### Backend

- Добавлена таблица `activation_events`.
- Добавлен API:
  - `GET /api/v1/activation/state`
  - `POST /api/v1/activation/events`
  - `GET /api/v1/activation/metrics`
- `register_success` фиксируется на backend при создании нового пользователя в auth flow.
- `first_generate_success` фиксируется backend-фактом при `completed` generation в fitting/editing tasks.
- Для backend events наследуется activation context из headers и последнего front event.
- Добавлен feature flag `ACTIVATION_ONBOARDING_V1`.

### Frontend

- После login/register новый пользователь на `/app` получает onboarding-first entry, если:
  - flag включён
  - пользователь авторизован
  - completed generations = 0
- Returning user видит прежний `/app` hub.
- CTA ведёт в shortest path:
  - `/app/examples/generate?example=<slug>&source=activation_onboarding&v=<variant>`
- Добавлены MVP events:
  - `onboarding_start`
  - `first_upload_success`
  - `first_generate_click`
- auth-запросы пробрасывают activation headers для backend `register_success`.
- Success state после первой генерации показывает:
  - `Скачать`
  - `Сделать ещё одну генерацию`

## Event payload examples

### register_success

```json
{
  "event_name": "register_success",
  "user_id": 123,
  "anonymous_id": "anon_2d6f4q9wma8l2i",
  "session_id": "sess_mx4i3e8bma8l2i",
  "flow_id": "flow_k4o8nd9hma8l2i",
  "route": "/register",
  "entry_source": "register",
  "utm_source": "telegram",
  "utm_campaign": "spring_launch",
  "referral_code": "FRIEND42",
  "timestamp": "2026-03-21T12:00:00.000Z"
}
```

### onboarding_start

```json
{
  "event_name": "onboarding_start",
  "user_id": 123,
  "anonymous_id": "anon_2d6f4q9wma8l2i",
  "session_id": "sess_mx4i3e8bma8l2i",
  "flow_id": "flow_newuser9ma8l2i",
  "route": "/app",
  "entry_source": "activation_onboarding",
  "timestamp": "2026-03-21T12:03:10.000Z"
}
```

### first_upload_success

```json
{
  "event_name": "first_upload_success",
  "user_id": 123,
  "session_id": "sess_mx4i3e8bma8l2i",
  "flow_id": "flow_newuser9ma8l2i",
  "route": "/app/examples/generate",
  "entry_source": "activation_onboarding",
  "timestamp": "2026-03-21T12:04:02.000Z"
}
```

### first_generate_click

```json
{
  "event_name": "first_generate_click",
  "user_id": 123,
  "session_id": "sess_mx4i3e8bma8l2i",
  "flow_id": "flow_newuser9ma8l2i",
  "route": "/app/examples/generate",
  "entry_source": "activation_onboarding",
  "timestamp": "2026-03-21T12:04:11.000Z"
}
```

### first_generate_success

```json
{
  "event_name": "first_generate_success",
  "user_id": 123,
  "session_id": "sess_mx4i3e8bma8l2i",
  "flow_id": "flow_newuser9ma8l2i",
  "route": "/app/examples/generate",
  "entry_source": "activation_onboarding",
  "generation_id": 987,
  "timestamp": "2026-03-21T12:04:32.000Z"
}
```

## Metrics

### HTTP endpoint

`GET /api/v1/activation/metrics`

Response shape:

```json
{
  "register_success_count": 120,
  "first_generate_success_count": 43,
  "activation_rate": 0.3583,
  "time_to_first_generate": {
    "p50_seconds": 184,
    "p95_seconds": 967
  }
}
```

### SQL reference

```sql
WITH first_register AS (
  SELECT
    user_id,
    MIN(created_at) AS register_at
  FROM activation_events
  WHERE event_name = 'register_success'
    AND user_id IS NOT NULL
  GROUP BY user_id
),
first_success AS (
  SELECT
    user_id,
    MIN(created_at) AS success_at
  FROM activation_events
  WHERE event_name = 'first_generate_success'
    AND user_id IS NOT NULL
  GROUP BY user_id
),
deltas AS (
  SELECT
    EXTRACT(EPOCH FROM (s.success_at - r.register_at))::bigint AS seconds_to_first_generate
  FROM first_register r
  JOIN first_success s ON s.user_id = r.user_id
  WHERE s.success_at >= r.register_at
)
SELECT
  (SELECT COUNT(*) FROM activation_events WHERE event_name = 'register_success') AS register_success_count,
  (SELECT COUNT(*) FROM activation_events WHERE event_name = 'first_generate_success') AS first_generate_success_count,
  CASE
    WHEN (SELECT COUNT(*) FROM activation_events WHERE event_name = 'register_success') = 0 THEN 0
    ELSE ROUND(
      (SELECT COUNT(*) FROM activation_events WHERE event_name = 'first_generate_success')::numeric
      / (SELECT COUNT(*) FROM activation_events WHERE event_name = 'register_success')::numeric,
      4
    )
  END AS activation_rate,
  percentile_disc(0.50) WITHIN GROUP (ORDER BY seconds_to_first_generate) AS p50_seconds,
  percentile_disc(0.95) WITHIN GROUP (ORDER BY seconds_to_first_generate) AS p95_seconds
FROM deltas;
```

## Verification

### Backend

```bash
cd backend && python3 -m pytest tests/test_activation_api.py tests/test_content_examples_api.py -q
```

Result:

- `8 passed`

### Frontend tests

```bash
cd frontend && npm test -- --runInBand --runTestsByPath test/home-activation.test.tsx test/chat-input-activation.test.tsx test/example-generation-activation.test.tsx test/examples-page.test.tsx test/seo-routes.test.ts
```

Result:

- `5 test suites passed`
- `20 tests passed`

### Frontend build

```bash
cd frontend && npm run build
```

Result:

- `vite build` passed
- prerender route generation passed

## Smoke status

Автоматизированный smoke Stage A закрыт следующими проверками:

- onboarding-first entry для new user
- fallback на старый `/app` hub для activated user
- `first_upload_success` callback в examples flow
- `first_generate_click` tracking в examples flow
- success CTA `Скачать` + `Сделать ещё одну генерацию`
- existing examples page и SEO route tests не сломаны

Manual browser smoke и production deploy в этот отчёт не входят.

## Go / No-Go before production

Status: `GO`

Основание:

- backend tests green
- frontend tests green
- production build green
- feature flag позволяет быстро выключить onboarding-first rollout

Residual risk:

- нет отдельного интеграционного browser smoke c реальным login/upload/generate against running local stack
- новые activation events пока не покрыты end-to-end тестом через весь auth flow
