# Интеграция авторизации через asana-server-module

## Обзор

Авторизация теперь обрабатывается через отдельный сервис `asana-server-module`, а `asana-dict-service` только проверяет токены и использует их для определения прав доступа.

## Как работает авторизация в asana-server-module

### Эндпоинты авторизации

- `POST /api/auth/token` - OAuth2 форма (для совместимости)
- `POST /api/auth` - Авторизация по login/mail и password
- `POST /api/auth/registration` - Регистрация нового пользователя
- `GET /api/auth/verify/{token}` - Подтверждение email
- `GET /api/auth/reset_password_request?login={login}` - Запрос сброса пароля
- `PATCH /api/auth/reset_password` - Сброс пароля по токену

### Формат JWT токена

Токен создается с полями:
```json
{
  "login": "user_login",
  "exp": 1234567890
}
```

**Важно:** Токен содержит поле `login`, а не `sub` или `username`!

### Параметры токена

- **Алгоритм:** HS256
- **Секретный ключ:** Из переменной окружения `SECRET_KEY`
- **Срок действия:** 7 дней (1 неделя)
- **Формат:** `{"access_token": "token_string", "token_type": "bearer"}`

### Проверка токена

Функция `get_current_user` в `asana-server-module`:
- Проверяет токен из заголовка `Authorization: Bearer <token>`
- Или из cookie `access_token`
- Декодирует токен и извлекает `login`
- Загружает пользователя из БД по `login`

## Различия между моделями User

### asana-server-module (t_users)

```python
class User:
    id: int
    login: str (unique)          # Вместо username
    mail: str (unique)            # Вместо email
    password: str                # Хеш пароля
    is_admin: bool               # Флаг админа (вместо role)
    permission_study: bool       # Разрешение на обучение
    is_verify: bool              # Подтверждение email
```

### asana-dict-service (users)

```python
class User:
    id: int
    username: str (unique)       # Вместо login
    email: str (unique)          # Вместо mail
    first_name: str
    last_name: str
    password_hash: str
    role: str (enum)            # admin/expert/guest
    is_confirmed: bool
    confirmation_code: str
```

## Что отсутствует в asana-server-module

### 1. Роли пользователей

**Проблема:** `asana-server-module` использует только флаг `is_admin` (boolean), а `asana-dict-service` ожидает роли: `admin`, `expert`, `guest`.

**Решение:**
- Добавить поле `role` в модель `User` в `asana-server-module`
- Или добавить поле `is_expert` (boolean)
- Или использовать `permission_study` как признак эксперта

### 2. Поля в JWT токене

**Проблема:** Токен содержит только `login`, а `asana-dict-service` ожидает:
- `sub` или `username` (вместо `login`)
- `role` (отсутствует в токене)

**Решение:**
- Изменить `create_access_token` в `asana-server-module` чтобы добавлять `role` в токен
- Или изменить проверку токена в `asana-dict-service` чтобы использовать `login` вместо `sub`

### 3. Различия в именах полей

**Проблема:** 
- `asana-server-module` использует `login`, `asana-dict-service` ожидает `username`
- `asana-server-module` использует `mail`, `asana-dict-service` ожидает `email`

**Решение:**
- Изменить `asana-dict-service` чтобы использовать `login` из токена
- Или добавить маппинг в проверке токена

### 4. Дополнительные поля

**asana-server-module имеет:**
- `permission_study` - нет аналога в `asana-dict-service`
- `is_verify` - аналог `is_confirmed` в `asana-dict-service`

**asana-dict-service имеет:**
- `first_name`, `last_name` - нет в `asana-server-module`
- `confirmation_code` - нет в `asana-server-module` (используется токен для верификации)

## Рекомендации по интеграции

### Вариант 1: Минимальные изменения (рекомендуется)

1. **Изменить `asana-dict-service/auth.py`:**
   - В `get_current_user` использовать `login` вместо `sub` из токена
   - Получать роль из БД по `login` (или из токена, если добавить)

2. **Добавить в `asana-server-module`:**
   - Поле `role` в модель `User`
   - Добавить `role` в JWT токен при создании

3. **Маппинг ролей:**
   - `is_admin = True` → `role = "admin"`
   - `permission_study = True` → `role = "expert"`
   - Иначе → `role = "guest"`

### Вариант 2: Полная синхронизация

1. Добавить поля `first_name`, `last_name` в `asana-server-module`
2. Унифицировать имена полей (`username`/`login`, `email`/`mail`)
3. Добавить поле `role` вместо `is_admin`
4. Изменить формат токена для совместимости

### Вариант 3: Использовать только токен

1. Не проверять наличие пользователя в БД `asana-dict-service`
2. Использовать только данные из токена
3. Добавить `role` в токен в `asana-server-module`

## Текущая интеграция

### Что работает сейчас

1. `asana-dict-service` удалены все эндпоинты авторизации
2. `asana-dict-service` проверяет токены через `get_user_role_from_request`
3. Токены декодируются с использованием `SECRET_KEY`

### Что нужно доработать

1. **Изменить проверку токена:**
   ```python
   # В asana-dict-service/backend/app/main.py
   def get_user_role_from_request(request: Request) -> str:
       token = ...
       payload = jwt.decode(token, config.SECRET_KEY, algorithms=[config.ALGORITHM])
       login = payload.get("login")  # Вместо "sub" или "username"
       # Получить роль из БД или из токена
   ```

2. **Добавить роль в токен** (в `asana-server-module`):
   ```python
   # В asana-server-module/src/api/auth/utils/auth_utils.py
   def create_access_token(data: dict):
       # Определить роль пользователя
       role = "admin" if user.is_admin else ("expert" if user.permission_study else "guest")
       to_encode.update({"role": role})
   ```

3. **Использовать роль из токена** (в `asana-dict-service`):
   ```python
   def get_user_role_from_request(request: Request) -> str:
       payload = jwt.decode(token, config.SECRET_KEY, algorithms=[config.ALGORITHM])
       return payload.get("role", "guest")  # Использовать роль из токена
   ```

## Docker Compose

Общий `docker-compose.yml` в корне проекта объединяет:
- `auth-service` - сервис авторизации (asana-server-module)
- `asana-backend` - бэкенд каталога асан
- `asana-frontend` - фронтенд React
- `postgres-auth` - БД для авторизации
- `postgres-asana` - БД для каталога асан
- `nginx` - проксирование запросов

## Переменные окружения

Все настройки в `.env.example`:
- `SECRET_KEY` - должен быть одинаковым для обоих сервисов!
- `AUTH_SERVICE_URL` - URL сервиса авторизации (для внутреннего использования)
- `VITE_AUTH_SERVICE_URL` - URL для фронтенда (для внешнего доступа)

