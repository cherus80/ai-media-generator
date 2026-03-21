# SEO Indexation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Настроить корректные `robots`, `title`, `description` и `canonical` для SPA-роутов без регрессии публичных SEO-страниц.

**Architecture:** Централизованные мета-теги остаются в `frontend/src/hooks/useSeo.ts`, а нужные маршруты получают явные вызовы `useSeo`. Проверка идёт через `jest + jsdom`, где роут рендерится в тестовом DOM и затем читаются `<title>`, `<meta name="robots">` и `<link rel="canonical">`.

**Tech Stack:** React, TypeScript, React Router, Jest, jsdom, esbuild transformer.

---

### Task 1: Подготовить тестовый раннер frontend

**Files:**
- Create: `frontend/jest.config.cjs`
- Create: `frontend/test/esbuildTransform.cjs`
- Create: `frontend/test/styleMock.cjs`
- Create: `frontend/test/fileMock.cjs`
- Create: `frontend/test/setupTests.ts`

**Step 1: Добавить конфигурацию Jest**

- Использовать `testEnvironment: 'jsdom'`.
- Подключить `setupFilesAfterEnv`.
- Настроить `transform` через локальный `esbuild` transformer для `.ts/.tsx/.js/.jsx`.

**Step 2: Заглушить статику и стили**

- Смокать CSS и asset imports, чтобы маршруты можно было рендерить без Vite.

### Task 2: Написать падающий SEO-регрессионный тест

**Files:**
- Create: `frontend/src/__tests__/seo-routes.test.tsx`

**Step 1: Зафиксировать целевые маршруты**

- Проверить `robots=noindex,follow` для `/login`, `/register`, `/forgot-password`, `/app`, `/app/about`, `/app/examples`, `/app/instructions`.
- Проверить уникальные `title`/`description`/`canonical` для `/pricing`, `/privacy`, `/contacts`.
- Проверить, что `/` остаётся `index, follow`.

**Step 2: Запустить тест и увидеть красное состояние**

Run: `npm test -- --runInBand --runTestsByPath src/__tests__/seo-routes.test.tsx`
Expected: тест падает на отсутствующих SEO-хуках или неверном `robots`.

### Task 3: Внести минимальные SEO-изменения

**Files:**
- Modify: `frontend/src/hooks/useSeo.ts`
- Modify: `frontend/src/pages/LoginPage.tsx`
- Modify: `frontend/src/pages/RegisterPage.tsx`
- Modify: `frontend/src/pages/ForgotPasswordPage.tsx`
- Modify: `frontend/src/pages/HomePage.tsx`
- Modify: `frontend/src/pages/AboutPage.tsx`
- Modify: `frontend/src/pages/ExamplesPage.tsx`
- Modify: `frontend/src/pages/InstructionsPage.tsx`
- Modify: `frontend/src/pages/PricingPage.tsx`
- Modify: `frontend/src/pages/PrivacyPage.tsx`
- Modify: `frontend/src/pages/ContactsPage.tsx`

**Step 1: Исправить robots policy**

- Меняем `noindex` режим на `noindex,follow`.

**Step 2: Добавить SEO на служебные страницы**

- Проставить `useSeo(..., noIndex: true)` на логин/регистрацию/сброс пароля и внутренние `/app*` страницы из задачи.

**Step 3: Уточнить коммерческие мета**

- Задать отдельные осмысленные `title` и `description` для `/pricing`, `/privacy`, `/contacts`; canonical оставить абсолютным на текущем origin.

### Task 4: Верификация и документация

**Files:**
- Modify: `CONTINUITY.md`
- Modify: `CHANGELOG.md`

**Step 1: Прогнать тесты и сборку**

Run: `npm test -- --runInBand --runTestsByPath src/__tests__/seo-routes.test.tsx`
Expected: PASS

Run: `npm run build`
Expected: PASS

**Step 2: Обновить проектную документацию**

- Коротко зафиксировать SEO-изменение в `CHANGELOG.md`.
- Обновить `CONTINUITY.md` по фактическому состоянию.

**Step 3: Проверить git-состояние**

Run: `git status --short`
Expected: изменены только файлы, относящиеся к SEO-задаче и тестовой конфигурации.
