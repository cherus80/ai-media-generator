# Russian Branding Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Русифицировать пользовательские упоминания `AI` и `AI Generator` в приложении, письмах и юридических страницах без поломки технических идентификаторов.

**Architecture:** Меняем только отображаемые строки и SEO-мета в frontend/backend public surface. Домены, e-mail, env-ключи, маршруты API и внутренние кодовые имена остаются без изменений, чтобы не сломать интеграции и доставку почты.

**Tech Stack:** React, TypeScript, FastAPI, server-rendered public HTML, email templates.

---

### Task 1: Определить безопасный scope замены

**Files:**
- Modify: `CONTINUITY.md`
- Inspect: `frontend/src/**/*.tsx`
- Inspect: `backend/app/**/*.py`

**Step 1: Проверить юридическое основание**

Run: `web search по официальным/деловым источникам про закон о русском языке с 1 марта 2026`
Expected: есть подтверждение, что бренды/товарные знаки отдельно исключаются или регулируются иначе.

**Step 2: Составить правило замены**

- `AI Generator` -> `ИИ Генератор`
- `AI-...` / `AI ...` в пользовательских текстах -> `ИИ-...` / `ИИ ...`
- Не менять домены, e-mail, env-ключи, API-paths и кодовые идентификаторы.

### Task 2: Обновить пользовательский frontend

**Files:**
- Modify: `frontend/index.html`
- Modify: `frontend/src/pages/**/*.tsx`
- Modify: `frontend/src/components/**/*.tsx`
- Modify: `frontend/src/api/referral.ts`
- Modify: `frontend/src/utils/*.ts`

**Step 1: Заменить брендовые тексты**

Обновить alt/title/meta/CTA/footer/legal text с `AI Generator` на `ИИ Генератор`.

**Step 2: Заменить общие AI-формулировки**

Обновить `AI-редактирование`, `AI-ассистент`, `AI-композиция`, `с помощью AI` и похожие строки на русские формы.

### Task 3: Обновить backend user-facing texts

**Files:**
- Modify: `backend/app/services/email.py`
- Modify: `backend/app/api/public_examples.py`
- Modify: `backend/app/core/config.py`
- Modify: `backend/app/services/watermark.py`

**Step 1: Письма и subjects**

Заменить бренд и AI-термины в шаблонах и темах писем.

**Step 2: SSR/public pages и watermark**

Обновить заголовки и описания public examples, а также видимый watermark text.

### Task 4: Проверить и задокументировать

**Files:**
- Modify: `CONTINUITY.md`
- Inspect: `git status`

**Step 1: Прогнать целевой поиск**

Run: `rg -n 'AI Generator|\\bAI\\b|AI-' frontend backend`
Expected: остаются только технические/внутренние упоминания.

**Step 2: Проверить статус репозитория**

Run: `git status --short`
Expected: изменены только целевые файлы по русификации.
