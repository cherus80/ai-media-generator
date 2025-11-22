# Backend Tests README

Этот документ содержит информацию о структуре и запуске тестов backend.

---

## Структура тестов

```
tests/
├── __init__.py
├── conftest.py                    # Pytest fixtures (mocks + real DB)
├── create_test_db.sh              # Скрипт создания test database
├── README.md                      # Этот файл
│
├── test_auth.py                   # Unit-тесты авторизации
├── test_credits.py                # Unit-тесты кредитов
├── test_file_validator.py         # Unit-тесты валидации файлов
├── test_tax.py                    # Unit-тесты налогов (24 теста)
├── test_editing_module.py         # Unit-тесты редактирования (14 тестов)
│
├── test_auth_integration.py       # Integration тесты Auth API
└── test_api_integration.py        # Шаблоны integration тестов (TODO)
```

---

## Типы тестов

### Unit-тесты (не требуют database)

Используют mocks и не зависят от внешних сервисов.

```bash
# Запустить все unit-тесты
pytest -m "not integration" -v

# Запустить конкретный файл
pytest tests/test_tax.py -v

# С покрытием кода
pytest tests/test_tax.py --cov=app.utils.tax --cov-report=html
```

### Integration тесты (требуют test database)

Используют реальную test database и проверяют работу с БД.

```bash
# Сначала создайте test database
./tests/create_test_db.sh

# Запустить integration тесты
pytest tests/test_auth_integration.py -v

# Или все integration тесты
pytest -m integration -v
```

---

## Создание test database

### Автоматически (рекомендуется)

```bash
cd backend
./tests/create_test_db.sh
```

Скрипт автоматически:
1. Удалит существующую test database (если есть)
2. Создаст новую test database: `ai_image_bot_test`
3. Настроит правильные права доступа

### Вручную

```bash
# Подключитесь к PostgreSQL
psql -U postgres

# Создайте test database
CREATE DATABASE ai_image_bot_test;

# Выйдите
\q
```

### Переменные окружения

По умолчанию используются:
- `POSTGRES_HOST=localhost`
- `POSTGRES_PORT=5432`
- `POSTGRES_USER=postgres`
- `POSTGRES_PASSWORD=postgres`
- Test DB: `ai_image_bot_test`

Вы можете переопределить их в `.env` файле или через переменные окружения:

```bash
export TEST_DATABASE_URL="postgresql+asyncpg://user:pass@localhost:5432/test_db"
pytest -m integration
```

---

## Запуск тестов

### Все тесты

```bash
cd backend
pytest
```

### Только unit-тесты

```bash
pytest -m "not integration"
```

### Только integration тесты

```bash
pytest -m integration
```

### Конкретный файл

```bash
pytest tests/test_auth_integration.py -v
```

### Конкретный тест

```bash
pytest tests/test_auth_integration.py::TestAuthIntegration::test_get_current_user_with_valid_token -v
```

### С подробным выводом

```bash
pytest -vv  # Очень подробно
pytest -v   # Подробно
pytest -q   # Кратко
```

### С покрытием кода

```bash
# HTML отчёт
pytest --cov=app --cov-report=html
# Откройте htmlcov/index.html в браузере

# Terminal отчёт
pytest --cov=app --cov-report=term-missing
```

### Только неудавшиеся тесты

```bash
pytest --lf  # last-failed
```

### Остановиться на первой ошибке

```bash
pytest -x
```

---

## Маркеры (markers)

Тесты могут быть помечены маркерами для удобной фильтрации:

```python
@pytest.mark.unit
@pytest.mark.integration
@pytest.mark.slow
@pytest.mark.asyncio
@pytest.mark.skip(reason="...")
```

Примеры использования:

```bash
# Только unit-тесты
pytest -m unit

# Только integration тесты
pytest -m integration

# Без медленных тестов
pytest -m "not slow"

# Unit тесты, но не медленные
pytest -m "unit and not slow"
```

---

## Фикстуры (fixtures)

### Mocks (для unit-тестов)

```python
def test_something(mock_db_session, mock_redis_client):
    # Используйте mock объекты
    pass
```

