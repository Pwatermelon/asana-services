# asana-ontology-merge-api

Тонкая **HTTP-обёртка** админки над CLI `owl-versioning`.

Исходников CLI здесь нет. Бинарник **скачивается из GitHub Releases** репозитория
[`owl-ontology-versioning`](https://github.com/Pwatermelon/owl-ontology-versioning)
на этапе `docker build`.

## Сборка

```bash
# нужен уже опубликованный Release в CLI-репо
docker compose build asana-ontology-merge

# конкретная версия:
OWL_VERSIONING_VERSION=v0.3.0 docker compose build asana-ontology-merge
```

Dockerfile:

```dockerfile
ARG OWL_VERSIONING_VERSION=latest
# curl https://github.com/…/releases/…/owl-versioning-linux-amd64
```

## API

- `GET /health`
- `POST /api/admin/ontology-merge/preview` — multipart `base` + `incoming` (admin JWT)

## Порядок деплоя

1. Пуш + тег `vX.Y.Z` в `owl-ontology-versioning` → Release с linux/windows бинарниками.
2. Пуш/деплой `asana-services` → API-образ тянет нужный linux-бинарник из Release.
