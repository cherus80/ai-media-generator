# Настройка MCP серверов для Claude Code

Этот документ описывает настройку и использование MCP (Model Context Protocol) серверов Context7 и Playwright в VS Code с расширением Claude Code.

## Что такое MCP?

Model Context Protocol (MCP) — это стандартизированный протокол для подключения AI-ассистентов к внешним инструментам и источникам данных. MCP серверы расширяют возможности Claude Code, предоставляя доступ к документации библиотек, автоматизации браузера и другим функциям.

## Установленные MCP серверы

### 1. Context7 (`@upstash/context7-mcp`)

**Назначение**: Предоставляет актуальную документацию для любых библиотек и фреймворков прямо в контексте Claude.

**Возможности**:
- Поиск библиотек по имени
- Получение актуальной документации с примерами кода
- Поддержка конкретных версий библиотек
- Доступ к приватным репозиториям (с API ключом)

**Использование**:
```javascript
// Claude автоматически использует Context7 когда нужна документация
// Например: "Покажи как использовать FastAPI для создания REST API"
```

**Опциональная настройка** (для приватных репозиториев и повышенных лимитов):
1. Создайте аккаунт на [context7.com/dashboard](https://context7.com/dashboard)
2. Получите API ключ
3. Добавьте переменную окружения в `.mcp.json`:
```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"],
      "env": {
        "CONTEXT7_API_KEY": "ваш_api_ключ"
      }
    }
  }
}
```

### 2. Playwright (`@playwright/mcp`)

**Назначение**: Автоматизация браузера для тестирования веб-приложений, скрапинга и взаимодействия с веб-страницами.

**Возможности**:
- Навигация по веб-страницам
- Клики, заполнение форм, скриншоты
- Снятие accessibility-снэпшотов
- Выполнение JavaScript на странице
- Работа с вкладками браузера
- Перехват сетевых запросов

**Конфигурация**:
- Браузер: Chromium (можно изменить на `firefox`, `webkit`, `msedge`)
- Режим: headless (без GUI)
- Требования: Node.js >= 18

**Использование**:
```javascript
// Примеры команд для Claude:
// "Открой сайт example.com и сделай скриншот"
// "Заполни форму на странице"
// "Проверь работает ли авторизация на моем сайте"
```

## Файл конфигурации `.mcp.json`

Файл [.mcp.json](../.mcp.json) в корне проекта содержит конфигурацию всех MCP серверов:

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"]
    },
    "playwright": {
      "command": "npx",
      "args": [
        "-y",
        "@playwright/mcp@latest",
        "--browser",
        "chromium",
        "--headless"
      ]
    }
  }
}
```

## Активация MCP серверов

После создания `.mcp.json` файла:

1. **Перезапустите VS Code** или перезагрузите окно (`Cmd+Shift+P` → "Developer: Reload Window")
2. **Проверьте подключение**: Откройте Claude Code и попросите что-то, что требует MCP:
   - "Покажи документацию React hooks" (Context7)
   - "Открой google.com" (Playwright)
3. **Подтвердите разрешения**: При первом использовании VS Code может попросить разрешение на запуск MCP серверов

## Настройка Playwright для разработки

Для отладки можно включить headed режим (с GUI):

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "-y",
        "@playwright/mcp@latest",
        "--browser",
        "chromium"
        // убрали --headless
      ]
    }
  }
}
```

Дополнительные опции:
- `--device "iPhone 15"` — эмуляция мобильного устройства
- `--caps vision,pdf` — включение дополнительных возможностей
- `--allowed-hosts example.com,*.google.com` — ограничение доменов

## Устранение неполадок

### MCP серверы не запускаются

1. Проверьте версию Node.js: `node --version` (требуется >= 18)
2. Убедитесь что `.mcp.json` в корне проекта
3. Проверьте синтаксис JSON
4. Перезапустите VS Code

### Context7 не находит библиотеку

- Проверьте правильность написания имени библиотеки
- Для специфичной версии используйте формат: `/org/project/version`

### Playwright не может открыть страницу

- Убедитесь что сайт доступен
- Проверьте firewall и прокси настройки
- Для локальной разработки используйте `--allowed-hosts localhost,127.0.0.1`

## Полезные ссылки

- [Context7 Documentation](https://github.com/upstash/context7)
- [Playwright MCP Documentation](https://github.com/microsoft/playwright-mcp)
- [Claude Code MCP Guide](https://code.claude.com/docs/en/mcp.md)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)

## Следующие шаги

Теперь вы можете:
1. Использовать Context7 для получения актуальной документации любых библиотек
2. Автоматизировать тестирование веб-интерфейса через Playwright
3. Добавить дополнительные MCP серверы из [официального каталога](https://github.com/modelcontextprotocol/servers)

Для добавления новых серверов просто обновите `.mcp.json` и перезагрузите VS Code.
