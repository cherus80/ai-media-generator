# Claude Code Configuration – AI Media Generator (web version)

**Проект:** Веб‑приложение для виртуальной примерки одежды и AI-редактирования изображений.
**Технологии:** React 18 + Vite + Tailwind, FastAPI + Celery, PostgreSQL, Redis, Docker, ЮKassa.
**Главное правило:** чистый код, упор на безопасность, антиабуз и быструю разработку.

---

## 🚦 Роутинг задач

### Frontend / UI
**Ключевые слова:** UI, React, TypeScript, компонент, Zustand, Tailwind.
```
Agents: Frontend Developer, UI/UX Designer
Hooks: development-tools/lint-on-save, post-tool/format-javascript-files
```

### Backend / API / Billing
**Ключевые слова:** FastAPI, Celery, PostgreSQL, Redis, ЮKassa, anti-abuse, JWT.
```
Agents: Backend Architect, Fullstack Developer
Hooks: post-tool/run-tests-after-changes, security/security-scanner
```

### Image Processing / Try-on
**Ключевые слова:** примерка, kie.ai, обработка изображений, кредиты, очереди.
```
Agents: AI Engineer, Backend Architect
Hooks: development/artifacts-builder
```

### Security / Compliance
**Ключевые слова:** rate limit, device fingerprint, логирование, РФ, ПДн.
```
Agents: Security Engineer, DevOps Engineer
Hooks: security/security-scanner
```

### Testing / QA
**Ключевые слова:** тест, playwright, pytest, CI, баг.
```
Agents: Test Engineer, Debugger
Hooks: testing/test-runner
```

### Deployment / DevOps
**Ключевые слова:** docker, nginx, ssl, VPS, бэкапы.
```
Agents: DevOps Engineer, Deployment Engineer
Hooks: automation/telegram-notifications (если нужно), git-workflow/smart-commit
```

---

## ✅ Always enabled hooks
```
development-tools/lint-on-save
development-tools/file-backup
git-workflow/smart-commit
security/security-scanner
```

---

## ❗ Критические правила

1. **Работаем только с веб-версией.** Авторизация — email/SMS, UI — React SPA.
2. **Не создаём бессмысленную документацию.** README/TODO/DEPLOY.md уже описывают архитектуру; новые файлы только по необходимости.
3. **Каждый PR сопровождаем тестами.** Pytest/Playwright или ручные шаги, если автотесты невозможны.
4. **Внимание безопасности.** Учитываем ограничения РФ (ПДн, НПД), антиабуз (лимиты, fingerprint, юзкейсы).
5. **Используем существующие функции.** Прежде чем писать новый сервис/компонент, ищем реализованное решение.

---

## 📍 Project index

Используйте `.claude/project-index.json` для быстрой навигации. При добавлении новых ключевых файлов не забывайте обновлять индекс (коммит `chore: update project-index.json`).

---

## ℹ️ Дополнительно

- Основной чек-лист деплоя находится в `docs/deployment/DEPLOY.md` (Post deploy checklist).
- Roadmap и приоритеты — в `TODO.md` (обновлена под веб‑архитектуру).
- Любые интеграции с внешними сервисами держим в `.env.example` / `backend/.env.example` — без жёстких констант.
