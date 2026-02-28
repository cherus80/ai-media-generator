# 📚 Documentation Index

**AI Generator** - Полный индекс документации проекта

**Версия проекта**: v0.12.0
**Дата обновления**: 2025-11-18

---

## 🚀 Быстрый старт (для новых AI-ассистентов)

**Читайте в этом порядке**:

1. **[FOR_AI_ASSISTANTS.md](FOR_AI_ASSISTANTS.md)** ⭐
   - Критически важные правила
   - Быстрый контекст проекта
   - Troubleshooting guide

2. **[docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md)** ⭐
   - Текущий статус (что работает, что нет)
   - Исправленные проблемы
   - Следующие шаги

3. **[docs/WEB_AUTH_IMPLEMENTATION.md](docs/WEB_AUTH_IMPLEMENTATION.md)** ⭐
   - Детальная документация веб-аутентификации
   - Все 8 исправленных багов
   - Результаты E2E тестирования

4. **[CHANGELOG.md](CHANGELOG.md)**
   - История изменений
   - Версии проекта

---

## 📂 Структура документации

### Основные документы

| Файл | Описание | Для кого |
|------|----------|---------|
| [README.md](README.md) | Общее описание проекта | Все |
| [FOR_AI_ASSISTANTS.md](FOR_AI_ASSISTANTS.md) | **Старт для AI-ассистентов** | Claude Code, GPT Codex |
| [CHANGELOG.md](CHANGELOG.md) | История изменений | Все |
| [QUICK_START.md](QUICK_START.md) | Быстрый запуск для тестирования | Разработчики |

### Технические документы (docs/)

| Файл | Описание | Статус |
|------|----------|--------|
| [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) | **Текущий статус проекта** | ⭐ Обновлен |
| [docs/WEB_AUTH_IMPLEMENTATION.md](docs/WEB_AUTH_IMPLEMENTATION.md) | **Реализация веб-аутентификации** | ⭐ Новый |
| [docs/deployment/DEPLOY.md](docs/deployment/DEPLOY.md) | Production deployment | Актуален |
| [docs/MCP_PLAYWRIGHT_SETUP.md](docs/MCP_PLAYWRIGHT_SETUP.md) | E2E тестирование | Актуален |

### Конфигурация

| Файл | Описание |
|------|----------|
| [backend/.env](backend/.env) | Backend конфигурация |
| [frontend/.env](frontend/.env) | Frontend конфигурация |
| [.env.example](.env.example) | Шаблон переменных окружения |

---

## 🎯 Быстрая навигация по задачам

### Хочу понять, что было сделано

➡️ Читайте:
1. [docs/WEB_AUTH_IMPLEMENTATION.md](docs/WEB_AUTH_IMPLEMENTATION.md) - детальный отчет
2. [CHANGELOG.md](CHANGELOG.md) - краткая версия

### Хочу запустить проект

➡️ Читайте:
1. [QUICK_START.md](QUICK_START.md) - шаги для запуска
2. [FOR_AI_ASSISTANTS.md](FOR_AI_ASSISTANTS.md) - раздел "Как запустить"

### Хочу добавить новую функцию

➡️ Читайте:
1. [FOR_AI_ASSISTANTS.md](FOR_AI_ASSISTANTS.md) - правила и best practices
2. [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) - ключевые файлы
3. [docs/WEB_AUTH_IMPLEMENTATION.md](docs/WEB_AUTH_IMPLEMENTATION.md) - примеры реализации

### Хочу исправить баг

➡️ Читайте:
1. [FOR_AI_ASSISTANTS.md](FOR_AI_ASSISTANTS.md) - раздел "Troubleshooting"
2. [docs/WEB_AUTH_IMPLEMENTATION.md](docs/WEB_AUTH_IMPLEMENTATION.md) - раздел "Проблемы и их решения"

### Хочу задеплоить на production

➡️ Читайте:
1. [docs/deployment/DEPLOY.md](docs/deployment/DEPLOY.md) - инструкции
2. [docs/WEB_AUTH_IMPLEMENTATION.md](docs/WEB_AUTH_IMPLEMENTATION.md) - раздел "Deployment Checklist"

---

## 📊 Важные метрики документации

- **Всего документов**: 12+
- **Новых документов в v0.12.0**: 4
- **Обновленных документов**: 3
- **Примеров кода**: 50+
- **Исправленных багов**: 8

---

## 🔍 Поиск по ключевым словам

