---
name: ui-guides-playwright
description: Use when writing user guides or marketing articles for this web app and needing real, up-to-date UI screenshots from production with reproducible Playwright flows.
---

# UI Guides + Скриншоты (Playwright)

Этот skill нужен, когда пользователь просит: “напиши гайд/продающую статью по приложению” и важно опираться на **реальные скриншоты** и **реальные шаги в UI**.

## Базовый принцип качества

1) Сначала фиксируем, **какой материал** нужен (гайд или продажная статья, аудитория, цель, CTA).  
2) Затем снимаем **свежие** скриншоты под конкретный сценарий.  
3) Потом пишем текст **строго по шагам**, с привязкой к кадрам (и без утечек секретов).

## Входные данные (которые нужно запросить у пользователя)

- Что пишем: `гайд` или `продающая статья`
- Для кого: новичок / продвинутый / “холодный” трафик
- Какая фича: примерка / редактирование / примеры / профиль / оплата
- Где публикуем: сайт / VK / Telegram / Medium / другое
- Язык: RU/EN

## Скриншоты (prod) — рекомендуемый сценарий

Скрипт логинится под док‑пользователем и делает серию скриншотов ключевых экранов.

Требования:
- `node` + `npx` доступны
- Playwright установлен (`npm i` в корне проекта)
- Креды док‑пользователя лежат в `tmp/doc_user_prod.json` (не коммитить!)

Команда:

```bash
 # Один раз на машине: скачать браузер для Playwright
 npx playwright install chromium

node skills/ui-guides-playwright/scripts/capture_prod_screenshots.mjs \
  --base-url https://ai-generator.mix4.ru \
  --creds-file tmp/doc_user_prod.json
```

Результат:
- Папка `output/playwright/<run-id>/`
- `manifest.json` со списком кадров

## Черновик гайда (Markdown)

Сгенерировать каркас статьи по `manifest.json`:

```bash
python3 skills/ui-guides-playwright/scripts/draft_guide.py \
  --manifest output/playwright/<run-id>/manifest.json \
  --slug <slug> \
  --title "<title>" \
  --out docs/marketing/guides/<slug>.md
```

Далее: вручную (или по запросу пользователя) дополни текст: введение, шаги, советы, FAQ, CTA.

## Правила безопасности и “не палить секреты”

- Никогда не вставляй в ответ пароль/токены/содержимое `.env`.
- Не показывай админку/внутренние панели, если пользователь не просил.
- Если на скриншоте есть персональные данные — предложи замазать/переснять.

## Шаблоны текста

Смотри: `skills/ui-guides-playwright/references/article_templates_ru.md`

