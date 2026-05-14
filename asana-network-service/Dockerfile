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

# Сначала ставим CPU-сборку torch — без CUDA-пакетов nvidia_* (на linux/amd64
# дефолтный torch с PyPI тянет ~3 ГБ обвеса). CPU-сборка ставит torch ~200 МБ
# и совместима с YOLO-cls inference, который и так бежит на CPU.
RUN pip install --index-url https://download.pytorch.org/whl/cpu torch==2.4.1

COPY requirements.txt .

RUN pip install -r requirements.txt python-dotenv

COPY . .

EXPOSE 8001

CMD ["sh", "-c", "python main.py"]
