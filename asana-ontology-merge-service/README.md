# asana-ontology-merge-service

Архитектура:

```
┌─────────────────────────────┐
│  Go binary                  │  ← ядро + красивый CLI (cobra + lipgloss)
│  asana-ontology-merge       │
└─────────────▲───────────────┘
              │ subprocess --json-stdout
┌─────────────┴───────────────┐
│  Python FastAPI wrapper     │  ← тонкий HTTP + admin JWT
│  app/main.py                │
└─────────────────────────────┘
```

## CLI (локальный бинарник)

```bash
cd asana-ontology-merge-service/go
go build -o ../bin/asana-ontology-merge ./cmd/asana-ontology-merge

../bin/asana-ontology-merge preview base.owl incoming.owl
../bin/asana-ontology-merge preview base.owl incoming.owl --json report.json
../bin/asana-ontology-merge preview base.owl incoming.owl --json-stdout   # для API
../bin/asana-ontology-merge version
```

Цветной TUI: карточки summary, блоки added/removed, конфликты меток.

## HTTP API (обёртка)

- `GET /health` — наличие бинарника
- `POST /api/admin/ontology-merge/preview` — multipart `base` + `incoming` (только admin)

Переменная `MERGE_BINARY` — путь к Go-бинарнику (в Docker: `/usr/local/bin/asana-ontology-merge`).

## Docker

Multi-stage: сначала `go build`, затем Python-slim + бинарник.

```bash
docker compose build asana-ontology-merge
docker compose run --rm asana-ontology-merge \
  asana-ontology-merge preview /data/a.owl /data/b.owl
```