Доступные mock fixtures:
- `mock_db_session` — Mock async database session
- `mock_redis_client` — Mock Redis client
- `mock_openrouter_client` — Mock OpenRouter API
- `mock_openrouter_client` — Mock OpenRouter API
- `mock_yukassa_client` — Mock YuKassa API

### Real DB (для integration тестов)

```python
@pytest.mark.integration
async def test_something(test_db, test_client):
    # test_db — реальная test database session
    # test_client — HTTP client с dependency override
    pass
```

Доступные real DB fixtures:
- `test_db` — Real test database session
- `test_client` — HTTP client с test DB
- `authenticated_test_client` — HTTP client с JWT токеном
- `test_user_with_credits` — Тестовый user с 50 кредитами
- `test_user_premium` — Тестовый user с Premium подпиской
- `test_user_freemium_only` — Freemium тестовый user

---

## Написание новых тестов

### Unit-тест

```python
import pytest

def test_calculate_tax():
    """Описание теста"""
    # Arrange
    amount = 1000

    # Act
    result = calculate_npd_tax(amount)

    # Assert
    assert result == 40.00
```

### Integration тест

```python
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
@pytest.mark.integration
async def test_get_user_profile(authenticated_test_client: AsyncClient):
    """Описание теста"""
    # Arrange
    # (authenticated_test_client уже настроен с JWT токеном)

    # Act
    response = await authenticated_test_client.get("/api/v1/auth/me")

    # Assert
    assert response.status_code == 200
    data = response.json()
    assert "username" in data
```

### AAA Pattern

Все тесты должны следовать AAA паттерну:

1. **Arrange** (Подготовка): Настройка тестовых данных
2. **Act** (Действие): Выполнение тестируемой функции
3. **Assert** (Проверка): Проверка результата

---

## Debugging тестов

### Вывод print statements

```bash
pytest -s  # Показывать print()
```

### Вывод локальных переменных при ошибке

```bash
pytest -l  # Показывать locals
```

### Запуск с debugger

```bash
pytest --pdb  # Войти в pdb при ошибке
```

### Verbose traceback

```bash
pytest --tb=long   # Длинный traceback
pytest --tb=short  # Короткий traceback (по умолчанию)
pytest --tb=no     # Без traceback
```

---

## CI/CD

### GitHub Actions

TODO: Настроить `.github/workflows/test.yml`

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - run: pip install -r requirements.txt

      - name: Run tests
        run: pytest --cov=app --cov-report=xml

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

---

## Текущее состояние

### ✅ Реализовано

- **60 unit-тестов** (37 пройдено, 1 skipped, 22 mock-based)
- **test_auth.py** — 8 тестов авторизации
- **test_credits.py** — 10+ тестов кредитов
- **test_file_validator.py** — 10+ тестов валидации
- **test_tax.py** — 24 теста налогов (23 пройдено)
- **test_editing_module.py** — 14 тестов (все пройдены)
- **test_auth_integration.py** — 10+ integration тестов Auth API

### ⏳ TODO

- Integration тесты для Fitting API
- Integration тесты для Editing API
- Integration тесты для Payments API
- Integration тесты для Referrals API
- Integration тесты для Admin API
- E2E тесты с Playwright
- CI/CD настройка

---

## Troubleshooting

### Ошибка: "connection refused" при integration тестах

PostgreSQL не запущен или недоступен:

```bash
# macOS
brew services start postgresql@15

# Linux
sudo systemctl start postgresql

# Docker
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:15
```

### Ошибка: "database does not exist"

Test database не создана:

```bash
./tests/create_test_db.sh
```

### Ошибка: "ModuleNotFoundError"

Не установлены зависимости:

```bash
pip install -r requirements.txt
```

### Тесты медленные

Используйте `-n auto` для параллельного запуска (требует pytest-xdist):

```bash
pip install pytest-xdist
pytest -n auto
```

---

## Дополнительная информация

- [TESTING.md](../../TESTING.md) — Полное руководство по тестированию
- [pytest documentation](https://docs.pytest.org/)
- [httpx documentation](https://www.python-httpx.org/)
- [FastAPI testing](https://fastapi.tiangolo.com/tutorial/testing/)

---

**Последнее обновление**: 2025-10-30
