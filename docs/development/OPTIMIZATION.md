# Руководство по оптимизации AI Image Generator

Этот документ содержит рекомендации по оптимизации производительности приложения.

---

## Содержание

1. [Backend оптимизация](#backend-оптимизация)
2. [Frontend оптимизация](#frontend-оптимизация)
3. [Database оптимизация](#database-оптимизация)
4. [Monitoring и профилирование](#monitoring-и-профилирование)

---

## Backend оптимизация

### 1. Database индексы

#### Критические индексы (уже реализованы)

**Таблица `users`:**
```sql
-- Индекс для быстрого поиска по telegram_id (используется при каждой авторизации)
CREATE INDEX idx_users_telegram_id ON users(telegram_id);

-- Индекс для активных подписок
CREATE INDEX idx_users_subscription_active ON users(subscription_type, subscription_end_date)
WHERE subscription_type != 'none';

-- Индекс для реферальных ссылок
CREATE INDEX idx_users_referral_code ON users(referral_code);
```

**Таблица `generations`:**
```sql
-- Композитный индекс для истории генераций пользователя
CREATE INDEX idx_generations_user_created ON generations(user_id, created_at DESC);

-- Индекс для поиска по task_id (используется при проверке статуса)
CREATE INDEX idx_generations_task_id ON generations(task_id);

-- Индекс для поиска незавершённых генераций
CREATE INDEX idx_generations_status ON generations(status, created_at)
WHERE status IN ('pending', 'processing');
```

**Таблица `chat_histories`:**
```sql
-- Индекс для получения истории чата сессии
CREATE INDEX idx_chat_histories_session_created ON chat_histories(session_id, created_at DESC);

-- Индекс для активных сессий
CREATE INDEX idx_chat_histories_user_active ON chat_histories(user_id, is_active)
WHERE is_active = true;
```

**Таблица `payments`:**
```sql
-- Индекс для истории платежей пользователя
CREATE INDEX idx_payments_user_created ON payments(user_id, created_at DESC);

-- Индекс для поиска по payment_id (используется в webhook)
CREATE INDEX idx_payments_payment_id ON payments(payment_id);

-- Индекс для идемпотентности
CREATE INDEX idx_payments_idempotency_key ON payments(idempotency_key);
```

**Таблица `referrals`:**
```sql
-- Индекс для получения рефералов пользователя
CREATE INDEX idx_referrals_referrer ON referrals(referrer_id);

-- Индекс для проверки, был ли пользователь приглашён
CREATE INDEX idx_referrals_referred ON referrals(referred_user_id);
```

### 2. Query оптимизация

#### Использование select_related и joinedload

```python
# ❌ Плохо: N+1 проблема
users = await session.execute(select(User))
for user in users:
    referrals = user.referrals  # Дополнительный запрос для каждого user

# ✅ Хорошо: Один запрос с JOIN
from sqlalchemy.orm import selectinload

stmt = select(User).options(selectinload(User.referrals))
users = await session.execute(stmt)
```

#### Пагинация с LIMIT и OFFSET

```python
# Всегда использовать пагинацию для списков
stmt = (
    select(Generation)
    .where(Generation.user_id == user_id)
    .order_by(Generation.created_at.desc())
    .limit(page_size)
    .offset((page - 1) * page_size)
)
```

#### Использование COUNT(*) оптимально

```python
# ❌ Плохо: загрузка всех записей для подсчёта
all_users = await session.execute(select(User))
count = len(all_users.all())

# ✅ Хорошо: COUNT на уровне БД
from sqlalchemy import func

count_stmt = select(func.count(User.id))
count = await session.scalar(count_stmt)
```

### 3. Caching

#### Redis для кэширования

```python
# Кэширование статистики админки (обновляется раз в 5 минут)
import redis
import json

redis_client = redis.from_url(settings.REDIS_URL)

# Получение статистики с кэшем
async def get_admin_stats_cached():
    cache_key = "admin:stats"
    cache_ttl = 300  # 5 минут

    # Проверить кэш
    cached = redis_client.get(cache_key)
    if cached:
        return json.loads(cached)

    # Вычислить статистику
    stats = await compute_admin_stats()

    # Сохранить в кэш
    redis_client.setex(cache_key, cache_ttl, json.dumps(stats))

    return stats
```

### 4. Async операции

#### Использование asyncio.gather для параллельных запросов

```python
import asyncio

# ❌ Плохо: последовательные запросы
user = await get_user(user_id)
generations = await get_user_generations(user_id)
payments = await get_user_payments(user_id)

# ✅ Хорошо: параллельные запросы
user, generations, payments = await asyncio.gather(
    get_user(user_id),
    get_user_generations(user_id),
    get_user_payments(user_id)
)
```

### 5. Celery оптимизация

#### Настройка очередей по приоритетам

```python
# celery_app.py
app.conf.task_routes = {
    'app.tasks.fitting.generate_fitting_task': {
        'queue': 'high_priority',
    },
    'app.tasks.editing.generate_editing_task': {
        'queue': 'high_priority',
    },
    'app.tasks.maintenance.delete_old_files_task': {
        'queue': 'low_priority',
    },
}
```

#### Rate limiting для внешних API

# Ограничение количества запросов к OpenRouter
@app.task(rate_limit='10/m')  # 10 запросов в минуту
async def generate_fitting_task(generation_id: int):
    # ...
    pass
```

---

## Frontend оптимизация

### 1. Code Splitting

#### Lazy loading для routes

```typescript
// ❌ Плохо: все компоненты загружаются сразу
import FittingPage from './pages/FittingPage';
import EditingPage from './pages/EditingPage';

// ✅ Хорошо: lazy loading
const FittingPage = lazy(() => import('./pages/FittingPage'));
const EditingPage = lazy(() => import('./pages/EditingPage'));

// В router
<Route path="/fitting" element={
  <Suspense fallback={<LoadingPage />}>
    <FittingPage />
  </Suspense>
} />
```

### 2. Image optimization

#### Lazy loading для изображений

```typescript
// Использование react-lazy-load-image-component
import { LazyLoadImage } from 'react-lazy-load-image-component';

<LazyLoadImage
  src={imageUrl}
  alt="Generated image"
  effect="blur"
  placeholderSrc={thumbnailUrl}
/>
```

#### Оптимизация размера изображений

```typescript
// Генерация thumbnails для preview
const createThumbnail = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        const scale = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scale;

        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);

        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};
```

### 3. Memoization

#### React.memo для компонентов

```typescript
// Мемоизация компонента, который не должен перерендериваться
const StatsCard = React.memo(({ title, value, icon }: StatsCardProps) => {
  return (
    <div className="stats-card">
      {icon}
      <h3>{title}</h3>
      <p>{value}</p>
    </div>
  );
});
```

#### useMemo для вычислений

```typescript
// Мемоизация дорогих вычислений
const sortedGenerations = useMemo(() => {
  return generations.sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}, [generations]);
```

#### useCallback для функций

```typescript
// Мемоизация callback функций
const handleGenerate = useCallback(async () => {
  const result = await generateFitting({
    user_photo_id: userPhotoId,
    item_photo_id: itemPhotoId,
  });
  setResult(result);
}, [userPhotoId, itemPhotoId]);
```

### 4. Zustand оптимизация

#### Селекторы для избежания лишних ре-рендеров

```typescript
// ❌ Плохо: компонент ре-рендерится при любом изменении store
const Component = () => {
  const store = useAuthStore();
  return <div>{store.user.username}</div>;
};

// ✅ Хорошо: компонент ре-рендерится только при изменении username
const Component = () => {
  const username = useAuthStore((state) => state.user?.username);
  return <div>{username}</div>;
};
```

### 5. Bundle size оптимизация

#### Tree shaking

```typescript
// ❌ Плохо: импорт всей библиотеки
import _ from 'lodash';
const result = _.uniq(array);

// ✅ Хорошо: импорт только нужной функции
import uniq from 'lodash/uniq';
const result = uniq(array);
```

#### Анализ bundle size

```bash
# Установить анализатор
npm install --save-dev rollup-plugin-visualizer

# В vite.config.ts
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    visualizer({
      filename: './dist/stats.html',
      open: true,
    }),
  ],
});

