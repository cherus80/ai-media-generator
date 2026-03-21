# Performance Block 2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ускорить `/api/v1/content/examples`, уменьшить initial JS для `/` и `/login`, улучшить UX каталога примеров и зафиксировать метрики `before/after`.

**Architecture:** Backend получает cache + pagination + безопасный card-view DTO для list endpoint. Frontend переводится на route-based lazy loading и отдельные list/detail типы примеров. Каталог получает lightweight thumbnails с жёстким fallback и улучшенные loading/error состояния. Метрики снимаются одинаковыми скриптами локально и затем валидируются на production.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic, React 18, React Router, Vite, TypeScript, Jest, shell/node benchmark scripts.

---

### Task 1: Baseline Measurements

**Files:**
- Create: `docs/plans/2026-03-21-performance-block2-report.md`
- Create: `scripts/perf/benchmark_examples_api.sh`
- Create: `frontend/scripts/analyze-bundle.mjs`

**Step 1: Write the failing verification scaffolding**

- Добавить пустой report template с секциями:
  - `Local benchmark`
  - `Production check`
  - `API p50/p95`
  - `Initial JS`
  - `Largest chunks`
- Добавить shell script для 10+ прогонов API benchmark.
- Добавить bundle analysis script, который читает `frontend/dist` и суммирует initial JS для `/` и `/login`.

**Step 2: Run baseline scripts on current code**

Run:

```bash
./scripts/perf/benchmark_examples_api.sh local-before
cd frontend && npm run build && node scripts/analyze-bundle.mjs before
```

Expected:
- скрипты завершаются успешно;
- baseline числа попадают в report.

**Step 3: Commit**

```bash
git add docs/plans/2026-03-21-performance-block2-report.md scripts/perf/benchmark_examples_api.sh frontend/scripts/analyze-bundle.mjs
git commit -m "chore(perf): add benchmark scaffolding"
```

### Task 2: Backend Examples API Optimization

**Files:**
- Modify: `backend/app/api/v1/endpoints/content.py`
- Modify: `backend/app/schemas/content.py`
- Modify: `frontend/src/api/content.ts`
- Modify: `frontend/src/types/content.ts`
- Test: `backend/tests/test_content_examples_api.py`

**Step 1: Write failing backend tests**

Покрыть:
- `view=card` не включает тяжёлые поля list-ответа
- default pagination = `page=1`, `page_size=20`
- `page_size > 50` режется/валидационно отклоняется
- одинаковые query params в разном порядке дают одинаковый cache key behaviour

**Step 2: Run tests to verify RED**

Run:

```bash
cd backend && pytest tests/test_content_examples_api.py -q
```

Expected: FAIL на новой функциональности.

**Step 3: Implement minimal backend changes**

- Ввести нормализацию query params и in-process cache с TTL `90s`
- Добавить `view=card`, `page`, `page_size`
- Оставить legacy/full режим обратно совместимым
- Для `view=card` вернуть лёгкий DTO
- Добавить `Cache-Control: public, max-age=90`

**Step 4: Run tests to verify GREEN**

Run:

```bash
cd backend && pytest tests/test_content_examples_api.py -q
```

Expected: PASS

**Step 5: Commit**

```bash
git add backend/app/api/v1/endpoints/content.py backend/app/schemas/content.py backend/tests/test_content_examples_api.py frontend/src/api/content.ts frontend/src/types/content.ts
git commit -m "feat(perf): optimize public examples api"
```

### Task 3: Thumbnail Rollout

**Files:**
- Modify: `backend/app/models/generation_example.py` or related schema layer if field already absent in DB
- Modify/Create: thumbnail handling in `backend/app/services/file_storage.py` and related helpers
- Modify: `backend/app/api/v1/endpoints/admin_content.py`
- Create: `backend/scripts/backfill_example_thumbnails.py`
- Test: `backend/tests/test_example_thumbnails.py`

**Step 1: Write failing tests**

Покрыть:
- upload/save примера не падает, если thumbnail generation упала
- `thumbnail_url` при наличии возвращается
- при отсутствии thumbnail frontend-compatible fallback возможен

**Step 2: Verify RED**

```bash
cd backend && pytest tests/test_example_thumbnails.py -q
```

**Step 3: Implement**

- Best-effort thumbnail generation
- Optional `thumbnail_url`
- Отдельный backfill script для старых примеров

**Step 4: Verify GREEN**

```bash
cd backend && pytest tests/test_example_thumbnails.py -q
```

**Step 5: Commit**

```bash
git add backend/app/services/file_storage.py backend/app/api/v1/endpoints/admin_content.py backend/tests/test_example_thumbnails.py backend/scripts/backfill_example_thumbnails.py
git commit -m "feat(perf): add safe example thumbnails"
```

### Task 4: Frontend Route Splitting and Catalog UX

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/ExamplesPage.tsx`
- Modify: `frontend/src/pages/LandingPage.tsx`
- Create/Modify: lightweight skeleton/fallback components under `frontend/src/components/examples/`
- Test: `frontend/test/examples-page.test.tsx`

**Step 1: Write failing frontend tests**

Покрыть:
- каталог показывает skeleton во время загрузки
- каталог показывает retry fallback при ошибке API
- карточки используют `thumbnail_url ?? image_url`

**Step 2: Verify RED**

```bash
cd frontend && npm test -- --runInBand --runTestsByPath test/examples-page.test.tsx
```

**Step 3: Implement**

- Route-based lazy loading для auth/public/app/admin/fitting/editing
- `Suspense` fallbacks
- skeleton cards
- retry button и понятный error text
- lazy image attrs + fixed media box

**Step 4: Verify GREEN**

```bash
cd frontend && npm test -- --runInBand --runTestsByPath test/examples-page.test.tsx
```

**Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/pages/ExamplesPage.tsx frontend/src/pages/LandingPage.tsx frontend/src/components/examples frontend/test/examples-page.test.tsx
git commit -m "feat(perf): split routes and improve examples ux"
```

### Task 5: Final Measurements and Verification

**Files:**
- Modify: `docs/plans/2026-03-21-performance-block2-report.md`
- Modify: `CHANGELOG.md`

**Step 1: Run local after benchmarks**

```bash
./scripts/perf/benchmark_examples_api.sh local-after
cd frontend && npm run build && node scripts/analyze-bundle.mjs after
```

**Step 2: Run tests/build**

```bash
cd backend && pytest tests/test_content_examples_api.py tests/test_example_thumbnails.py -q
cd frontend && npm test -- --runInBand
cd frontend && npm run build
```

**Step 3: Production check**

Run the same benchmark scripts/commands against production endpoints with a short sample set and record them under `Production check`.

**Step 4: Commit**

```bash
git add docs/plans/2026-03-21-performance-block2-report.md CHANGELOG.md
git commit -m "docs(perf): record block 2 benchmark results"
```
