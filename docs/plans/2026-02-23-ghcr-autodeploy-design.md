# GHCR Autodeploy Design (master)

## Goal

Перевести production deploy на схему `GitHub Actions -> GHCR -> VPS` для ветки `master`, чтобы можно было безопасно выпускать фиксы с телефона через `Connect Codex web` без сборки на VPS.

## Scope

- Обновить GitHub Actions (`ci.yml`, `deploy.yml`) под `master`.
- Собирать и публиковать только `backend` и `frontend` образы.
- Добавить поддержку `image:` в `docker-compose.prod.yml` для сервисов `backend`, `frontend`, `celery_worker`, `celery_beat`.
- Деплоить на VPS `/root/ai-image-bot` с точным тегом `sha-<commit>`.

## Chosen Approach

- CI публикует 2 тега на каждый образ: `latest` и `sha-${GITHUB_SHA}`.
- Deploy job по SSH экспортирует `IMAGE_TAG=sha-${GITHUB_SHA}`, логинится в `ghcr.io`, делает `docker-compose pull`, затем `up -d` и миграции.
- В `docker-compose.prod.yml` остаются `build` секции как fallback для ручного деплоя/локальной сборки.

## Risks and Mitigations

- Отсутствуют `VITE_*` значения в CI: передавать через GitHub `Variables/Secrets`, задокументировать список.
- `telegram_bot` директория отсутствует: убрать сборку из workflow, чтобы не падал deploy.
- Приватный GHCR: использовать отдельный read-token на VPS (`read:packages`) и логин внутри deploy script.

## Success Criteria

- Push в `master` запускает deploy workflow.
- В GHCR появляются образы `backend` и `frontend` с тегами `latest` и `sha-...`.
- VPS подтягивает именно `sha-...` и успешно проходит `alembic upgrade head` и health-check `/health`.