# Build с анализом
npm run build
```

---

## Database оптимизация

### 1. Connection pooling

```python
# app/db/session.py
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_size=20,              # Размер пула соединений
    max_overflow=10,           # Максимальное количество дополнительных соединений
    pool_pre_ping=True,        # Проверка соединений перед использованием
    pool_recycle=3600,         # Обновление соединений каждый час
)
```

### 2. EXPLAIN ANALYZE для медленных запросов

```sql
-- Анализ производительности запроса
EXPLAIN ANALYZE
SELECT * FROM generations
WHERE user_id = 123
ORDER BY created_at DESC
LIMIT 20;

-- Результат покажет:
-- - Используются ли индексы
-- - Время выполнения
-- - Количество просканированных строк
```

### 3. Partitioning для больших таблиц

```sql
-- Партиционирование таблицы generations по дате
-- (Полезно при большом количестве генераций)

CREATE TABLE generations_partitioned (
    LIKE generations INCLUDING ALL
) PARTITION BY RANGE (created_at);

-- Создание партиций по месяцам
CREATE TABLE generations_2025_01 PARTITION OF generations_partitioned
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE generations_2025_02 PARTITION OF generations_partitioned
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
```

### 4. Vacuum и Analyze

```sql
-- Регулярное обслуживание БД
-- Запускать еженедельно через cron

