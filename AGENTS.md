# Claude Code Configuration - AI Image Bot

**Проект:** Telegram Mini App для виртуальной примерки одежды/украшений/аксессуаров
**Технологии:** React 18 + FastAPI + PostgreSQL + Docker
**Главное правило:** Пиши только ЧИСТЫЙ КОД без лишней документации!

---

## 🤖 ROUTING: Выбор агентов по типу задачи

### Frontend/UI
**Ключевые слова:** UI, интерфейс, кнопка, дизайн, React, TypeScript, компонент, CSS, Tailwind
```
Agents: Frontend Developer, UI/UX Designer
Skills: development/artifacts-builder, creative-design/theme-factory
Hooks: development-tools/lint-on-save, post-tool/format-javascript-files
```

### Backend/API
**Ключевые слова:** API, endpoint, базы данных, БД, FastAPI, Python, SQLAlchemy, Pydantic
```
Agents: Backend Architect, Fullstack Developer
Skills: development/mcp-builder
Hooks: post-tool/run-tests-after-changes, security/security-scanner
```

### Image Processing / Try-On (КРИТИЧНО!)
**Ключевые слова:** фото, примерка, обработка, загрузка, kie.ai, Nano Banana, face detection, pose
```
Agents: Ai Engineer, Prompt Engineer, Backend Architect
Skills: development/webapp-testing, development/artifacts-builder
Hooks: automation/telegram-notifications
```

### Telegram Bot / Notifications
**Ключевые слова:** Telegram, бот, уведомления, /start, команды, WebApp, webhook
```
Agents: Backend Architect, Fullstack Developer
Hooks: automation/telegram-notifications, automation/telegram-detailed-notifications
```

### Testing & Debugging
**Ключевые слова:** тест, ошибка, bug, debug, quality, CI/CD, test
```
Agents: Test Engineer & Debugger
Hooks: testing/test-runner, security/security-scanner
```

### Deployment / DevOps
**Ключевые слова:** docker, deploy, VPS, production, .env, docker-compose, Portainer
```
Agents: DevOps Engineer, Deployment Engineer
Hooks: git-workflow/smart-commit, automation/telegram-notifications
```

---

## ✅ ALWAYS ENABLED HOOKS

```
✅ development-tools/lint-on-save       (линтинг после редактирования)
✅ development-tools/file-backup        (backup перед редактированием)
✅ git-workflow/smart-commit            (умные commit messages)
✅ security/security-scanner            (проверка безопасности)
```

---

## 🚫 CRITICAL RULES

### ❌ НЕ ТРОГАЙТЕ (PROTECTED FILES)
- `docker-compose.yml`
- `docker-compose.prod.yml`
- `.env`
- `vps-deploy-script.sh`

### ❌ КОД ПРАВИЛА

1. **НИКОГДА** не сокращайте код комментариями типа `# ... existing code ...`
   - ВСЕГДА показывайте полный код модуля/функции

2. **ПЕРЕД** созданием кода — ищите существующие реализации
   - Используйте функции/компоненты которые уже есть
   - Не создавайте дубли

3. **ТЕСТИРУЙТЕ** сразу после написания
   - Запускайте тесты перед commit'ом

4. **БЕЗ ЛИШНЕЙ ДОКУМЕНТАЦИИ**
   - ❌ Не создавайте новые .md файлы
   - ❌ Не обновляйте CHANGELOG.md
   - ✅ Только код в коммитах

---

## 📍 PROJECT INDEX

Используй `.claude/project-index.json` для быстрого поиска нужных файлов!

---

## 🔄 AUTO-UPDATE PROJECT INDEX

Если ты добавляешь новые компоненты/модули/endpoints:

1. Обновляешь `.claude/project-index.json`
2. Добавляешь новый путь в соответствующую секцию
3. Коммитишь с сообщением: `chore: update project-index.json`

---

## 🚀 QUICK START

```bash
./start-dev.sh              # Запустить dev
./stop-dev.sh               # Остановить dev
./vps-deploy-script.sh      # Deploy на VPS
docker-compose -f docker-compose.dev.yml up    # Docker dev
```

---

## 📋 KEY PRINCIPLES

1. **Lean Documentation** — только то что нужно
2. **Clean Code** — без сокращений и комментариев
3. **Smart Routing** — правильные агенты для каждой задачи
4. **Protected Files** — не трогай конфиги и деплой скрипты
5. **Auto-Update Index** — обновляй проект-индекс при изменениях


---

## READ FIRST: CODE QUALITY RULES

**BEFORE writing any code, please read: [`CODE_RULES.md`](./CODE_RULES.md)**

These rules define how Claude Code must behave when fixing bugs:
- FORBIDDEN: Delete code, create stubs, or ignore errors
- MANDATORY: Fix root causes, test changes, show full code

No exceptions - these apply to ALL tasks!
