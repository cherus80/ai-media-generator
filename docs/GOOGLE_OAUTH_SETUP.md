# Google OAuth 2.0 Setup Guide

Это руководство поможет вам настроить Google OAuth 2.0 для веб-авторизации в AI Image Generator.

---

## Шаг 1: Создание проекта в Google Cloud Console

1. Перейдите в [Google Cloud Console](https://console.cloud.google.com/)
2. Создайте новый проект или выберите существующий
   - Нажмите на селектор проекта вверху страницы
   - Кликните "New Project"
   - Введите название: `AI Image Generator`
   - Нажмите "Create"

---

## Шаг 2: Включение Google+ API

1. В боковом меню выберите **APIs & Services** → **Library**
2. Найдите "Google+ API" (или "People API")
3. Нажмите "Enable"

---

## Шаг 3: Создание OAuth 2.0 Client ID

### 3.1. Настройка OAuth Consent Screen

1. Перейдите в **APIs & Services** → **OAuth consent screen**
2. Выберите тип пользователей:
   - **External** - для публичного приложения
   - Нажмите "Create"

3. Заполните обязательные поля:
   - **App name**: `AI Image Generator`
   - **User support email**: ваш email
   - **Developer contact email**: ваш email
   - Нажмите "Save and Continue"

4. Scopes (области доступа):
   - Нажмите "Add or Remove Scopes"
   - Выберите:
     - `openid`
     - `email`
     - `profile`
   - Нажмите "Update" → "Save and Continue"

5. Test users (опционально для разработки):
   - Добавьте свой Gmail для тестирования
   - Нажмите "Save and Continue"

6. Проверьте Summary и нажмите "Back to Dashboard"

### 3.2. Создание Credentials

1. Перейдите в **APIs & Services** → **Credentials**
2. Нажмите **Create Credentials** → **OAuth client ID**
3. Выберите **Application type**: **Web application**
4. Настройте:
   - **Name**: `AI Media Generator Web Client`

   - **Authorized JavaScript origins**:
     ```
     http://localhost:5173
     http://127.0.0.1:5173
     https://yourdomain.com
     ```

   - **Authorized redirect URIs**:
     ```
     http://localhost:5173
     http://127.0.0.1:5173
     https://yourdomain.com
     ```

5. Нажмите **Create**

---

## Шаг 4: Сохранение Credentials

После создания вы увидите диалог с:
- **Client ID** (например: `123456789-abc.apps.googleusercontent.com`)
- **Client Secret** (например: `GOCSPX-abc123def456`)

**Скопируйте эти значения!**

---

## Шаг 5: Настройка Backend (.env)

Добавьте в файл `backend/.env`:

```bash
# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-client-secret
```

**⚠️ Важно:** Никогда не коммитьте `.env` файл в Git!

---

## Шаг 6: Настройка Frontend

### 6.1. Добавьте Google Identity Services скрипт

В `frontend/index.html` добавьте в `<head>`:

```html
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

### 6.2. Добавьте Client ID в frontend/.env

```bash
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

---

## Шаг 7: Проверка настроек

### Backend проверка:

```bash
cd backend
# Проверьте, что переменные окружения загружены
python3 -c "from app.core.config import settings; print(settings.GOOGLE_CLIENT_ID)"
```

### Frontend проверка:

```bash
cd frontend
npm run dev
# Откройте http://localhost:5173
# Проверьте консоль браузера на ошибки
```

---

## Шаг 8: Тестирование OAuth Flow

1. Запустите backend:
   ```bash
   cd backend
   uvicorn app.main:app --reload
   ```

2. Запустите frontend:
   ```bash
   cd frontend
   npm run dev
   ```

3. Откройте http://localhost:5173
4. Нажмите кнопку "Sign in with Google"
5. Выберите аккаунт Google
6. Разрешите доступ к email и профилю
7. Вы должны быть перенаправлены обратно и авторизованы

---

## Troubleshooting

### Ошибка: "redirect_uri_mismatch"

**Проблема:** URL редиректа не совпадает с настройками в Google Cloud Console.

**Решение:**
1. Проверьте, что URL точно совпадает (включая порт)
2. Добавьте все возможные варианты:
   - `http://localhost:5173`
   - `http://127.0.0.1:5173`
   - Production URL

### Ошибка: "invalid_client"

**Проблема:** Client ID или Secret неверный.

**Решение:**
1. Проверьте `.env` файлы (backend и frontend)
2. Убедитесь, что скопировали правильные значения из Google Cloud Console
3. Перезапустите backend и frontend

### Ошибка: "access_denied"

**Проблема:** Пользователь отклонил запрос или не добавлен в Test Users.

**Решение:**
1. Если приложение в "Testing" режиме, добавьте пользователя в Test Users
2. Или переключите приложение в "Production" режим (требует верификации Google)

---

## Production Deployment

Перед деплоем в production:

1. **Обновите Authorized origins и redirect URIs:**
   ```
   https://yourdomain.com
   https://api.yourdomain.com
   ```

2. **Переключите OAuth Consent Screen в Production:**
   - Перейдите в **OAuth consent screen**
   - Нажмите "Publish App"
   - Может потребоваться верификация Google (для доступа >100 пользователей)

3. **Обновите переменные окружения на production сервере**

4. **Настройте HTTPS** (обязательно для OAuth в production)

---

## Дополнительные ресурсы

- [Google Identity Documentation](https://developers.google.com/identity)
- [OAuth 2.0 for Web Applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Google Sign-In for Websites](https://developers.google.com/identity/gsi/web)

---

## Безопасность

✅ **Рекомендации:**
- Никогда не коммитьте `GOOGLE_CLIENT_SECRET` в Git
- Используйте переменные окружения для всех секретов
- Ограничьте Authorized origins только вашими доменами
- Регулярно ротируйте Client Secret
- Включите 2FA на вашем Google аккаунте администратора

---

Готово! Теперь ваше приложение поддерживает авторизацию через Google OAuth 2.0. 🎉
