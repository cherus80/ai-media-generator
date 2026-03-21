# SPA SEO Head Injection Design

## Goal

Обеспечить корректные `title`, `meta description`, `meta robots` и `canonical` в сыром HTML ответа сервера для выбранных SPA-маршрутов до выполнения JavaScript.

## Chosen Approach

Используем build-time prerender/head injection вместо runtime SSR:

- единый SEO-источник правды остаётся в frontend;
- после `vite build` отдельный скрипт генерирует route-specific HTML-файлы для целевых маршрутов (`/login`, `/register`, `/forgot-password`, `/app`, `/app/about`, `/app/examples`, `/app/instructions`, `/pricing`, `/privacy`, `/contacts`);
- production nginx во frontend container сначала ищет `/$uri/index.html`, и только если route-specific файла нет, отдаёт общий `index.html`.

## Why This Approach

- Не трогаем backend SSR для `/examples` и `/examples/{slug}`.
- Нет runtime-логики на каждый запрос и практически нет штрафа по TTFB.
- Не нужно переносить React-приложение на полноценный SSR-стек.
- `curl` сразу видит нужные теги, потому что HTML уже предсобран и лежит как статический файл.

## Injection Point

- Инъекция выполняется в build step фронтенда: скрипт читает `frontend/dist/index.html`, подставляет route-specific `<head>` и сохраняет готовые HTML-файлы в `frontend/dist/<route>/index.html`.
- Раздача готовых файлов происходит во frontend nginx через `try_files $uri $uri/ $uri/index.html /index.html;`.

## Non-Goals

- Не внедряем полноценный React SSR.
- Не меняем SEO и routing для `/`, `/examples`, `/examples/{slug}`.
- Не добавляем runtime middleware, который переписывает HTML на каждый запрос.

## Verification

- Smoke-script делает реальный HTTP GET к локальному production-like static server и валидирует теги в raw HTML.
- Отдельно сохраняем гарантию, что `/examples*` остаются вне этого механизма.
