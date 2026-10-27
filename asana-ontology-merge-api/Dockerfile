# Тонкий API-контейнер каталога.
# CLI НЕ собирается здесь — скачивается linux-amd64 из GitHub Releases
# репозитория owl-ontology-versioning.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    MERGE_BINARY=/usr/local/bin/owl-versioning

ARG OWL_VERSIONING_REPO=Pwatermelon/owl-ontology-versioning
# latest | v0.3.0 | 0.3.0
ARG OWL_VERSIONING_VERSION=latest
ENV OWL_VERSIONING_REPO=${OWL_VERSIONING_REPO} \
    OWL_VERSIONING_VERSION=${OWL_VERSIONING_VERSION}

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Скачать бинарник из GitHub Release
RUN set -eux; \
    REPO="${OWL_VERSIONING_REPO}"; \
    VER="${OWL_VERSIONING_VERSION}"; \
    ASSET="owl-versioning-linux-amd64"; \
    if [ "$VER" = "latest" ] || [ -z "$VER" ]; then \
      URL="https://github.com/${REPO}/releases/latest/download/${ASSET}"; \
    else \
      case "$VER" in v*) TAG="$VER" ;; *) TAG="v${VER}" ;; esac; \
      URL="https://github.com/${REPO}/releases/download/${TAG}/${ASSET}"; \
    fi; \
    echo "Downloading CLI: ${URL}"; \
    curl -fsSL -o /usr/local/bin/owl-versioning "${URL}"; \
    chmod +x /usr/local/bin/owl-versioning; \
    /usr/local/bin/owl-versioning version

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY app ./app

EXPOSE 8011
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8011"]
