import os
import uuid
from io import BytesIO

from fastapi import HTTPException, UploadFile
from minio import Minio
from minio.error import S3Error
from starlette import status

from config import get_settings

settings = get_settings()

_ALLOWED_CONTENT_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
_MAX_SIZE_BYTES = 5 * 1024 * 1024


def _minio_client() -> Minio:
    return Minio(
        f"{settings.HOST_MINIO}:{settings.PORT_MINIO}",
        access_key=settings.USER_MINIO,
        secret_key=settings.PASSWORD_MINIO,
        secure=False,
    )


def _build_public_url(object_path: str) -> str:
    prefix = (settings.MINIO_URL_PREFIX or "").rstrip("/")
    if not prefix:
        prefix = "http://localhost/images"
    return f"{prefix}/{settings.NAME_BUCKET_IMAGES_MINIO}/{object_path}"


def _object_name_from_url(avatar_url: str | None) -> str | None:
    if not avatar_url:
        return None
    needle = f"/{settings.NAME_BUCKET_IMAGES_MINIO}/"
    idx = avatar_url.find(needle)
    if idx == -1:
        return None
    return avatar_url[idx + len(needle):].lstrip("/")


async def upload_avatar(file: UploadFile, login: str) -> str:
    if not file.content_type or file.content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Допустимы только изображения jpg/png/webp/gif",
        )

    data = await file.read()
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Файл пустой")
    if len(data) > _MAX_SIZE_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Размер файла не должен превышать 5MB")

    ext = _ALLOWED_CONTENT_TYPES[file.content_type]
    safe_login = "".join(ch if ch.isalnum() or ch in {"_", "-"} else "_" for ch in (login or "user"))
    object_name = f"avatars/{safe_login}/{uuid.uuid4().hex}{ext}"

    client = _minio_client()
    bucket = settings.NAME_BUCKET_IMAGES_MINIO
    try:
        if not client.bucket_exists(bucket):
            client.make_bucket(bucket)
        client.put_object(
            bucket,
            object_name,
            BytesIO(data),
            length=len(data),
            content_type=file.content_type,
        )
    except S3Error as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Не удалось загрузить аватар: {exc}",
        ) from exc

    return _build_public_url(object_name)


def delete_avatar(avatar_url: str | None) -> None:
    object_name = _object_name_from_url(avatar_url)
    if not object_name:
        return
    client = _minio_client()
    try:
        client.remove_object(settings.NAME_BUCKET_IMAGES_MINIO, object_name)
    except Exception:
        return
