"""
Эндпоинты импорта/экспорта — отдельный микросервис (import_service).
"""
from __future__ import annotations

import json
import logging
import os
import tempfile
import uuid
from datetime import datetime
from typing import Optional

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Path,
    Query,
    UploadFile,
)
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import desc

from app import config
from app.auth import is_admin, is_expert_or_admin
from app.excel_import import (
    export_asana_names_to_excel,
    export_moderation_to_excel,
    import_asana_names_from_excel,
    scan_sources_from_excel,
)
from app.catalog_sync import acquire_owl_write_lease, release_owl_write_lease_and_resync
from app.models import ModerationItem
from import_service.runners import run_import_asanas_task, run_import_full_task
from import_service.task_storage import (
    OWL_WRITE_BUSY_DETAIL,
    release_owl_write_lock,
    task_get,
    task_set,
    try_acquire_owl_write_lock,
)

logger = logging.getLogger("asana_service.import_routes")

router = APIRouter()


def _session():
    from app.main import SessionLocal

    return SessionLocal()


@router.get("/api/export/asana-names")
async def export_asana_names_xlsx(user: str = Depends(is_expert_or_admin)):
    buffer = export_asana_names_to_excel()
    filename = f"asana_names_{datetime.utcnow().strftime('%Y%m%d_%H%M')}.xlsx"
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/api/download-ontology")
async def download_ontology(user: str = Depends(is_admin)):
    logger.info("Downloading ontology file by user: %s", user)
    if not os.path.exists(config.OWL_FILE_PATH):
        raise HTTPException(status_code=404, detail="Файл онтологии не найден")
    return FileResponse(
        path=config.OWL_FILE_PATH,
        filename="asana_ontology.owl",
        media_type="application/rdf+xml",
    )


@router.post("/api/upload-ontology")
async def upload_ontology(ontology_file: UploadFile = File(...), user: str = Depends(is_admin)):
    logger.info("Uploading ontology file by user: %s", user)
    db_lease = _session()
    try:
        acquire_owl_write_lease(db_lease)
    finally:
        db_lease.close()
    lock_holder = f"upload-owl:{uuid.uuid4()}"
    if not try_acquire_owl_write_lock(lock_holder):
        release_owl_write_lease_and_resync()
        raise HTTPException(status_code=409, detail=OWL_WRITE_BUSY_DETAIL)
    try:
        content = await ontology_file.read()
        with open(config.OWL_FILE_PATH, "wb") as f:
            f.write(content)
        return {"message": "Ontology file uploaded successfully"}
    except Exception as e:
        logger.error("Error uploading ontology: %s", e)
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        release_owl_write_lock(lock_holder)
        release_owl_write_lease_and_resync()


@router.post("/api/import/asanas")
async def import_asanas(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    source_id: str = Form(...),
    user: str = Depends(is_expert_or_admin),
):
    logger.info("Starting async import of asanas by user: %s", user)
    try:
        # Парсинг в staging без блокировки OWL; запись в онтологию — в воркере (очередь по Redis lock)
        with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name

        task_id = str(uuid.uuid4())
        task_set(
            task_id,
            {"status": "pending", "progress": 0, "type": "asanas", "user": user},
        )

        background_tasks.add_task(run_import_asanas_task, task_id, tmp_path, source_id, user)

        return {
            "task_id": task_id,
            "message": "Импорт запущен в фоновом режиме",
            "status_url": f"/api/import/status/{task_id}",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error starting import task: %s", e, exc_info=True)
        raise HTTPException(status_code=400, detail=f"Ошибка при запуске импорта: {str(e)}")


@router.post("/api/import/full/scan")
async def scan_full_import(file: UploadFile = File(...), user: str = Depends(is_expert_or_admin)):
    logger.info("Scanning full import file by user: %s", user)
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name

        sources = scan_sources_from_excel(tmp_path)
        return {"sources": sources}
    except Exception as e:
        logger.error("Error scanning import file: %s", e, exc_info=True)
        raise HTTPException(status_code=400, detail=f"Ошибка при сканировании файла: {str(e)}")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)


