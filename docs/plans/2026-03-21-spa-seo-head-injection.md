# SPA SEO Head Injection Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Отдавать route-specific SEO-мета в сыром HTML для целевых SPA-маршрутов без runtime SSR и без изменения `/`, `/examples`, `/examples/{slug}`.

**Architecture:** После `vite build` скрипт генерирует отдельные HTML-файлы на основе `dist/index.html` с route-specific `<title>`, `description`, `robots`, `canonical`. Frontend nginx сначала ищет `/$uri/index.html`, а если route-specific файла нет, возвращает обычный SPA `index.html`.

**Tech Stack:** Vite, TypeScript, Node.js build scripts, nginx static serving.

---

### Task 1: Подготовить единый SEO-источник и smoke-script

**Files:**
- Create: `frontend/src/seo/routeSeoData.json`
- Modify: `frontend/src/seo/routeSeo.ts`
- Create: `frontend/scripts/smoke-seo-html.mjs`

**Step 1: Вынести route SEO data**

- Перенести route-specific мета в JSON/общую структуру, чтобы её читали и runtime code, и build scripts.

**Step 2: Написать failing smoke-script**

Run: `npm run build && node scripts/smoke-seo-html.mjs`
Expected: FAIL, потому что до реализации `/login` и другие SPA-роуты всё ещё отдают общий `index.html`.

### Task 2: Генерация route-specific HTML

**Files:**
- Create: `frontend/scripts/generate-route-html.mjs`
- Modify: `frontend/package.json`

**Step 1: Сгенерировать HTML-файлы после сборки**

- Читать `dist/index.html`.
- Для каждого целевого маршрута создавать `dist/<route>/index.html`.
- Подменять `title`, `description`, `robots`, `canonical` в `<head>`.

**Step 2: Включить генерацию в build pipeline**

- Добавить post-build шаг в `npm run build`.

### Task 3: Настроить nginx routing

**Files:**
- Modify: `frontend/nginx.conf`

**Step 1: Отдавать route-specific HTML**

- Использовать `try_files $uri $uri/ $uri/index.html /index.html;`.

**Step 2: Не ломать SPA fallback**

- Для прочих маршрутов по-прежнему отдавать общий `index.html`.

### Task 4: Верификация и документация

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `CONTINUITY.md`

**Step 1: Прогнать smoke-check**

Run: `cd frontend && node scripts/smoke-seo-html.mjs`
Expected: PASS по целевым маршрутам raw HTML.

**Step 2: Прогнать frontend build**

Run: `cd frontend && npm run build`
Expected: PASS

**Step 3: Проверить git status**

Run: `git status --short`
Expected: только файлы по SEO head injection, без `output/`.