### Authentication
- [docs/WEB_AUTH_IMPLEMENTATION.md](docs/WEB_AUTH_IMPLEMENTATION.md)
- [FOR_AI_ASSISTANTS.md](FOR_AI_ASSISTANTS.md) - раздел "Критически важные правила"

### Database
- [docs/WEB_AUTH_IMPLEMENTATION.md](docs/WEB_AUTH_IMPLEMENTATION.md) - раздел "Database"
- [README.md](README.md) - раздел "База данных"

### API Endpoints
- [docs/WEB_AUTH_IMPLEMENTATION.md](docs/WEB_AUTH_IMPLEMENTATION.md) - раздел "Backend"
- Backend Swagger: http://localhost:8000/docs

### Testing
- [docs/WEB_AUTH_IMPLEMENTATION.md](docs/WEB_AUTH_IMPLEMENTATION.md) - раздел "Тестирование"
- [docs/MCP_PLAYWRIGHT_SETUP.md](docs/MCP_PLAYWRIGHT_SETUP.md)

### Deployment
- [docs/deployment/DEPLOY.md](docs/deployment/DEPLOY.md)
- [docs/WEB_AUTH_IMPLEMENTATION.md](docs/WEB_AUTH_IMPLEMENTATION.md) - раздел "Deployment Checklist"

### Troubleshooting
- [FOR_AI_ASSISTANTS.md](FOR_AI_ASSISTANTS.md) - раздел "Troubleshooting"
- [docs/WEB_AUTH_IMPLEMENTATION.md](docs/WEB_AUTH_IMPLEMENTATION.md) - раздел "Проблемы и их решения"

---

## 📝 Что документировано в v0.12.0

### ✅ Полностью задокументировано

- Email/Password authentication
- Google OAuth integration
- JWT token management
- Password hashing and validation
- Frontend auth pages (LoginPage, RegisterPage)
- Zustand state management
- API endpoints (/api/v1/auth-web/*)
- Database schema changes
- Все 8 исправленных багов
- E2E тестирование с Playwright

### 📝 Частично задокументировано

- Telegram WebApp integration (legacy)
- Image generation workflow
- Payment system (YuKassa)
- Admin panel

### ❌ Требует документации

- Email verification flow
- Password reset flow
- Two-factor authentication
- Social login (Facebook, Apple)

---

## 🎓 Обучающие материалы

### Для начинающих

1. [QUICK_START.md](QUICK_START.md) - запуск за 5 минут
2. [README.md](README.md) - обзор проекта
3. [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) - текущее состояние

### Для опытных разработчиков

1. [docs/WEB_AUTH_IMPLEMENTATION.md](docs/WEB_AUTH_IMPLEMENTATION.md) - технические детали
2. [FOR_AI_ASSISTANTS.md](FOR_AI_ASSISTANTS.md) - best practices
3. [CHANGELOG.md](CHANGELOG.md) - история решений

### Для AI-ассистентов (Claude Code, GPT Codex)

1. **[FOR_AI_ASSISTANTS.md](FOR_AI_ASSISTANTS.md)** - НАЧНИТЕ ЗДЕСЬ! ⭐
2. [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) - контекст проекта
3. [docs/WEB_AUTH_IMPLEMENTATION.md](docs/WEB_AUTH_IMPLEMENTATION.md) - детали реализации

---

## 🔄 Когда обновлять документацию

### После каждого изменения:
- [ ] Обновите [CHANGELOG.md](CHANGELOG.md)
- [ ] Обновите [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md)

### После добавления features:
- [ ] Создайте детальную документацию (как WEB_AUTH_IMPLEMENTATION.md)
- [ ] Обновите [README.md](README.md)
- [ ] Обновите [FOR_AI_ASSISTANTS.md](FOR_AI_ASSISTANTS.md)

### После исправления багов:
- [ ] Добавьте в раздел "Fixed" в [CHANGELOG.md](CHANGELOG.md)
- [ ] Добавьте в "Troubleshooting" в [FOR_AI_ASSISTANTS.md](FOR_AI_ASSISTANTS.md)

---

## 📞 Контакты

- **Автор документации**: Claude Code
- **Последнее обновление**: 2025-11-18
- **Версия документации**: 1.0

---

## ✅ Checklist для AI-ассистентов

Перед началом работы убедитесь, что прочитали:

- [ ] FOR_AI_ASSISTANTS.md
- [ ] docs/PROJECT_STATUS.md
- [ ] docs/WEB_AUTH_IMPLEMENTATION.md (если работаете с auth)
- [ ] CHANGELOG.md (последние 2-3 версии)

---

**Happy Coding!** 🚀

**Сделано с ❤️ с помощью Claude Code**
