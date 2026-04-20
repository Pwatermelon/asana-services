# Сборка из корня asana-dict-service: docker compose build asana-import
# Копируется общий пакет app (онтология, excel, БД) + только код МС import_service.

FROM python:3.11-slim

WORKDIR /app
ENV PYTHONPATH=/app
ENV PIP_DEFAULT_TIMEOUT=120

RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

COPY backend/app ./app
COPY import-service/import_service ./import_service
COPY import-service/requirements.txt ./requirements-import.txt

RUN pip install --retries 10 --no-cache-dir -r requirements-import.txt

RUN mkdir -p frontend/app/templates

RUN touch ontology_updated.owl && chmod 666 ontology_updated.owl

EXPOSE 8000

CMD ["uvicorn", "import_service.main:app", "--host", "0.0.0.0", "--port", "8000"]
