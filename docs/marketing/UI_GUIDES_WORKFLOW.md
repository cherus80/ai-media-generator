# UI-гайды и продающие статьи с реальными скриншотами (prod)

Цель: быстро и **повторяемо** получать актуальные скриншоты интерфейса и писать на их основе качественные гайды/статьи.

## 1) Док‑аккаунт (prod)

Для скриншотов используется отдельный “док‑пользователь” в production, без прав администратора.

Локальные креды хранятся в:

- `tmp/doc_user_prod.json` (файл **в git не попадает**)

## 2) Снятие скриншотов через Playwright

Рекомендуемый способ — запуск сценария из skill:

```bash
 # Один раз на машине: скачать браузер для Playwright
 npx playwright install chromium

node skills/ui-guides-playwright/scripts/capture_prod_screenshots.mjs \
  --base-url https://ai-generator.mix4.ru \
  --creds-file tmp/doc_user_prod.json
```

Скриншоты складываются в `output/playwright/...` (gitignored).

## 3) Черновик гайда по manifest.json

После снятия скриншотов скрипт создаёт `manifest.json` со списком кадров.

Черновик гайда можно сгенерировать так:

```bash
python3 skills/ui-guides-playwright/scripts/draft_guide.py \
  --manifest output/playwright/<run-id>/manifest.json \
  --slug quickstart \
  --title "Как начать: примерка и редактирование" \
  --out docs/marketing/guides/quickstart.md
```

## 4) Публикуемые ассеты

Сырые скриншоты — в `output/playwright/` (локально).

Если нужно хранить “публичные” скриншоты в репозитории (для документации/лендингов), кладите отобранные файлы в:

- `docs/assets/screenshots/<slug>/...`

И ссылайтесь на них из Markdown.
