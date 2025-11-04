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

SQLALCHEMY_DATABASE_URL = f"postgresql+psycopg2://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"

# Настройки SMTP для отправки писем
SMTP_SERVER = os.getenv("SMTP_HOST", "mailcow")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USER = os.getenv("SMTP_USER", "noreply@your-domain.com")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "your-smtp-password")
SMTP_FROM = os.getenv("SMTP_FROM", "noreply@your-domain.com")
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "Каталог Асан")

# Настройки приложения
APP_NAME = "Каталог асан"
APP_DESCRIPTION = "Каталог асан для йоги с возможностью поиска и фильтрации"
APP_VERSION = "1.0.1"
APP_CONTACT_EMAIL = "admin@example.com"
