# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Добавлен скрипт `scripts/backup-from-vps.sh` для бэкапа БД с VPS на компьютер.
- Добавлен скрипт `scripts/restore-vps-db.sh` для восстановления БД на VPS из локального дампа с проверкой.
- Добавлены уведомления: админ-рассылка пользователям (заголовок обязателен), страница "Оповещения" с автопометкой прочтения при открытии списка, колокольчик с числом непрочитанных и одноразовая подсказка в шапке.
- В админке примеров добавлен поиск по существующим меткам (typeahead) и мультиселект с чекбоксами, плюс отдельное поле для новых меток.
- Добавлена страница "О приложении" с актуальными данными о версии, функционале, дате обновления и ссылкой на поддержку.
- На главной добавлен блок быстрого старта с кнопками функций и усилена кнопка "Смотреть больше примеров".
- Авто-сжатие загружаемых референсов до 5MB, чтобы проходить серверные лимиты.
- Выбор соотношения сторон (Авто/1:1/16:9/9:16) перед генерацией в редакторе, генерации по образцу и примерке.

### Changed
- Таймаут ожидания генерации для GrsAI/kie.ai увеличен до 5 минут.
- Удалены устаревшие backup-скрипты из `scripts`, оставлен только `scripts/backup-from-vps.sh`.
- Sitemap теперь содержит только главную страницу.
- Подтверждение email теперь логинит пользователя и переводит в приложение.
- Пересчитаны тарифы и пакеты ⭐️ под Nano Banana Pro, free trial снижен до 6 ⭐️.
- Модели генерации обновлены на Nano Banana Pro (Kie.ai и OpenRouter).
- В интерфейсе и маркетинговых текстах обновлено название модели на Nano Banana Pro.
- kie.ai: для редактирования/примерки используем параметр `image_input` и `aspect_ratio`, чтобы базовое фото не игнорировалось.
- GrsAI подключён как основной провайдер Nano Banana Pro, kie.ai используется как fallback вместо OpenRouter.

### Fixed
- Сообщения статуса генерации переведены на русский язык.
- Исправлена ошибка `UnboundLocalError` при генерации с выбором соотношения сторон.
- `scripts/backup-from-vps.sh` безопасно читает `.env` на VPS без ошибок из-за строк без `KEY=VALUE`.
- Тестовое восстановление в `scripts/backup-from-vps.sh` использует quiet-режим psql и временную загрузку файла на VPS.
- `scripts/restore-vps-db.sh` дополнительно проверяет обязательные таблицы и alembic revision после восстановления.

### Fixed
- В редакторе фото результат больше не повторяет весь промпт — чат не загромождается.
- Повторное открытие ссылки подтверждения email теперь возвращает успех, если адрес уже подтверждён.
- Добавлено логирование причин отказа в email-верификации (не найден/истёк/использован токен).
- Celery worker/beat переведены на запуск от non-root пользователя.
- Celery beat пишет файл расписания в /app/logs, чтобы non-root имел права на запись.
- Celery worker/beat используют HOME=/home/appuser, чтобы libpq не пытался читать ключи из /root/.postgresql.
- Загружаемые файлы приводятся к UID/GID celery worker, чтобы auto-orient мог перезаписывать uploads без PermissionError.
- Maintenance задачи Celery используют единый event loop, чтобы избежать asyncpg ошибок "Future attached to a different loop".
- Усилен webhook ЮKassa: подпись обязательна в продакшене, добавлена защита от подмены.
- URL вложений в редакторе проверяются как локальные /uploads, снижая риск SSRF.
- Валидация изображений ограничивает максимальное разрешение по пикселям.
- Rate limit использует X-Real-IP от прокси вместо пользовательского X-Forwarded-For.
- В редакторе фото и генерации по образцу показывается предупреждение о превышении лимита 2000 символов, запуск блокируется до сокращения промпта.
- Для всех пользовательских загрузок фото/видео добавлены понятные сообщения об ошибках с причиной и подсказкой, что сделать для успешной загрузки.
- В редакторе изображений теперь отображаются предупреждения загрузки через toasts, а ошибки не очищаются до новой попытки.
- В мобильной шапке лендинга и публичных страниц кнопка Telegram размещается слева от "Войти/Регистрация" при ширине <600px.
- На лендинге надпись "ТОП 6" стилизована как в приложении; промпты скрыты в карточках примеров на лендинге и в приложении.
- Превью загруженных фото для примерки корректно отображается для HEIC/HEIF/MPO; /fitting/generate больше не возвращает 404 из-за неподдерживаемого расширения.
- В редакторе изображений разрешена загрузка HEIC/HEIF/MPO и показ превью через серверный URL для этих форматов.
- Убрана дублирующая подсказка справа над полем ввода в генерации по образцу.
- Мобильная верстка в модалке выбора промпта и в поле ввода редактора: элементы не выезжают за экран, подсказки аккуратно переносятся.
- Поле ввода промпта в редакторе на мобильных стало компактнее: упрощён текст подсказок и сокращён placeholder.
- История редактирования подгружается при возвращении в активную сессию после авторизации.
- Шаринг результата редактирования использует текст сервиса вместо прямой ссылки на файл в /uploads.
- В истории редактирования сохраняются сообщения с изображениями (исправлена запись JSONB при добавлении результата).
- Шаринг результата редактирования пытается отправлять файл изображения вместе с текстом, а не только текст.
- История чата в редакторе восстанавливается после перезагрузки страницы по сохранённой сессии.
- При истёкшей авторизации защищённые запросы корректно переводят пользователя на повторный вход вместо пустой админ-панели.
- Перед генерацией добавлено предупреждение при нехватке кредитов с кнопками для покупки кредитов или оформления подписки.
- Авторизационный токен кешируется в памяти и sessionStorage, чтобы функции не ломались после долгого простоя без явного разлогинивания.
- Исправлен запуск WAF-контейнера: конфигурация ModSecurity идёт через шаблоны/ENV без дублирующихся правил.
- Согласие на обработку ПДн сохраняется отдельно и не сбрасывается при очистке auth-сессии.
- Кнопка Google авторизации инициализируется стабильнее и не пропадает при первом заходе.
- Карточки на экране загрузки редактора корректно адаптируются на десктопе.
- Текст при шаринге результатов редактирования обновлён на нейтральное описание сервиса.
- Интеграционные тесты пропускаются, если тестовая PostgreSQL недоступна; тесты приведены к актуальным полям billing v5 и async-валидатору файлов.
- Парсинг промптов OpenRouter корректно обрабатывает пустые массивы.
- MODSEC_RESP_BODY_ACCESS в docker-compose.prod.yml зафиксирован как строка, чтобы docker-compose не падал на YAML boolean.
- Добавлен /healthz для WAF и переопределён healthcheck, чтобы контейнер не зависал в состоянии unhealthy.
- Миграция инструкций использует PostgreSQL ENUM без автоматического CREATE TYPE, чтобы избежать ошибки DuplicateObjectError при повторном запуске.
- Фильтрация инструкций по типу больше не падает с 500: SQLAlchemy Enum использует значения enum, а не имена.
- Миниатюры примеров генераций показывают полное изображение без обрезки.
- В админке доступна загрузка видеофайлов инструкций, а на публичной странице корректно отображаются прямые видеофайлы.
- Карточки примеров генераций сделаны компактнее, превью увеличены для лучшей читаемости.
- Для текстовых инструкций можно добавлять изображения через Markdown и загрузку в админке.
- Увеличен лимит размера загрузок видео на прокси и в backend, чтобы избежать 413.
- Реферальная статистика не падает, если у приглашённого пользователя отсутствует Telegram ID.
- В админке проверяется размер видео перед загрузкой, чтобы не упираться в лимит WAF.
- Nginx фронтенда отдаёт favicon через fallback на SVG, убирая 404 в логах.
- Деплойный скрипт запускает миграции после поднятия контейнеров, чтобы не возникали ошибки отсутствующих таблиц.
- Инструкции и примеры конвертируют загружаемые изображения в WebP для более быстрой загрузки.
- Тексты про кредиты заменены на ⭐️звезды по всему интерфейсу.
- Исправлена ошибка 500 при сохранении примеров генераций с повторяющимися метками.
- Очистка uploads больше не удаляет файлы, используемые в примерах генераций и инструкциях.
- Реферальный код сохраняется локально и обрабатывается после успешного входа, чтобы не теряться в OAuth-флоу.