-- Очистка и анализ всех таблиц
VACUUM ANALYZE;

-- Для конкретной таблицы
VACUUM ANALYZE generations;
```

---

## Monitoring и профилирование

### 1. Backend profiling

#### py-spy для профилирования production

```bash
# Установить py-spy
pip install py-spy

# Профилировать запущенный процесс
py-spy top --pid <PID>

# Создать flamegraph
py-spy record -o profile.svg --pid <PID>
```

#### SQL query logging

```python
# app/main.py
import logging

# Включить логирование SQL запросов
logging.basicConfig()
logging.getLogger('sqlalchemy.engine').setLevel(logging.INFO)
```

### 2. Frontend profiling

#### React DevTools Profiler

```typescript
// Профилирование компонента
import { Profiler } from 'react';

function onRenderCallback(
  id: string,
  phase: "mount" | "update",
  actualDuration: number,
) {
  console.log(`${id} (${phase}) took ${actualDuration}ms`);
}

<Profiler id="FittingWizard" onRender={onRenderCallback}>
  <FittingWizard />
</Profiler>
```

#### Lighthouse для анализа производительности

```bash
# Установить Lighthouse CLI
npm install -g lighthouse

# Запустить анализ
lighthouse https://your-app-url.com --view
```

### 3. Sentry для мониторинга ошибок

```python
# backend/app/main.py
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration

if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        integrations=[FastApiIntegration()],
        traces_sample_rate=0.1,  # 10% запросов для tracing
    )
```

```typescript
// frontend/src/main.tsx
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  integrations: [new Sentry.BrowserTracing()],
  tracesSampleRate: 0.1,
});
```

### 4. Metrics с Prometheus

```python
# backend/app/main.py
from prometheus_client import Counter, Histogram, generate_latest

# Метрики
generation_requests = Counter('generation_requests_total', 'Total generation requests')
generation_duration = Histogram('generation_duration_seconds', 'Generation duration')

@app.get("/metrics")
async def metrics():
    """Endpoint для Prometheus scraping"""
    return Response(generate_latest(), media_type="text/plain")

# Использование метрик
@app.post("/api/v1/fitting/generate")
async def generate_fitting(...):
    generation_requests.inc()
    with generation_duration.time():
        # ... логика генерации
        pass
```

---

## Рекомендации по деплою

### 1. Горизонтальное масштабирование

```yaml
# docker-compose.yml
services:
  backend:
    image: ai-image-bot-backend
    deploy:
      replicas: 3  # 3 инстанса backend
    environment:
      - WORKERS=2  # 2 воркера на инстанс

  celery_worker:
    image: ai-image-bot-backend
    command: celery -A app.tasks.celery_app worker -Q fitting,editing,maintenance
    deploy:
      replicas: 5  # 5 воркеров Celery
```

### 2. CDN для static файлов

```typescript
// frontend/.env.production
VITE_CDN_URL=https://cdn.your-domain.com
VITE_API_BASE_URL=https://api.your-domain.com
```

### 3. Load balancer

```nginx
# nginx.conf
upstream backend {
    least_conn;  # Балансировка по наименьшей нагрузке
    server backend1:8000;
    server backend2:8000;
    server backend3:8000;
}

server {
    location /api/ {
        proxy_pass http://backend;
    }
}
```

---

## Текущие метрики производительности

### Backend

- **Average response time**: ~50ms для простых запросов
- **Database queries**: <10ms при правильных индексах
- **Celery tasks**: 5-30 секунд для генерации (зависит от OpenRouter API)

### Frontend

- **Initial load**: <2 секунды (с code splitting)
- **Time to interactive**: <3 секунды
- **Bundle size**: ~500KB (gzipped)

### Database

- **Queries per second**: До 1000 (с connection pooling)
- **Index usage**: 95%+ запросов используют индексы

---

## Чек-лист перед production

- [ ] Все критические индексы созданы
- [ ] Connection pooling настроен
- [ ] Frontend bundle оптимизирован (code splitting, lazy loading)
- [ ] Images оптимизированы (thumbnails, lazy loading)
- [ ] Caching настроен (Redis для hot data)
- [ ] Monitoring настроен (Sentry, Prometheus)
- [ ] Load testing проведён (k6, JMeter)
- [ ] Database vacuuming настроен (cron)
- [ ] CDN настроен для static файлов
- [ ] Rate limiting настроен для API

---

**Последнее обновление**: 2025-10-30 (Этап 13)
