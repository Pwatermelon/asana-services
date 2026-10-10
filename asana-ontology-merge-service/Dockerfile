# --- stage 1: Go CLI binary ---
FROM golang:1.25-bookworm AS gobuild
ENV GOTOOLCHAIN=auto
WORKDIR /src
COPY go/go.mod go/go.sum ./
RUN go mod download
COPY go/ ./
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-s -w" -o /out/asana-ontology-merge \
    ./cmd/asana-ontology-merge

# --- stage 2: Python API wrapper ---
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    MERGE_BINARY=/usr/local/bin/asana-ontology-merge

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY app ./app
COPY --from=gobuild /out/asana-ontology-merge /usr/local/bin/asana-ontology-merge
RUN chmod +x /usr/local/bin/asana-ontology-merge

EXPOSE 8011
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8011"]