### Changed
- В примерах окружения лимит `MAX_FILE_SIZE_MB` установлен на 10MB, чтобы соответствовать интерфейсу.
- Тексты про оплату и лимиты теперь используют термин "генерации" вместо "действий".
- На лендинге добавлен блок ТОП-6 популярных образцов с переходом на регистрацию.
- Обновлены тексты про редактирование фото на лендинге и в приложении: референсы, сценарии работы и стоимость.
- Кнопка "Смотреть как работает" на лендинге ведёт на страницу видео-инструкций.
- В шаге загрузки одежды добавлены рекомендации к фото (без лица/рук/ног).
- В шапках всех страниц добавлена ссылка на Telegram-канал.
- Страница примеров показывает топ-6 востребованных, добавлены фильтры по меткам и сортировка по популярности.
- Скрипт `deploy-frontend-to-vps.sh` теперь обновляет код с ветки `feature/instructions-examples`.
- Деплой фронтенда запускается с `--no-deps`, чтобы не пересоздавать Redis/PostgreSQL при выкладке UI.
- Скрипты деплоя используют `docker compose` (v2) вместо `docker-compose`.
- Порог покрытия тестов временно снижен до 20%.
- Заголовок блока топовых примеров переименован в "ТОП 6".
- `deploy-to-vps.sh` переключён на деплой ветки `feature/instructions-examples`.
- Страницы "Инструкции" и "Примеры генераций" перенесены внутрь приложения (роуты `/app/instructions` и `/app/examples`).
- Миграция инструкций/примеров теперь идемпотентна при повторном запуске (enum instruction_type создаётся только при отсутствии).
- Лимит загрузки видео увеличен до 200MB на прокси и в backend.
- Лимит длины промпта увеличен до 4000 символов в редакторе и генерации по образцу.

### Added
- Redis-based rate limiting для API с отдельными лимитами для auth, генерации и ассистента.
- Явные лимиты пула подключений к PostgreSQL для защиты от перегрузки.
- Периметр: rate limiting и лимиты соединений в Nginx, усиленные security headers в Caddy.
- Добавлен WAF: Nginx + ModSecurity (OWASP CRS) между Caddy и сервисами.
- Публичные страницы "Инструкции" (видео/текст) и "Примеры генераций" с выводом контента из админки.
- Админ-управление инструкциями и библиотекой примеров, включая статистику запусков.
- API и модели для инструкций и примеров генераций, счётчик использований.
- Автоподстановка промпта из примера при переходе в редактирование.
- Пункт меню "Написать в MAX" с внешней ссылкой.
- Метки для примеров генераций с фильтрацией, топ-6 блоком на главной и поисковой выдачей по популярности.
- Краткое описание для видео-инструкций в админке и на странице инструкций.
- SEO-база: robots.txt, sitemap.xml и обновлённые мета-теги.
- Конфиг Bandit для исключения тестов и подавления ложного B106.
- Сброс пароля по email (токены с TTL и новые страницы в интерфейсе).
- Отдельная генерация по образцу без сохранения истории: новый экран с автоподстановкой промпта, обязательными фото (все фото применяются в одной генерации) и прямым запуском генерации.
- Поиск по названию примеров генераций в блоке фильтров.
- Подсказка о необходимости прикрепить фото на экране генерации по образцу.

## [0.15.21] - 2025-12-16

### Changed
- Тарифная сетка подписок обновлена до 369₽/599₽/1099₽ с актуальными лимитами действий во всех биллинг-слоях и отображениях.
- Бренд в интерфейсах, документации и сервисных скриптах приведён к новому названию «AI Generator».
- Тексты про виртуальную примерку (лендинг, FAQ, онбординг) переписаны: подчёркнуто, что это ориентировочная AI-визуализация посадки без гарантии 100% совпадения с оригиналом.

## [0.15.20] - 2025-12-15

### Fixed
- Реферальные карточки на странице профиля стали адаптивными: на мобильных блоки не схлопываются и держат единый размер.
- Кнопка входа через Google загружается с первой попытки: добавлен единый загрузчик SDK с повтором при сетевых сбоях.
- Генерация реферального кода унифицирована между auth и referral эндпоинтами (стабильный код на базе user_id + SECRET_KEY), чтобы приглашённые и зарегистрированные рефералы учитывались в «Всего приглашённых».

## [0.15.19] - 2025-12-14

### Changed
- Admin panel: начисление заменено на прямое редактирование баланса — новая кнопка ✏️ в таблице/деталях пользователя, модал устанавливает итоговый баланс и опциональный комментарий.
- API: добавлен PUT `/api/v1/admin/users/{user_id}/credits` с возвратом предыдущего баланса; старый `add-credits` маршрут удалён из UI.

## [0.15.18] - 2025-12-14

