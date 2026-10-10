import os


class Settings:
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8010"))
    AUTH_SERVICE_URL: str = os.getenv("AUTH_SERVICE_URL", "http://server-module:8000").rstrip("/")
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg2://{user}:{password}@{host}:{port}/{db}".format(
            user=os.getenv("DB_USER", os.getenv("POSTGRES_USER", "asana_user")),
            password=os.getenv("DB_PASSWORD", os.getenv("POSTGRES_PASSWORD", "asana_password")),
            host=os.getenv("DB_HOST", os.getenv("POSTGRES_HOST", "postgres")),
            port=os.getenv("DB_PORT", os.getenv("POSTGRES_PORT", "5432")),
            db=os.getenv("DB_NAME", os.getenv("POSTGRES_DB", "asana_db")),
        ),
    )
    DICT_SCHEMA: str = os.getenv("DICT_SCHEMA", "dict_schema")
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis:6379/0")
    # тот же ключ, что photo_same_as_cache в каталоге
    INFERRED_REDIS_KEY: str = os.getenv(
        "INFERRED_PHOTO_SAME_AS_REDIS_KEY",
        "ontology:inferred_photo_same_as:v3",
    )


settings = Settings()
