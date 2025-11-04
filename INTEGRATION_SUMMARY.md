# Резюме интеграции с server-module

## Что сделано

### 1. Разделение схем БД

**asana-dict-service** теперь использует схему `dict_schema`:
- Таблицы: `dict_schema.about_project`, `dict_schema.expert_instructions`
- Таблица `users` больше не создается (авторизация через server-module)

**server-module** использует схему по умолчанию (public):
- Таблицы: `t_users`, `t_yoga_poses`, и т.д.

### 2. Интеграция авторизации

**asana-dict-service** теперь:
- Использует HTTP запросы к `server-module` для проверки токенов
- Получает информацию о пользователе через `/api/users/me`
- Проверяет права через флаги `is_admin` и `permission_study` из server-module

**Маппинг ролей:**
- `is_admin = True` → `role = "admin"`
- `permission_study = True` → `role = "expert"`
- Иначе → `role = "guest"`

### 3. Docker Compose

- **Объединена БД**: Одна PostgreSQL для всех сервисов
- **Переименован сервис**: `auth-service` → `server-module`
- **Общие переменные**: `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`

### 4. Удалено из asana-dict-service

- Эндпоинты авторизации (`/login`, `/register`, `/token`, и т.д.)
- Создание пользователей по умолчанию
- Управление ролями пользователей (`/admin/update-user-role`)
- Таблица `users` (не создается, но модель оставлена для совместимости)

## Текущая архитектура

```
┌─────────────────────────────────────────────────────────┐
│                    Nginx (Port 80)                       │
└──────┬──────────────────────────────┬───────────────────┘
       │                              │
       ▼                              ▼
┌──────────────┐            ┌──────────────────┐
│ server-module│            │  asana-backend   │
│  (Port 8001) │            │   (Port 8000)    │
└──────┬───────┘            └────────┬──────────┘
       │                             │
       └──────────────┬──────────────┘
                      ▼
            ┌──────────────────┐
            │   PostgreSQL     │
            │  (Port 5432)     │
            │                  │
            │  - public schema │
            │    (server-module│
            │     tables)      │
            │                  │
            │  - dict_schema    │
            │    (asana-dict   │
            │     tables)      │
            └──────────────────┘
```

## Использование авторизации

### Frontend → server-module
- Авторизация: `POST /api/auth`
- Регистрация: `POST /api/auth/registration`
- Получение пользователя: `GET /api/users/me`

### asana-backend → server-module
- Проверка токена: `GET /api/users/me` с токеном
- Получение информации о пользователе для проверки прав

## Переменные окружения

Все настройки в `.env.example`:
- `SECRET_KEY` - должен быть одинаковым для обоих сервисов!
- `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` - общие для всех сервисов
- `AUTH_SERVICE_URL` - URL server-module (для внутреннего использования)
- `VITE_AUTH_SERVICE_URL` - URL для фронтенда (для внешнего доступа)

## Что нужно доработать (позже)

1. **Роли в токене**: Добавить поле `role` в JWT токен в server-module
2. **Унификация полей**: Использовать `login` вместо `username` везде
3. **Удаление User модели**: Полностью удалить модель User из asana-dict-service

## Зависимости

Добавлено в `asana-dict-service/backend/requirements.txt`:
- `httpx==0.25.0` - для HTTP запросов к server-module