### Added
- Страница возврата `/payment/return` (редиректит в профиль с `payment_id`), корректный `return_url` в ЮKassa, подсказка по удалению платежей и кнопка удаления прямо в карточке истории.
- Обработка возвратов ЮKassa: при `payment.canceled`/`refund.succeeded` списываются выданные кредиты или отключается подписка, в журнале создаются записи `credit_pack_refund`/`subscription_refund`.
- Пакетное удаление согласий ПДн в админке завершено: id в API/CSV/JSON, типы и UI обновлены.

### Changed
- Убрали тестовый пакет 5 кредитов: в конфиге и тарифах остались только боевые пакеты (20/50/100/250), валидация платежей снова требует минимум 20 кредитов.
- CSP разрешает wss для Яндекс.Метрики, чтобы убрать предупреждения в консоли.

### Fixed
- При возврате с ЮKassa больше нет 404 — возвращает на профиль с дальнейшей проверкой платежа.
- Скрытие/удаление платежей теперь доступно выборочно (чекбоксы + кнопка на карточке).

## [0.15.17] - 2025-12-14

### Added
- Возможность скрывать выбранные записи в истории платежей (новый API `/api/v1/payments/history/hide`, чекбоксы в профиле), чтобы убирать ненужные оповещения об оплате без удаления данных.
- Массовое удаление согласий ПДн из админ-панели: чекбоксы в таблице, кнопка удаления и выдача `id` в CSV/JSON.

### Fixed
- Разрешено создавать платежи для тестового пакета 5 кредитов (валидация теперь принимает фактический объём тарифа, без 422).
- Сообщения об ошибках платежей теперь корректно превращаются в текст и не ломают React при ответах FastAPI с подробным `detail`.
- Исключено повторное сохранение согласия на ПДн для одного email и версии (дедупликация по email).

## [0.15.16] - 2025-12-14

### Added
- Тестовый пакет оплаты в ЮKassa: 5 кредитов за 10₽ (для проверки полного цикла платежа), доступен в API `/api/v1/payments/tariffs` и на страницах оплаты.

### Changed
- Сообщение о необходимости спецсимвола в пароле переведено на русский в API и фронтенде формы регистрации.
- Реферальная статистика теперь считает заработанное только по оплатившим приглашённым, карточки отображают «Всего приглашённых», «Активных (оплатили)», «Заработано, кредитов», подсказка подчёркивает бонус +10 кредитов за оплаченный реферал.

## [0.15.13] - 2025-12-13

### Added - Обязательное согласие при OAuth и аудит в админке
- Google/VK вход теперь требует отметку согласия на ПДн: кнопки блокируются без чекбокса, а версия согласия (`PD_CONSENT_VERSION`) уходит в OAuth запросы и фиксируется на backend с IP/User-Agent.
- Добавлен фронтовый тип/клиент для `consent_version` в Google/VK запросах и сохранение в store для токенов OAuth.
- В админ-панели появился таб «Согласия ПДн»: фильтр по датам/версии, просмотр данных и выгрузка CSV через `/api/v1/admin/export/consents`.

## [0.15.14] - 2025-12-14

### Changed
- UI авторизации: показано пояснение, что кнопки OAuth активируются после отметки согласия; отметка сохраняется в `auth-storage` и автоматически проставляется при повторном входе на ту же версию `PD_CONSENT_VERSION`.
- Убраны дисклеймеры о внешнем AI-сервисе из результатов примерки и редактора.

## [0.15.15] - 2025-12-14

### Fixed
- Исключено повторное сохранение одинаковых записей согласия ПДн (user + версия + источник) при повторных OAuth входах.

## [0.15.12] - 2025-12-12

### Added - PD consents audit
- Введена таблица `user_consents`: фиксируется версия формы, IP, User-Agent и источник (регистрация/логин) с таймштампом.
- Логирование согласия при email-регистрации и логине, версия передаётся с фронта и имеет дефолт `PD_CONSENT_VERSION`.
- Админ-выгрузка `/api/v1/admin/export/consents` (CSV/JSON) для аудита согласий.
- Фронт отправляет `consent_version` в запросах регистрации/логина, добавлена константа версии.

## [0.15.10] - 2025-12-10

### Fixed - Editing resilience
- Editing Celery-задача перекачивает и нормализует базовое изображение, если локальный файл пропал, и синхронизирует `base_image_url` в чат-сессии, чтобы продолжение генерации не падало.
- `/fitting/result/{task_id}` возвращает сохранённое `error_message`, чтобы фронт показывал реальную причину сбоя.
- Дисклеймеры в интерфейсах примерки и редактирования обновлены: «Результат генерируется внешним AI-сервисом и может отличаться от ваших ожиданий!».

## [0.15.11] - 2025-12-10

### Fixed - Editing first-call regression
- Исправлена ошибка `cannot access local variable 'base_image_url'`, возникшая после восстановления базового изображения в Celery-задаче редактирования (переменная теперь локализована корректно).
- Исправлен `NameError: urlparse is not defined` при конструировании публичных ссылок на изображения (импорт добавлен в utils).

## [0.15.8] - 2025-12-05

### Changed - Брендинг и публичные страницы
- Заменён логотип на новый `/logo.png` во всех публичных и внутренних layout-компонентах.
- Страница “Контакты” приведена к стилю целевого лендинга: общий хедер/футер, акцентные карточки реквизитов и контактов.

## [0.15.9] - 2025-12-09

### Fixed - Virtual Try-On orientation
- User-photo orientation теперь фиксируется при загрузке: EXIF обнуляется после `exif_transpose`, чтобы исключить поворот на клиенте/провайдерах.
- Item-фото перед отправкой на генерацию масштабируется без искажений под соотношение сторон первого фото и дополняется паддингом (прозрачный фон) для обоих провайдеров (kie.ai/OpenRouter).
- Кнопки скачивания результата (примерка и редактирование) теперь корректно работают и для относительных URL (учитываем публичный backend URL и добавлен CORS-фолбэк).
- Редактирование можно продолжать на последнем сгенерированном изображении: результат становится новым базовым для следующих промптов, обновляется и в UI.
- Добавлен дисклеймер в UI примерки/редактирования о возможных расхождениях результатов внешних AI-сервисов с ожиданиями пользователя.

## [0.15.7] - 2025-12-05

### Added
- Админка: выбор основного и запасного провайдера генерации (kie.ai / OpenRouter) без рестарта, со списком доступных провайдеров.
- Referral: бонус рефереру теперь начисляется после первой успешной оплаты приглашённого пользователя (кредиты или подписка).

