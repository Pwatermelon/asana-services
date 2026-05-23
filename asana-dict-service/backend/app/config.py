import os
import logging
import sys

# Основные настройки приложения
SECRET_KEY = os.getenv("SECRET_KEY", "your_secret_key_here")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

# Создаем путь к файлу онтологии внутри контейнера
OWL_FILE_PATH = "/app/ontology_updated.owl"

# Настройка логирования
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger("asana_service")

# База данных PostgreSQL
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "postgres")
POSTGRES_PORT = int(os.getenv("POSTGRES_PORT", "5432"))
POSTGRES_DB = os.getenv("POSTGRES_DB")
POSTGRES_USER = os.getenv("POSTGRES_USER")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD")

if not all([POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD]):
    raise ValueError("Missing required database environment variables")

# URL подключения к БД с указанием схемы для asana-dict-service
SQLALCHEMY_DATABASE_URL = f"postgresql+psycopg2://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}?options=-csearch_path%3Ddict_schema"

# URL для сервиса авторизации (server-module)
AUTH_SERVICE_URL = os.getenv("AUTH_SERVICE_URL", "http://server-module:8000")

from app.smtp_env import smtp_from, smtp_host, smtp_password, smtp_port, smtp_user

# Настройки SMTP (Яндекс: smtp.yandex.ru:465 SSL; порт 587 — STARTTLS)
SMTP_SERVER = smtp_host()
SMTP_PORT = smtp_port(465)
SMTP_USER = smtp_user() or "noreply@your-domain.com"
SMTP_PASSWORD = smtp_password()
SMTP_FROM = smtp_from(SMTP_USER)
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "Каталог Асан")

# Настройки MINIO S3
HOST_MINIO = os.getenv("HOST_MINIO", "minio")
PORT_MINIO = os.getenv("PORT_MINIO", "9000")
USER_MINIO = os.getenv("USER_MINIO", "minioadmin")
PASSWORD_MINIO = os.getenv("PASSWORD_MINIO", "minioadmin")
NAME_BUCKET_IMAGES_MINIO = os.getenv("NAME_BUCKET_IMAGES_MINIO", "images")
# Префикс объектов в bucket только для шага Excel→staging (до OWL). Успешный импорт всё равно пишет этот путь в онтологию; при обрыве импорта сироты можно чистить по префиксу (lifecycle/ручной gc), не трогая asans/.
S3_IMPORT_STAGING_PREFIX = os.getenv("S3_IMPORT_STAGING_PREFIX", "import-staging").strip().strip("/") or "import-staging"
# Используем Nginx прокси для доступа к MinIO, чтобы фронтенд мог получать изображения
MINIO_URL_PREFIX = os.getenv("MINIO_URL_PREFIX", "http://localhost/images")

# Настройки приложения
APP_NAME = "Каталог асан"
APP_DESCRIPTION = "Каталог асан для йоги с возможностью поиска и фильтрации"
APP_VERSION = "1.0.1"
APP_CONTACT_EMAIL = "admin@example.com"
