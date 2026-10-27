"""
Тонкая HTTP-обёртка над CLI owl-versioning.
Бинарник скачивается из GitHub Releases при сборке Docker-образа
(не компилируется в asana-services).
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
logger = logging.getLogger("owl_versioning_api")

BINARY = os.getenv("MERGE_BINARY", "/usr/local/bin/owl-versioning")
CLI_REPO = os.getenv("OWL_VERSIONING_REPO", "Pwatermelon/owl-ontology-versioning")
CLI_VERSION = os.getenv("OWL_VERSIONING_VERSION", "latest")

app = FastAPI(
    title="OWL Versioning API (catalog wrapper)",
    description="Admin HTTP facade over owl-versioning CLI from GitHub Releases.",
    version="0.3.0",
)


@app.get("/health")
def health():
    ok = Path(BINARY).is_file() and os.access(BINARY, os.X_OK)
    ver = None
    if ok:
        try:
            proc = subprocess.run(
                [BINARY, "version"],
                capture_output=True,
                text=True,
                timeout=5,
                check=False,
            )
            ver = (proc.stdout or proc.stderr or "").strip()[:200] or None
        except Exception:
            ver = None
    return {
        "status": "ok" if ok else "degraded",
        "service": "asana-ontology-merge-api",
        "binary": BINARY,
        "binary_present": ok,
        "cli_repo": CLI_REPO,
        "cli_release": CLI_VERSION,
        "cli_version_output": ver,
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
            detail=(
                f"CLI binary not found: {BINARY}. "
                f"Rebuild image with OWL_VERSIONING_VERSION from "
                f"https://github.com/{CLI_REPO}/releases"
            ),
        ) from exc
    except subprocess.TimeoutExpired as exc:
        raise HTTPException(status_code=504, detail="owl-versioning timeout") from exc

    if proc.returncode != 0:
        err = (proc.stderr or proc.stdout or "owl-versioning failed").strip()
        raise HTTPException(status_code=400, detail=err)

    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Invalid JSON from CLI: {exc}",
        ) from exc


@app.post("/api/admin/ontology-merge/preview")
async def preview_merge(
    base: UploadFile = File(...),
    incoming: UploadFile = File(...),
    user: str = Depends(require_admin),
):
    logger.info(
        "preview by %s base=%s incoming=%s via %s (release=%s)",
        user,
        base.filename,
        incoming.filename,
        BINARY,
        CLI_VERSION,
    )
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