### Changed
- Профиль: UI упрощён под биллинг v5 (только кредиты + активная подписка с остатком действий), убраны freemium-артефакты.
- kie.ai: таймаут поднят до 180с, polling расширен; при ожидании >60с фронт показывает предупреждение, что генерация идёт дольше обычного.

## [0.15.6] - 2025-12-05

### Changed - UI/UX
- Обновлён публичный лендинг `/` под новый макет (две карточки “Примерка одежды” и “Редактирование фото”, обновлён блок AI-ассистента, CTA по тарифам и безопасности).
- Приложение перешло на новый брендовый логотип (header/footer публичных страниц, внутренние layout’ы).
- Экран входа приведён к единому стилю: карточный фон, кнопки Google/VK одинаковой высоты/ширины на десктопе и мобильных, обновлён стиль полей и CTA.

## [0.15.5] - 2025-12-04

### Added - Billing v5 (действия + кредиты)
- Новая модель биллинга: действия по подписке + кредиты, без freemium; welcome-бонус +10 кредитов при регистрации (однократно).
- Миграция `20251201_1500_billing_v5_actions_and_credits` (free_trial_granted, subscription_started_at, unit в ledger).

### Changed
- Подписки: basic 369₽/80 действий, standard 599₽/130 действий (pro = legacy alias), premium 1099₽/250 действий; покупка подписки больше не начисляет кредиты, а задаёт лимит действий.
- Пакеты кредитов: 20/50/100/250 кредитов; стоимость операций — генерация 1 действие или 2 кредита, ассистент 1 кредит.
- API/схемы: обновлённые billing state, payment tariffs, user profile поля (actions_remaining, free_trial_granted), тексты ошибок NOT_ENOUGH_BALANCE.
- Логика списаний/ledger: новые типы операций (generation/assistant/subscription_purchase/credit_pack_purchase/free_trial_grant) и unit (credits/actions).
- Фронт: отображение балансов действий/кредитов, тексты стоимости, профиль и сторы приведены к новой схеме.

### Removed
- Freemium-лимиты и тексты скрыты/обнулены для v5.

## [0.15.4] - 2025-12-03

### Added - Публичные страницы и соответствие требованиям ЮKassa
- Новый публичный лендинг `/` (без AuthGuard) + общий публичный лейаут с навигацией.
- Публичные страницы: `/pricing` (тарифы из API `/api/v1/payments/tariffs`), `/contacts` (ИНН 222312090918, адрес Энтузиастов 55-203, 656065, телефон, e-mail), `/oferta`, `/privacy`.
- Линки согласия в формах регистрации/входа → оферта + политика; после логина/регистрации редирект на `/app`.
- Политика: добавлены разделы про ПДн, хранение на VPS РФ, автоудаление (24ч фото, 30д чаты), меры защиты (HTTPS, bcrypt, ограниченный доступ).

### Changed - Навигация/роутинг
- Главная приложения для авторизованных перемещена на `/app`; мобильное меню “Главная” теперь ведёт на `/app`.
- Публичная навигация в футере/хедере PublicLayout: тарифы, контакты, оферта, политика.

### Security hardening / Ops
- Firewall (ufw) на VPS: закрыты порты 9000/9443 (Portainer), оставлены только 22/80/443; БД/Redis уже слушают только 127.0.0.1.
- Caddy: HTTP→HTTPS редирект включён (HSTS ранее добавлен).
- Админ-логирование: в `admin.py` логируются выдача админ-прав, удаление пользователей, начисление кредитов.

### Deployment
- Образы backend/celery/beat/frontend пересобраны на VPS без кэша; контейнеры пересозданы `docker-compose -f docker-compose.prod.yml up -d`.
- Установлен `VITE_VK_REDIRECT_URI=https://ai-generator.mix4.ru/vk/callback` в .env на VPS.
- На проде ещё включён PAYMENT_MOCK_MODE=true (в логах “Mock Payment Emulator enabled”) — для боевых платежей переключить на false и задать YUKASSA_*.

## [0.15.3] - 2025-12-01

### Fixed - VK аккаунты без email
- **VK = верифицирован**: теперь пользователи, вошедшие через VK ID, автоматически помечаются `email_verified=True` и получают `email_verified_at`, даже если VK не выдал email (аккаунты, созданные по телефону). Файлы:  
  - [backend/app/api/v1/endpoints/auth_web.py](backend/app/api/v1/endpoints/auth_web.py)  
  - [backend/app/api/dependencies.py](backend/app/api/dependencies.py)
- **Доступ без письма-подтверждения**: `require_verified_email` пропускает VK/Google аккаунты, чтобы генерация/примерка не блокировалась сообщением "Email verification required".
- **Миграция существующих VK-пользователей**: достаточно перелогиниться через VK — флаг `email_verified` и `email_verified_at` проставятся автоматически.
- **Если видите VK ошибку "client_secret is incorrect [5]"**: это приходит от VK при обмене кода на токен. Проверьте на VPS `.env` значения `VK_APP_ID` и `VK_CLIENT_SECRET` (совпадают ли с консолей VK ID), затем перезапустите backend/celery (можно `docker compose -f docker-compose.prod.yml up -d --force-recreate backend celery_worker`). При PKCE секрет обязателен только на сервере; фронт его не отправляет.

## [0.15.2] - 2025-12-01

### Fixed - VK/Google OAuth стабильность

#### Что изменили
- **VK PKCE state/nonce**: теперь генерируются только из букв/цифр (без `.`/`~`), чтобы VK не урезал `state` в callback.  
  - Файл: [frontend/src/utils/pkce.ts](frontend/src/utils/pkce.ts)
- **VK JWKS 404**: если `https://id.vk.com/.well-known/jwks` отвечает 404, вход не падает — продолжаем по `access_token`/`user_info` и логируем предупреждение.  
  - Файл: [backend/app/api/v1/endpoints/auth_web.py](backend/app/api/v1/endpoints/auth_web.py)
- **Google 500 из-за БД**: при ошибке `InvalidPasswordError: password authentication failed for user "postgres"` (видно в логах при POST /auth-web/google) — пароль пользователя `postgres` в БД не совпадает с `.env`. Нужно синхронизировать пароль и перезапустить backend/celery.

#### Быстрые шаги восстановления VK
1) Проверить .env (VPS и build args фронта):  
   - `VITE_VK_REDIRECT_URI=https://<домен>/vk/callback`  
   - `VITE_VK_APP_ID=<app_id>`  
   - `VK_APP_ID=<app_id>`, `VK_CLIENT_SECRET=<secret>`  
   - JWKS: по умолчанию `https://id.vk.com/.well-known/jwks`; 404 допустим — есть fallback.
