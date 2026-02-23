# GHCR CI/CD Setup (master)

Короткая инструкция для схемы автодеплоя `GitHub Actions -> GHCR -> VPS` с деплоем по точному тегу `sha-<commit>`.

## Что происходит

- Push в `master` запускает `.github/workflows/deploy.yml`.
- CI собирает образы `backend` и `frontend`.
- CI пушит их в GHCR с тегами:
  - `latest`
  - `sha-<full github sha>`
- Deploy job подключается к VPS по SSH, логинится в GHCR, экспортирует `IMAGE_TAG=sha-<commit>`, делает `docker-compose pull` и `up -d`.

## GitHub Secrets (Repository Secrets)

Обязательные:

- `VPS_HOST` — IP/домен VPS
- `VPS_PORT` — SSH порт (обычно `22`)
- `VPS_USERNAME` — SSH пользователь (например `root`)
- `VPS_SSH_KEY` — приватный SSH ключ для деплоя
- `VPS_GHCR_USERNAME` — GitHub username/robot-user для чтения пакетов GHCR на VPS
- `VPS_GHCR_READ_TOKEN` — PAT с правами минимум `read:packages` (при необходимости ещё `repo` для private repo metadata)

## GitHub Variables (Repository Variables)

Для фронтенд-сборки в CI (`frontend/Dockerfile.prod`):

- `VITE_API_BASE_URL`
- `VITE_APP_NAME`
- `VITE_GOOGLE_CLIENT_ID`
- `VITE_VK_APP_ID`
- `VITE_VK_REDIRECT_URI`
- `VITE_VK_AUTH_URL` (опционально; если пусто, задайте явно в Variables)
- `VITE_YANDEX_CLIENT_ID`
- `VITE_YANDEX_REDIRECT_URI`
- `VITE_TELEGRAM_BOT_NAME`
- `VITE_YANDEX_METRIKA_ID`

## Требования на VPS (один раз)

- Проект расположен в `/root/ai-image-bot`
- Есть `docker` и Docker Compose v2 (`docker compose`) или `docker-compose`
- В `docker-compose.prod.yml` используются `image:` с `IMAGE_TAG`
- Пользователь деплоя может выполнять `docker`/`docker-compose`

## Ручной запуск

- В GitHub: `Actions` -> `Deploy to Production` -> `Run workflow`
- Полезно для повторного деплоя того же commit после временных ошибок VPS/GHCR

## Автозаполнение через `gh` (без вывода секретов)

- Добавлен интерактивный скрипт: `scripts/setup-github-cicd-ghcr.sh`
- Скрипт:
  - проверяет `gh` и `gh auth status`
  - спрашивает секреты скрытым вводом (`read -s`)
  - загружает `VPS_SSH_KEY` из файла (не из буфера обмена)
  - записывает `Secrets`/`Variables` через `gh secret set` / `gh variable set`
  - по желанию запускает workflow `Deploy to Production`

Запуск:

```bash
./scripts/setup-github-cicd-ghcr.sh
```

## Откат (быстрый)

- На VPS задать более ранний тег и перезапустить сервисы:

```bash
cd /root/ai-image-bot
export IMAGE_TAG=sha-<older-commit-sha>
docker login ghcr.io -u "<user>" --password-stdin
docker-compose -f docker-compose.prod.yml pull backend celery_worker celery_beat frontend
docker-compose -f docker-compose.prod.yml up -d backend celery_worker celery_beat frontend
```

## Замечания

- `backend`, `celery_worker`, `celery_beat` используют один и тот же backend image.
- `build:` в `docker-compose.prod.yml` оставлен как fallback для ручной локальной/VPS сборки.
- На некоторых VPS с `docker-compose` v1.29.2 может проявляться баг `KeyError: 'ContainerConfig'` при `up`/recreate. В workflow `deploy.yml` используется `docker compose` (v2), если доступен, чтобы избежать этой проблемы.