@router.post("/api/import/full")
async def import_full(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    source_mapping: Optional[str] = Form(None),
    user: str = Depends(is_expert_or_admin),
):
    logger.info("Starting async full import by user: %s", user)
    try:
        mapping = None
        if source_mapping:
            try:
                mapping = json.loads(source_mapping)
            except Exception:
                logger.warning("Failed to parse source_mapping: %s", source_mapping)

        with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name

        task_id = str(uuid.uuid4())
        task_set(
            task_id,
            {"status": "pending", "progress": 0, "type": "full", "user": user},
        )

        background_tasks.add_task(run_import_full_task, task_id, tmp_path, user, mapping)

        return {
            "task_id": task_id,
            "message": "Импорт запущен в фоновом режиме",
            "status_url": f"/api/import/status/{task_id}",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error starting full import: %s", e, exc_info=True)
        raise HTTPException(status_code=400, detail=f"Ошибка при запуске импорта: {str(e)}")


@router.get("/api/import/status/{task_id}")
async def get_import_status(task_id: str = Path(...), user: str = Depends(is_expert_or_admin)):
    task = task_get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Задача не найдена")

    if task.get("user") != user:
        raise HTTPException(status_code=403, detail="Доступ запрещен")

    response = {"status": task.get("status", "unknown"), "progress": task.get("progress", 0)}
    if task.get("batch_id") is not None:
        response["batch_id"] = task["batch_id"]

    if task.get("status") == "completed":
        response["result"] = task.get("result", {})
    elif task.get("status") == "error":
        response["error"] = task.get("error", "Неизвестная ошибка")

    return response


@router.post("/api/import/asana-names")
async def import_asana_names(file: UploadFile = File(...), user: str = Depends(is_expert_or_admin)):
    logger.info("Importing asana names from Excel by user: %s", user)
    db_lease = _session()
    try:
        acquire_owl_write_lease(db_lease)
    finally:
        db_lease.close()
    lock_holder = f"asana-names:{uuid.uuid4()}"
    if not try_acquire_owl_write_lock(lock_holder):
        release_owl_write_lease_and_resync()
        raise HTTPException(status_code=409, detail=OWL_WRITE_BUSY_DETAIL)
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name

        try:
            result = import_asana_names_from_excel(tmp_path, user=user)
            error_count = len(result.get("errors", []))
            return {
                "message": f"Успешно импортировано {result['imported']} названий, пропущено {result['skipped']}"
                + (f", {error_count} ошибок" if error_count > 0 else ""),
                "imported": result["imported"],
                "skipped": result["skipped"],
                "skipped_items": result.get("skipped_items", []),
                "errors_count": error_count,
                "errors": result.get("errors", []),
            }
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error importing asana names: %s", e)
        raise HTTPException(status_code=400, detail=f"Ошибка при импорте названий асан: {str(e)}")
    finally:
        release_owl_write_lock(lock_holder)
        release_owl_write_lease_and_resync()


@router.get("/api/moderation/items/export")
async def export_moderation_items(
    _resolved: Optional[bool] = Query(None),
    user: str = Depends(is_expert_or_admin),
):
    db = _session()
    try:
        query = db.query(ModerationItem).filter(ModerationItem.resolved == False)
        items = query.order_by(desc(ModerationItem.created_at)).all()

        items_list = []
        for item in items:
            import_data = None
            if item.import_data:
                try:
                    import_data = json.loads(item.import_data)
                except Exception:
                    pass

            items_list.append(
                {
                    "id": item.id,
                    "asana_name": item.asana_name,
                    "source_id": item.source_id,
                    "error_message": item.error_message,
                    "row_number": item.row_number,
                    "import_data": import_data,
                    "created_at": item.created_at,
                    "resolved": item.resolved,
                    "resolved_by": item.resolved_by,
                    "resolved_at": item.resolved_at,
                    "moderation_type": item.moderation_type,
                    "object_type": item.object_type,
                    "suggested_name_ru": item.suggested_name_ru,
                    "suggested_name_sanskrit": item.suggested_name_sanskrit,
                    "suggested_transliteration": item.suggested_transliteration,
                    "suggested_definition": item.suggested_definition,
                    "existing_name_id": item.existing_name_id,
                    "existing_name_ru": item.existing_name_ru,
                }
            )

        excel_stream = export_moderation_to_excel(items_list)
        filename = f"moderation_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"

        return StreamingResponse(
            excel_stream,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    finally:
        db.close()
