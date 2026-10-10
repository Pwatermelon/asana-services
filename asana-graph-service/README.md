# asana-graph-service

Отдельный микросервис графа связей асан (`isSameAsObject` на уровне фото → рёбра между асанами).

## API

- `GET /health`
- `GET /api/admin/asana-graph?include_inferred=&only_linked=` — только администратор (JWT → server-module)

## Данные

Читает `dict_schema.catalog_mirror_items` (PostgreSQL). Не импортирует код `asana-dict-service`.

## Запуск

```bash
uvicorn main:app --host 0.0.0.0 --port 8010
```