2) Очистить локальные ключи на фронте и заново зайти одной вкладкой:  
   ```js
   Object.keys(localStorage)
     .filter(k => k.startsWith('vk_pkce') || k === 'vk_device_id')
     .forEach(k => localStorage.removeItem(k));
   ```
3) Пересобрать фронтенд без кэша (чтобы точно применить фикс state):  
   ```bash
   DOCKER_BUILDKIT=1 docker compose -f docker-compose.prod.yml build --no-cache frontend
   docker compose -f docker-compose.prod.yml up -d frontend
   ```
4) Если в логах backend только `[VK_PKCE] id_token verification failed: Failed to fetch VK JWKS: HTTP 404` — это ожидаемо, т.к. включён fallback. Другие 401 → перепроверьте `VK_APP_ID/VK_CLIENT_SECRET` и `redirect_uri`.

#### Быстрые шаги восстановления Google
1) Убедиться, что пароль пользователя `postgres` в БД совпадает с `.env`.  
2) При несовпадении выполнить:  
   ```bash
   docker compose -f docker-compose.prod.yml exec -T postgres psql -U postgres -c "ALTER USER postgres WITH PASSWORD '<пароль из .env>';";
   docker compose -f docker-compose.prod.yml restart backend celery_worker celery_beat
   ```
3) Проверить health: `curl -f http://localhost:8000/health`.

---

## [0.15.1] - 2025-11-27

### Fixed - Virtual Try-On Generation

