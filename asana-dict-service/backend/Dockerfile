FROM python:3.11-slim

WORKDIR /app

# Медленный/нестабильный PyPI → таймаут pip по умолчанию (15s) часто рвёт крупные wheel (Pillow и т.д.)
ENV PIP_DEFAULT_TIMEOUT=120

# Install build dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --retries 10 --no-cache-dir -r requirements.txt

COPY . .

# Создаем файл онтологии и устанавливаем права доступа
RUN touch ontology_updated.owl && \
    chmod 666 ontology_updated.owl

# Запускаем через uvicorn напрямую
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
