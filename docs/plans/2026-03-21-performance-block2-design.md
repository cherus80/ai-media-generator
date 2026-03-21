# Performance Block 2 Design

**Goal:** Ускорить публичный API примеров и уменьшить начальный frontend payload без изменения бизнес-логики, с честными измерениями `before/after` локально и контрольной проверкой на production.

**Status:** Approved by user on 2026-03-21.

## Scope

1. Backend/API:
   - `GET /api/v1/content/examples`
   - Публичные карточки примеров и их изображения
2. Frontend:
   - Initial JS для `/` и `/login`
   - UX каталога `/app/examples`
3. Observability:
   - Benchmark scripts и markdown-отчёт с метриками `before/after`

## Constraints

- Не менять бизнес-логику auth, payments, fitting/editing, referrals, SEO raw-head flow.
- Кэшировать только публичный `GET /api/v1/content/examples`.
- Методика замера должна быть одинаковой `before/after`.
- Основные замеры выполняются на локальном production-like стенде.
- После локальных замеров выполняется короткая валидация тех же метрик на live production.

## Decisions

### 1. API compatibility

- Не удалять резко поля, которые уже могут ожидать текущий frontend или внешние интеграции.
- Для list endpoint вводится безопасный режим облегчённого ответа:
  - по умолчанию list остаётся обратно совместимым;
  - новый облегчённый DTO отдаётся через явный opt-in query param (`view=card`), который будет использовать frontend каталога и лендинга;
  - detail endpoint `/api/v1/content/examples/by-slug/{slug}` остаётся полным.
- Это позволяет получить выигрыш в размере и сериализации list-ответа без риска незаметно сломать старые клиенты.

### 2. Public examples caching

- Добавляется `in-process` cache только для публичного `GET /api/v1/content/examples`.
- TTL: `90s`.
- Cache key строится из нормализованных query params:
  - параметры сортируются по имени;
  - значения списков нормализуются;
  - пустые значения не попадают в ключ;
  - query order не влияет на cache hit.
- Для ответа выставляется `Cache-Control: public, max-age=90`.
- Это решение deliberately остаётся per-process и не требует Redis/shared cache для текущего блока.

### 3. Pagination and payload trimming

- Для list endpoint добавляются:
  - `page` с default `1`
  - `page_size` с default `20`
  - `max page_size = 50`
- Для облегчённого режима `view=card` list-ответ содержит только карточечные поля:
  - `id`
  - `slug`
  - `seo_variant_index`
  - `title`
  - `description`
  - `image_url`
  - `thumbnail_url` (optional)
  - `uses_count`
  - `tags`
- Тяжёлые поля `prompt`, `seo_title`, `seo_description` остаются в detail и в legacy/full list режиме.

### 4. Thumbnail rollout

- Thumbnail generation не должна ломать текущие загрузки.
- При загрузке/обновлении изображения примера backend пытается сохранить миниатюру рядом с основным файлом.
- Если миниатюру создать не удалось:
  - upload/save не падает;
  - `thumbnail_url` остаётся `null`;
  - frontend использует жёсткий fallback на `image_url`.
- Для уже существующих примеров будет подготовлен отдельный backfill script, но он не блокирует релиз.

### 5. Frontend bundle strategy

- [frontend/src/App.tsx](/Users/ruslancernov/Documents/Боты%20на%20Python/ai-media-generator_1/ai-image-generator_antigravity/frontend/src/App.tsx) переводится на route-based lazy loading.
- Чанки будут разделены минимум на:
  - auth routes
  - public routes
  - app routes
  - admin routes
  - heavy feature pages (`/fitting`, `/editing`)
- Глобальные always-on элементы (`Toaster`, cookie banner, metrika) остаются в корне, но страницы и тяжёлые feature-компоненты уходят из initial bundle.

### 6. Examples catalog UX

- В каталоге и на лендинге карточки примеров используют `thumbnail_url ?? image_url`.
- Для изображений добавляются:
  - `loading="lazy"`
  - `decoding="async"`
  - явные размеры/контейнеры, чтобы снизить layout shift
- Для каталога добавляются:
  - skeleton state
  - error fallback с кнопкой retry
  - более дружелюбные тексты загрузки/ошибок на мобильных

### 7. Metrics and reporting

- Отчёт: `docs/plans/2026-03-21-performance-block2-report.md`
- В отчёте отдельно показываются:
  - `Local benchmark`
  - `Production check`
- В обеих секциях фиксируются:
  - API latency для `/api/v1/content/examples`: минимум 10 прогонов, `p50` и `p95`
  - initial JS для `/` и `/login`
  - список крупнейших чанков `before/after`

## Risks

- `in-process` cache не shared между uvicorn workers, поэтому выигрыш на production будет зависеть от распределения запросов между воркерами.
- Opt-in режим `view=card` требует аккуратно обновить frontend API client и типы, чтобы не смешать list/detail контракты.
- Thumbnail generation увеличит стоимость upload path, поэтому код должен быть best-effort и без влияния на успешность текущих загрузок.
- Lazy splitting нельзя делать агрессивно на критичных для UX shared-компонентах, иначе вместо уменьшения payload появится лишний каскад запросов.

## Success criteria

- `GET /api/v1/content/examples` становится быстрее по `p50` и желательно по `p95`.
- Initial JS для `/` и `/login` уменьшается.
- `/app/examples` получает skeleton/lazy/fallback UX.
- Build/tests проходят.
- Production spot-check подтверждает локальный эффект теми же метриками/командами.
