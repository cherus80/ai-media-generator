# 🔴 Поля, которые нужно заполнить ПРЯМО СЕЙЧАС

## Backend: `backend/.env`

Откройте файл и замените следующие строки:

### 1. Google OAuth (строки 28-29)
```bash
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### 2. OpenRouter API
```bash
OPENROUTER_API_KEY=your-openrouter-api-key-here
```

---

## Frontend: `frontend/.env`

Откройте файл и замените следующую строку:

### Google OAuth Client ID (строка 13)
```bash
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

**Важно:** Используйте тот же Client ID, что и в backend!

---

## 📚 Где взять ключи?

### Google OAuth
1. Следуйте [docs/GOOGLE_OAUTH_SETUP.md](docs/GOOGLE_OAUTH_SETUP.md)
2. Или перейдите на https://console.cloud.google.com/
3. Создайте проект → OAuth consent screen → Credentials
4. Скопируйте Client ID и Client Secret

### OpenRouter API
1. Зарегистрируйтесь на https://openrouter.ai
2. Получите API ключ в настройках аккаунта

---

## ✅ Всё остальное уже настроено!

- ✅ SECRET_KEY - сгенерирован
- ✅ JWT_SECRET_KEY - сгенерирован
- ✅ ADMIN_SECRET_KEY - сгенерирован
- ✅ Database настройки (для локального использования)
- ✅ Frontend/Backend URLs

---

## 🚀 После заполнения:

1. Запустите PostgreSQL:
   ```bash
   docker-compose up -d postgres
   ```

2. Примените миграцию:
   ```bash
   cd backend && alembic upgrade head
   ```

3. Запустите приложение:
   ```bash
   # Backend
   cd backend && uvicorn app.main:app --reload

   # Frontend
   cd frontend && npm run dev
   ```

4. Откройте http://localhost:5173

---

**Подробное руководство:** [ENV_SETUP_GUIDE.md](ENV_SETUP_GUIDE.md)