#### Backend
- **kie.ai API Integration Fix**: Fixed "image_urls file type not supported" error
  - **Problem**: After iPhone format (MPO/HEIC/HEIF) conversion to PNG, files were renamed with `_converted.png` suffix, but URLs sent to kie.ai API didn't include file extensions
  - **Root Cause**: Original file URLs (without extensions) were used instead of converted file paths with extensions
  - **Solution**: Now using actual converted file names (`user_photo_path.name` and `item_photo_path.name`) which include proper extensions
  - **Example**:
    - Before: `https://ai-generator.mix4.ru/uploads/d9d7de38-532a-4b5a-9b0c-474ecea0bdeb` ❌ (no extension)
    - After: `https://ai-generator.mix4.ru/uploads/d9d7de38-532a-4b5a-9b0c-474ecea0bdeb_converted.png` ✅ (with extension)
  - **Impact**: Virtual try-on now works correctly with kie.ai API for all image formats
  - **File**: [backend/app/tasks/fitting.py:197-209](backend/app/tasks/fitting.py#L197-L209)
  - **Added**: Comprehensive inline documentation explaining the fix

- **Documentation**: Added detailed comments explaining the iPhone format conversion workflow and kie.ai API requirements
  - Documented the conversion process from MPO/HEIC to PNG
  - Explained why file extensions are required by kie.ai API
  - Added before/after examples for clarity

### Technical Notes
- **kie.ai API Requirement**: The API validates file types based on URL extensions (.jpg, .png, etc.)
- **Image Editing**: Continues to work correctly as it already used proper file extensions
- **Affected Feature**: Virtual try-on (clothing and accessories fitting)

---

## [0.15.0] - 2025-11-26

### Added - VK ID OAuth Authentication

#### Backend
- **VK OAuth Utility**: Complete VK ID silent token verification module
  - Created `verify_vk_silent_token()` function for VK ID SDK token validation
  - Created `get_vk_user_by_access_token()` for alternative VK API access
  - Created `exchange_vk_code_for_token()` for traditional OAuth 2.0 flow
  - Added `VKOAuthError` exception class for error handling
  - File: [backend/app/utils/vk_oauth.py](backend/app/utils/vk_oauth.py)

- **Database Migration**: Added 'vk' auth provider to enum
  - Added `'vk'` value to `auth_provider_enum` in PostgreSQL
  - Updated `AuthProvider` enum in User model
  - File: [backend/alembic/versions/20251126_1500_add_vk_auth_provider.py](backend/alembic/versions/20251126_1500_add_vk_auth_provider.py)
  - File: [backend/app/models/user.py:37](backend/app/models/user.py#L37)

- **Pydantic Schemas**: VK OAuth request/response validation
  - Created `VKOAuthRequest` schema with `token` and `uuid` fields
  - Reused `GoogleOAuthResponse` for VK OAuth responses (universal schema)
  - File: [backend/app/schemas/auth_web.py:216](backend/app/schemas/auth_web.py#L216)

- **API Endpoint**: `POST /api/v1/auth-web/vk`
  - Validates VK ID silent token via VK API
  - Creates new user or updates existing (with email migration support)
  - Supports users without email (optional email field)
  - Auto-assigns ADMIN role via email whitelist
  - Returns JWT token + user profile + is_new_user flag
  - File: [backend/app/api/v1/endpoints/auth_web.py:498](backend/app/api/v1/endpoints/auth_web.py#L498)

- **Configuration**: VK OAuth environment variables
  - Added `VK_APP_ID` and `VK_CLIENT_SECRET` to Settings
  - Updated `.env.example` with VK OAuth variables
  - File: [backend/app/core/config.py:61](backend/app/core/config.py#L61)
  - File: [backend/.env.example:31](backend/.env.example#L31)

#### Frontend
- **VK ID SDK Integration**: Added VK ID JavaScript SDK
  - Integrated `@vkid/sdk` via CDN in index.html
  - File: [frontend/index.html](frontend/index.html)

- **VKSignInButton Component**: Full-featured VK auth button
  - Initializes VK ID SDK with app configuration
  - Creates Floating One Tap Button for seamless auth
  - Handles silent token callback from VK ID
  - Implements retry mechanism (10 attempts) for SDK loading
  - Shows loading state with spinner overlay
  - Displays fallback UI if VK_APP_ID not configured
  - File: [frontend/src/components/auth/VKSignInButton.tsx](frontend/src/components/auth/VKSignInButton.tsx)

- **TypeScript Types**: Complete VK OAuth type definitions
  - Added `VKOAuthRequest`, `VKOAuthResponse` interfaces
  - Added `VKIDUser`, `VKIDAuthResponse`, `VKIDConfig` types
  - Extended `Window` interface for `window.VKID` support
  - Updated `AuthProvider` type with `'vk'` value
  - File: [frontend/src/types/auth.ts](frontend/src/types/auth.ts)

- **API Client**: VK auth API method
  - Created `loginWithVK(token, uuid)` function
  - Sends POST request to `/api/v1/auth-web/vk`
  - File: [frontend/src/api/authWeb.ts](frontend/src/api/authWeb.ts)

- **Auth Store**: VK authentication logic
  - Added `loginWithVK` method to Zustand store
  - Handles token storage, user profile, auth state
  - Implements error handling with Russian error messages
  - File: [frontend/src/store/authStore.ts](frontend/src/store/authStore.ts)

- **Login Page**: VK sign-in button integration
  - Added `<VKSignInButton />` vertically under Google button
  - Implements `handleVKSuccess` callback with navigation
  - File: [frontend/src/pages/LoginPage.tsx](frontend/src/pages/LoginPage.tsx)

- **Register Page**: VK registration integration
  - Added `<VKSignInButton />` under Google button
  - Supports referral code parameter during VK registration
  - File: [frontend/src/pages/RegisterPage.tsx](frontend/src/pages/RegisterPage.tsx)

- **Environment Variables**: VK app configuration
  - Added `VITE_VK_APP_ID` to `.env.example`
  - File: [frontend/.env.example](frontend/.env.example)

#### Documentation
- **VK OAuth Setup Guide**: Complete setup instructions
  - Step-by-step VK Mini App creation guide
  - Backend and frontend configuration instructions
  - 4 testing scenarios for VK auth flow
  - Production deployment checklist
  - Troubleshooting section with 5 common issues
  - File: [docs/VK_OAUTH_SETUP.md](docs/VK_OAUTH_SETUP.md)

- **Project Index**: Updated with VK OAuth files
  - Added VK auth files to key files list
  - Updated project version to 0.15.0
  - Updated project description with VK OAuth mention
  - File: [.claude/project-index.json](.claude/project-index.json)

### Features
- **No mandatory email**: Users can authenticate via VK without providing email
- **Email migration**: Existing email/password users can switch to VK OAuth
- **Vertical button layout**: VK button placed under Google button as requested
- **Modern VK ID**: Uses new VK ID SDK instead of legacy VK OAuth
- **Referral support**: VK authentication supports referral codes
- **Auto-admin assignment**: Email whitelist works with VK OAuth
- **100 credits bonus**: New VK users receive 100 credits on signup

### Technical Details
- **Lines of code added**: ~800+
- **Files created**: 4
- **Files modified**: 14
- **VK ID SDK version**: Latest (via CDN)
- **Retry mechanism**: 10 attempts with 500ms intervals
- **Error handling**: Full Russian localization

---

## [0.12.6] - 2025-11-26

### Added - iPhone Photo Support (MPO/HEIC)

#### Backend
- **pillow-heif library**: Added support for iPhone HEIC/HEIF image formats
  - Added `pillow-heif==0.14.0` to requirements.txt
  - Installed `libheif-dev` in Dockerfile for HEIF codec support
  - Registered HEIC opener in main.py startup to enable automatic HEIC detection
  - File: [backend/requirements.txt](backend/requirements.txt), [backend/Dockerfile](backend/Dockerfile)

- **MPO format support**: Added support for Multi-Picture Object format (used by some cameras)
  - Updated `ALLOWED_EXTENSIONS` to include `heic,heif,mpo`
  - File: [backend/app/core/config.py:163](backend/app/core/config.py#L163)

- **Image conversion utility**: Created automatic converter for HEIC/MPO → JPEG
  - New function `convert_to_jpeg_if_needed()` in `image_utils.py`
  - Automatically converts HEIC/HEIF/MPO formats to JPEG before processing
  - Preserves EXIF data and image quality during conversion
  - File: [backend/app/utils/image_utils.py](backend/app/utils/image_utils.py)

- **File validation**: Enhanced image validator to support new formats
  - Added magic byte detection for HEIC (`ftyp`)
  - Added validation for MPO format (JPEG with APP2 marker)
  - Updated MIME type mapping to accept `image/heic` and `image/heif`
  - File: [backend/app/services/file_validator.py](backend/app/services/file_validator.py)

- **Task integration**: Integrated HEIC/MPO conversion in Celery tasks
  - Fitting task: Converts user and item photos before try-on generation
  - Editing task: Converts base images before AI editing
  - Files: [backend/app/tasks/fitting.py](backend/app/tasks/fitting.py), [backend/app/tasks/editing.py](backend/app/tasks/editing.py)

#### Frontend
- **FileUpload component**: Updated to accept HEIC/HEIF/MPO files
  - Added `.heic,.heif,.mpo` to accepted file types
  - Updated validation messages to mention iPhone photo support
  - File: [frontend/src/components/common/FileUpload.tsx](frontend/src/components/common/FileUpload.tsx)

### Added - Email Verification System

#### Backend
- **Email verification dependency**: Created `require_verified_email` dependency
  - Blocks access to premium features for unverified email users
  - Exempts admins and Google OAuth users from verification
  - Returns HTTP 403 with clear error message for unverified users
  - File: [backend/app/api/dependencies.py](backend/app/api/dependencies.py)

- **Protected endpoints**: Added email verification requirement to critical endpoints
  - Fitting generation: `/api/v1/fitting/generate` now requires verified email
  - Editing chat: `/api/v1/editing/chat` now requires verified email
  - Editing generation: `/api/v1/editing/generate` now requires verified email
  - Payment creation: `/api/v1/payments/create` now requires verified email
  - Files: [backend/app/api/v1/endpoints/fitting.py:99](backend/app/api/v1/endpoints/fitting.py#L99), [backend/app/api/v1/endpoints/editing.py:164](backend/app/api/v1/endpoints/editing.py#L164), [backend/app/api/v1/endpoints/payments.py:55](backend/app/api/v1/endpoints/payments.py#L55)

- **SMTP configuration**: Email service already implemented with Mail.ru SMTP support
  - Supports TLS (port 587) and SSL (port 465) connections
  - HTML and plain text email templates
  - Configurable via environment variables (SMTP_HOST, SMTP_USER, SMTP_PASSWORD)
  - File: [backend/app/services/email.py](backend/app/services/email.py)

#### Frontend
- **Email verification banner**: Component already integrated in Layout
  - Shows warning to unverified users
  - Provides "Resend verification email" button
  - Dismissible with localStorage persistence
  - File: [frontend/src/components/common/EmailVerificationBanner.tsx](frontend/src/components/common/EmailVerificationBanner.tsx)

- **Profile page**: Already displays email verification status
  - Shows verified/unverified badge
  - Allows resending verification email
  - File: [frontend/src/pages/ProfilePage.tsx](frontend/src/pages/ProfilePage.tsx)

### Changed - Russian Localization

#### Frontend
- **LoginPage**: Fully translated to Russian
  - "Sign in to your account" → "Войдите в свой аккаунт"
  - "create a new account" → "создайте новый аккаунт"
  - "Or continue with email" → "Или продолжите с email"
  - All form labels and buttons translated
  - File: [frontend/src/pages/LoginPage.tsx](frontend/src/pages/LoginPage.tsx)

- **RegisterPage**: Fully translated to Russian
  - "Create your account" → "Создайте свой аккаунт"
  - "Already have an account?" → "Уже есть аккаунт?"
  - Referral invitation message translated
  - Password strength indicator translated
  - All form fields and validation messages in Russian
  - File: [frontend/src/pages/RegisterPage.tsx](frontend/src/pages/RegisterPage.tsx)

- **GoogleSignInButton**: Component comments and error messages translated
  - "Google Sign-In not configured" → "Google вход не настроен"
  - "Loading Google Sign-In..." → "Загрузка Google входа..."
  - "Google Sign-In failed" → "Google вход не удался"
  - File: [frontend/src/components/auth/GoogleSignInButton.tsx](frontend/src/components/auth/GoogleSignInButton.tsx)

- **MockPaymentEmulator**: Development tool fully translated
  - "Loading..." → "Загрузка..."
  - "Refresh" → "Обновить"
  - "Error" / "Success" → "Ошибка" / "Успех"
  - "No payments found" → "Платежи не найдены"
  - "Approve" / "Cancel" → "Подтвердить" / "Отменить"
  - All payment details and warnings in Russian
  - File: [frontend/src/pages/MockPaymentEmulator.tsx](frontend/src/pages/MockPaymentEmulator.tsx)

- **Verified existing translations**: Confirmed these pages already in Russian
  - HomePage, ProfilePage, EmailVerificationPage, ErrorPage, LoadingPage, AuthGuard
  - No changes needed

### Impact
- **iPhone users**: Can now upload photos directly from iPhone Camera (HEIC/HEIF format)
- **Security**: Unverified users cannot use premium features (fitting, editing, payments)
- **UX**: Entire authentication flow now in Russian for Russian-speaking users
- **Email verification**: Ready for production deployment (requires SMTP configuration)

### Configuration Required
- **SMTP Mail.ru setup**: Add to `backend/.env`:
  ```
  SMTP_HOST=smtp.mail.ru
  SMTP_PORT=465
  SMTP_USER=your-email@mail.ru
  SMTP_PASSWORD=your-app-password
  SMTP_USE_TLS=false
  EMAIL_FROM=your-email@mail.ru
  ```

---

## [0.12.5] - 2025-11-23

## [Unreleased]

### Changed - kie.ai integration
- Переписан клиент kie.ai под новый API (`/api/v1/jobs/createTask` + `/api/v1/gpt4o-image/record-info`), теперь передаются публичные URL вместо base64.
- Добавлен флаг `KIE_AI_DISABLE_FALLBACK` для отладки: при включении отключается fallback на OpenRouter и ошибки kie.ai видны сразу.
- Для работы kie.ai требуется, чтобы ссылки на `/uploads/*` были доступны извне (или через туннель), иначе сервис не сможет скачать изображения и задачи зависнут по таймауту.

### Changed - Web auth
- Убран принудительный баннер «Откройте через Telegram»: AuthGuard больше не блокирует доступ вне Telegram, а auto-login через Telegram выполняется только если приложение действительно запущено внутри Telegram WebApp.

### Fixed - Google OAuth Authentication

#### Backend
- **Critical fix: Missing UserRole import**: Added missing `UserRole` import in `auth_web.py:24`
  - Previously caused `NameError: name 'UserRole' is not defined` during user registration and login
  - This error resulted in 500 Internal Server Error when attempting Google OAuth or email registration
  - Auto-assignment of ADMIN role was failing silently
  - File: [backend/app/api/v1/endpoints/auth_web.py:24](backend/app/api/v1/endpoints/auth_web.py#L24)

### Changed - Admin Configuration

#### Backend
- **Admin email whitelist**: Updated `ADMIN_EMAIL_WHITELIST` to include both super-admin accounts
  - Added support for multiple admin emails: `cherus09@mail.ru,cherus09@gmail.com`
  - Auto-assignment of ADMIN role now works correctly for both accounts
  - File: [backend/.env:78](backend/.env#L78)

### Notes
- Backend container was restarted to apply environment variable changes
- Users with whitelisted emails will automatically receive ADMIN role upon next login
- Google Cloud Console origins have been verified and configured correctly

---

## [0.12.4] - 2025-11-22

### Changed - Editing Flow & UX
- **Registration bonus**: Email/Google регистрации теперь начисляют 100 кредитов для быстрого старта.
- **Base image preview**: превью базового изображения в чате использует полный `VITE_API_BASE_URL` и отображается уменьшенным (`object-contain`, `max-h-96`), чтобы не растягивать экран.
- **Prompt decision modal**: кнопки «Отправить без улучшений» / «Улучшить с AI» теперь надёжно отрабатывают (submit), тексты упрощены для новичков.
- **Prompt assistant model**: конфиг `OPENROUTER_PROMPT_MODEL` и UI подпись ассистента без упоминаний внутренних сервисов.
- **Upload → session**: фронт использует `base_image_url` из `/editing/upload`, что предотвращает пустой UI после загрузки.
- **OpenRouter ретраи**: для генерации редактирования отключены автоповторы Celery (max_retries=0), чтобы не слать запросы каждые 60с и не сжигать токены при ошибках.
- **refreshProfile**: фронт теперь берёт профиль из `response.user`, убирая циклические 401 и некорректное состояние баланса после логина/регистрации.
- **Новый E2E**: добавлен `e2e_editing_test.py` — полный сценарий редактирования (регистрация, загрузка фото, улучшение промпта, генерация, скриншот артефакта в `.playwright-mcp/`).
- **Auth hardening**: добавлен whitelist доменов (`ALLOWED_EMAIL_DOMAINS`) и rate-limit на регистрацию (`REGISTER_RATE_LIMIT_PER_MINUTE`), автоприсвоение роли ADMIN при Google-логине для email из whitelist.
- **CORS dev**: добавлены origin `127.0.0.1:5173/5174` для локального Vite.
- **Fitting prompts**: ужесточены промты для рук и обуви (запрет лишних конечностей, совпадение масштаба/фона, без белых полей).

### Notes
- После обновлений фронт нужно перезапустить dev-сервер; на некоторых окружениях может потребоваться ручной запуск Vite.

---

## [0.12.3] - 2025-11-20

### Fixed - Virtual Try-On Queue Stall

- **Celery worker queue binding**: the worker was consuming only the default `celery` queue, while all virtual try-on tasks were routed to the named queues `fitting`, `editing`, and `maintenance`. This left try-on tasks stuck in `pending` forever and the UI spinner never finished. All startup scripts, Docker Compose services, and documentation now launch Celery with `-Q fitting,editing,maintenance` so the worker actually processes those queues. Without this flag the try-on endpoint appeared broken even though the API request succeeded.

---

## [0.12.1] - 2025-11-18

### Fixed - Credits and Virtual Try-On

#### Backend
- **Initial credits bonus**: New users now receive 10 test credits upon registration
  - Email/Password registration: `balance_credits=10` ([auth_web.py:143](backend/app/api/v1/endpoints/auth_web.py#L143))
  - Google OAuth registration: `balance_credits=10` ([auth_web.py:334](backend/app/api/v1/endpoints/auth_web.py#L334))

#### Frontend
- **Virtual try-on zone logic**: Fixed "Skip" button behavior
  - When "Skip" is pressed, zone is now set to `'body'` instead of `null` ([Step3Zone.tsx:50](frontend/src/components/fitting/Step3Zone.tsx#L50))
  - Updated hint text to remove misleading "AI will determine automatically" phrase
  - New hint: "When 'Skip' is pressed, try-on will be applied to full body"

### Impact
- **New users benefit**: Each new user gets 10 credits (5 generations × 2 credits) + 10 Freemium actions
- **Better UX**: Clear and accurate guidance for virtual try-on zone selection
- **Consistent behavior**: "Skip" button now produces predictable results (full body try-on)

---

## [0.12.0] - 2025-11-18

### Added - Web Authentication System

#### Backend
- **New API endpoints** (`/api/v1/auth-web`):
  - `POST /register` - Email/Password registration
  - `POST /login` - Email/Password login
  - `POST /google` - Google OAuth (optional)
  - `GET /me` - Get current user profile
- **Enhanced User model** with web auth support:
  - `email` field (unique, indexed)
  - `email_verified` flag
  - `password_hash` (bcrypt with 12 rounds)
  - `auth_provider` enum (EMAIL, GOOGLE, TELEGRAM)
  - `oauth_provider_id` for external OAuth
- **Security enhancements**:
  - Password strength validation (8+ chars, uppercase, lowercase, digit, special char)
  - bcrypt password hashing
  - JWT tokens for web sessions
- **Pydantic schemas** (`auth_web.py`):
  - RegisterRequest, LoginRequest, LoginResponse
  - UserProfile, GoogleOAuthRequest/Response

#### Frontend
- **Authentication pages**:
  - LoginPage - Email/Password login form
  - RegisterPage - User registration form
- **Zustand store** (`authStore.ts`):
  - Email/Password registration
  - Email/Password login
  - Google OAuth integration
  - Persistent auth state (localStorage)
- **API client** (`authWeb.ts`):
  - Axios-based client with JWT interceptors
  - Type-safe API methods
- **Auth hook** (`useAuth.ts`):
  - Auto-login logic for Telegram WebApp
  - Dev mode support (manual login)
  - Computed values (hasCredits, canUseFreemium, hasActiveSubscription)

#### Database
- **Migration**: Updated `auth_provider_enum` to uppercase values
- **Backward compatibility**: Existing Telegram users preserved

### Fixed

1. **Missing email-validator package**
   - Installed `email-validator` for Pydantic EmailStr support

2. **Pydantic forward reference error**
   - Added `from __future__ import annotations`
   - Moved `UserProfile` class to top of file

3. **Missing auth routes (404)**
   - Added LoginPage and RegisterPage routes to App.tsx

4. **API endpoint mismatch**
   - Updated frontend API client to use `/api/v1/auth-web/` prefix

5. **Router prefix mismatch**
   - Changed backend router prefix from `/auth` to `/auth-web`

6. **AuthProvider enum mismatch**
   - Synchronized Python enum and database enum to uppercase
   - Updated database enum: `email` → `EMAIL`, etc.

7. **Cached statement error**
   - Added documentation about backend restart after schema changes

8. **useAuth hook errors**
   - Fixed method names: `login` → `loginWithEmail`, etc.
   - Added dev mode auto-login skip logic

### Tested
- ✅ E2E testing with Playwright MCP
- ✅ Email/Password registration flow
- ✅ Email/Password login flow
- ✅ JWT token persistence
- ✅ Protected routes with authentication
- ✅ Password hashing and validation

### Documentation
- Created comprehensive implementation report: `docs/WEB_AUTH_IMPLEMENTATION.md`
- Updated README.md with web auth information
- Added troubleshooting guide for common issues

---

## [0.11.3] - 2025-11-17

### Fixed - Cache Busting for Telegram WebApp

#### Frontend
- Implemented cache busting for production builds
- Added version query parameter to asset URLs
- Updated nginx configuration for proper cache control

#### Deployment
- Updated deployment scripts with cache busting support
- Added version tracking in deployment process

---

## [0.11.0] - 2025-11-15

### Added - Initial Release

#### Core Features
- Virtual clothing try-on with AI
- AI-powered image editing with chat assistant
- Freemium model (10 actions/month with watermark)
- Subscription system (Basic, Pro, Premium)
- Credit purchase system
- Referral program (+10 credits per referral)

#### Backend
- FastAPI async backend
- PostgreSQL database with SQLAlchemy ORM
- Celery + Redis for async tasks
- Alembic migrations
- kie.ai integration (Nano Banana)
- OpenRouter integration (GPT-4.1 Mini)
- YuKassa payment integration
- Telegram WebApp authentication

#### Frontend
- React 18 with TypeScript
- Vite build system
- Tailwind CSS styling
- Zustand state management
- Telegram WebApp SDK integration
- Responsive design
- Progressive Web App features

#### Security
- HMAC SHA-256 validation for Telegram initData
- JWT tokens for API sessions
- File validation (MIME + magic bytes)
- Rate limiting (10 req/min/user)
- SQL injection protection via ORM
- XSS sanitization
- GDPR compliance (auto-delete files)

---

## Version History

- **0.12.3** (2025-12-09) - Fix virtual try-on/editing results re-hosting with EXIF normalization, step-back navigation in wizard, OAuth button alignment, updated disclaimers and upload limits.
- **0.12.2** (2025-11-18) - Virtual Try-On Critical Bug Fix + E2E Testing
- **0.12.1** (2025-11-18) - Credits and Virtual Try-On Fixes
- **0.12.0** (2025-11-18) - Web Authentication System
- **0.11.3** (2025-11-17) - Cache Busting Fix
- **0.11.0** (2025-11-15) - Initial Release

---

**Note**: For detailed technical documentation of version 0.12.0, see [docs/WEB_AUTH_IMPLEMENTATION.md](docs/WEB_AUTH_IMPLEMENTATION.md)
