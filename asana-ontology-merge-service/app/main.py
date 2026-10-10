"""
Тонкая Python API-обёртка над Go-бинарником asana-ontology-merge.
Вся логика сравнения — в бинарнике; здесь только HTTP + auth + subprocess.
"""
from __future__ import annotations

import json
import logging
import os
import subprocess
import tempfile
from pathlib import Path

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile

from app.auth_admin import require_admin

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("asana_ontology_merge_api")

BINARY = os.getenv(
    "MERGE_BINARY",
    str(Path(__file__).resolve().parent.parent / "bin" / "asana-ontology-merge"),
)

app = FastAPI(
    title="Asana Ontology Merge Service",
    description="Python API-обёртка над Go CLI-бинарником asana-ontology-merge (НИР).",
    version="0.2.0",
)


@app.get("/health")
def health():
    ok = Path(BINARY).is_file() and os.access(BINARY, os.X_OK)
    return {
        "status": "ok" if ok else "degraded",
        "service": "asana-ontology-merge-service",
        "binary": BINARY,
        "binary_present": ok,
    }


def _run_preview(base_path: Path, incoming_path: Path) -> dict:
    cmd = [BINARY, "preview", str(base_path), str(incoming_path), "--json-stdout"]
    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120,
            check=False,
        )
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Go binary not found: {BINARY}",
        ) from exc
    except subprocess.TimeoutExpired as exc:
        raise HTTPException(status_code=504, detail="Merge binary timeout") from exc

    if proc.returncode != 0:
        err = (proc.stderr or proc.stdout or "merge binary failed").strip()
        raise HTTPException(status_code=400, detail=err)

    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Invalid JSON from binary: {exc}",
        ) from exc


@app.post("/api/admin/ontology-merge/preview")
async def preview_merge(
    base: UploadFile = File(...),
    incoming: UploadFile = File(...),
    user: str = Depends(require_admin),
):
    logger.info("preview by %s via binary base=%s incoming=%s", user, base.filename, incoming.filename)
    base_bytes = await base.read()
    incoming_bytes = await incoming.read()
    if not base_bytes or not incoming_bytes:
        raise HTTPException(status_code=400, detail="Оба файла должны быть непустыми")
    if len(base_bytes) > 80 * 1024 * 1024 or len(incoming_bytes) > 80 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Файл слишком большой (лимит 80 МБ)")

    with tempfile.TemporaryDirectory(prefix="owl-merge-") as tmp:
        base_path = Path(tmp) / (base.filename or "base.owl")
        incoming_path = Path(tmp) / (incoming.filename or "incoming.owl")
        base_path.write_bytes(base_bytes)
        incoming_path.write_bytes(incoming_bytes)
        return _run_preview(base_path, incoming_path)
