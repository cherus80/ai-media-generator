# Руководство по настройке .env файлов

Файлы `.env` уже созданы в `backend/.env` и `frontend/.env`. Секретные ключи для безопасности уже сгенерированы автоматически.

---

## 🔴 Обязательные поля для заполнения

### Backend (`backend/.env`)

#### 1. **Google OAuth** (обязательно для веб-авторизации)
```bash
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

**Как получить:**
- Следуйте инструкциям в [docs/GOOGLE_OAUTH_SETUP.md](docs/GOOGLE_OAUTH_SETUP.md)
- Создайте проект в [Google Cloud Console](https://console.cloud.google.com/)
- Получите Client ID и Client Secret

#### 2. **OpenRouter API** (для виртуальной примерки и AI-промптов)
```bash
OPENROUTER_API_KEY=your-openrouter-api-key-here
```

**Как получить:**
- Зарегистрируйтесь на [OpenRouter](https://openrouter.ai)
- Получите API ключ в настройках

### Frontend (`frontend/.env`)

#### **Google OAuth Client ID**
```bash
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

**Важно:** Это должен быть **тот же Client ID**, что и в backend!

---

## 🟡 Опциональные поля

### База данных PostgreSQL
По умолчанию настроена для локального использования:
```bash
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=ai_image_bot
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
```

Измените, если используете другие настройки.

### ЮKassa (для платежей)
```bash
YUKASSA_SHOP_ID=your-yukassa-shop-id
YUKASSA_SECRET_KEY=your-yukassa-secret-key
YUKASSA_WEBHOOK_SECRET=your-webhook-secret
```

Для локального тестирования можно включить mock режим:
```bash
PAYMENT_MOCK_MODE=true
```

### Telegram Bot (Legacy, опционально)
Если нужна обратная совместимость с Telegram:
```bash
TELEGRAM_BOT_TOKEN=your-bot-token-here
TELEGRAM_BOT_SECRET=your-telegram-secret-for-webapp-validation
BOT_USERNAME=YourBotUsername
```

---

## ✅ Уже настроено автоматически

Следующие поля уже имеют безопасные сгенерированные значения:

- ✅ `SECRET_KEY` - сгенерирован случайный ключ
- ✅ `JWT_SECRET_KEY` - сгенерирован случайный ключ
- ✅ `ADMIN_SECRET_KEY` - сгенерирован случайный ключ
- ✅ `FRONTEND_URL` - настроен на localhost:5173
- ✅ `VITE_API_BASE_URL` - настроен на localhost:8000

---

## 📝 Checklist для запуска

### Минимальная конфигурация (только веб-авторизация):
- [ ] `GOOGLE_CLIENT_ID` (backend + frontend)
- [ ] `GOOGLE_CLIENT_SECRET` (backend)
- [ ] PostgreSQL запущен (Docker или локально)

### Полная конфигурация (с генерацией изображений):
- [ ] `GOOGLE_CLIENT_ID` (backend + frontend)
- [ ] `GOOGLE_CLIENT_SECRET` (backend)
- [ ] `OPENROUTER_API_KEY`
- [ ] PostgreSQL запущен
- [ ] Redis запущен (для фоновых задач)

---

## 🚀 Следующие шаги

### 1. Заполните обязательные поля
Откройте `backend/.env` и `frontend/.env` и замените:
- `your-google-client-id.apps.googleusercontent.com`
- `your-google-client-secret`
- `your-openrouter-api-key-here`

### 2. Запустите инфраструктуру
```bash
# Запустите PostgreSQL и Redis через Docker
docker-compose up -d postgres redis
```

### 3. Примените миграцию базы данных
```bash
cd backend
alembic upgrade head
```

### 4. Запустите приложение
```bash
# Terminal 1: Backend
cd backend
uvicorn app.main:app --reload

# Terminal 2: Frontend
cd frontend
npm run dev
```

### 5. Откройте браузер
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000/docs

---

## ⚠️ Важно для Production

Перед деплоем на production:

1. **Обновите Authorized Origins в Google Cloud Console**
   - Добавьте ваш production домен
   - Например: `https://yourdomain.com`

2. **Измените переменные окружения**
   ```bash
   ENVIRONMENT=production
   DEBUG=False
   FRONTEND_URL=https://yourdomain.com
   VITE_API_BASE_URL=https://api.yourdomain.com
   ```

3. **Используйте управляемую БД**
   - Не используйте `localhost` в production
   - Используйте managed PostgreSQL (AWS RDS, DigitalOcean, и т.д.)

4. **Настройте HTTPS**
   - Обязательно для Google OAuth!
   - Используйте nginx с Let's Encrypt

5. **Ротируйте секретные ключи**
   - Сгенерируйте новые `SECRET_KEY`, `JWT_SECRET_KEY`, `ADMIN_SECRET_KEY`
   - Никогда не используйте одни и те же ключи для development и production!

---

## 🔒 Безопасность

**НЕ КОММИТЬТЕ `.env` файлы в Git!**

Файлы `.env` уже добавлены в `.gitignore`, но всегда проверяйте:
```bash
git status
```

Если случайно закоммитили секреты:
1. Немедленно ротируйте все ключи
2. Используйте `git filter-branch` или BFG Repo-Cleaner для очистки истории

---

**Готово!** После заполнения обязательных полей ваше приложение готово к запуску.
