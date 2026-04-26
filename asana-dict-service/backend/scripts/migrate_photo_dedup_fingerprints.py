#!/usr/bin/env python3
"""
Миграция photoDedupFingerprint: AsanaPhoto с s3PhotoPath без отпечатка — байты из MinIO,
pHash-набор на 0/90/180/270°, запись в онтологию.

Вызывается при старте контейнера asana-backend (docker-entrypoint.sh), идемпотентно.
Ручной запуск: cd backend && python scripts/migrate_photo_dedup_fingerprints.py

Переменные окружения — как у сервиса (.env): MinIO, БД. Отключить автозапуск в compose:
  SKIP_PHOTO_DEDUP_MIGRATION=1
"""
from __future__ import annotations

import os
import sys
import traceback

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def main() -> None:
    from rdflib import RDF, Literal

    from app.ontology import ASANA, get_graph, _persist_ontology_graph
    from app.photo_dedup import compute_photo_dedup_fingerprint, norm_dedup_fp
    from app.s3_utils import get_s3_object_bytes

    g = get_graph()
    todo: list = []
    for photo_uri in g.subjects(RDF.type, ASANA.AsanaPhoto):
        if g.value(photo_uri, ASANA.photoDedupFingerprint):
            continue
        if g.value(photo_uri, ASANA.s3PhotoPath):
            todo.append(photo_uri)
    if not todo:
        print(
            "migrate_photo_dedup_fingerprints: nothing to do "
            "(all AsanaPhoto with S3 path already have photoDedupFingerprint)"
        )
        return

    updated = 0
    errors = 0
    first_error_detail: str | None = None
    for photo_uri in todo:
        s3_path = g.value(photo_uri, ASANA.s3PhotoPath)
        try:
            raw = get_s3_object_bytes(str(s3_path))
            if not raw or len(raw) < 40:
                errors += 1
                if first_error_detail is None:
                    first_error_detail = f"empty_or_short_bytes s3={s3_path!r} len={len(raw) if raw else 0}"
                continue
            fp = compute_photo_dedup_fingerprint(raw)
            if not norm_dedup_fp(fp):
                errors += 1
                if first_error_detail is None:
                    first_error_detail = (
                        f"empty_fingerprint (install ImageHash / check image?) s3={s3_path!r}"
                    )
                continue
            g.add((photo_uri, ASANA.photoDedupFingerprint, Literal(fp)))
            updated += 1
        except Exception as e:
            errors += 1
            if first_error_detail is None:
                first_error_detail = f"{type(e).__name__}: {e}\n{traceback.format_exc()}"

    if updated:
        _persist_ontology_graph(g)
    print(f"migrate_photo_dedup_fingerprints: updated={updated}, errors={errors}")
    if errors and first_error_detail:
        print("migrate_photo_dedup_fingerprints: first_error:\n", first_error_detail, file=sys.stderr)


if __name__ == "__main__":
    main()
