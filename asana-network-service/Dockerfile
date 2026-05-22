FROM python:3.12-slim

ENV PIP_DEFAULT_TIMEOUT=120 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libgl1 libglib2.0-0 curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Ставим совместимую CPU-пару torch+torchvision, чтобы ultralytics не апгрейдил их
# до последних GPU-сборок с nvidia_* пакетами (они и заполняют диск).
RUN pip install --index-url https://download.pytorch.org/whl/cpu \
    torch==2.4.1 torchvision==0.19.1

COPY requirements.txt .

RUN pip install -r requirements.txt python-dotenv

COPY . .

EXPOSE 8001

CMD ["sh", "-c", "python main.py"]
