"""
Утилиты для работы с MINIO S3 хранилищем
"""
import base64
import uuid
from io import BytesIO
from typing import Optional
from minio import Minio
from minio.error import S3Error

from app.config import (
    HOST_MINIO, PORT_MINIO, USER_MINIO, PASSWORD_MINIO,
    NAME_BUCKET_IMAGES_MINIO, MINIO_URL_PREFIX, logger
)


def get_minio_client() -> Minio:
    """Создает и возвращает клиент MINIO"""
    return Minio(
        f"{HOST_MINIO}:{PORT_MINIO}",
        access_key=USER_MINIO,
        secret_key=PASSWORD_MINIO,
        secure=False
    )


def setup_minio_bucket_policy():
    """
    Настраивает bucket policy для публичного чтения файлов в bucket images.
    Вызывается при старте приложения.
    """
    try:
        minio_client = get_minio_client()
        bucket_name = NAME_BUCKET_IMAGES_MINIO
        
        # Проверяем, существует ли bucket
        if not minio_client.bucket_exists(bucket_name):
            minio_client.make_bucket(bucket_name)
            logger.info(f"Created bucket: {bucket_name}")
        
        # Создаем bucket policy для публичного чтения
        # Это позволяет всем пользователям читать файлы из bucket без авторизации
        bucket_policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {"AWS": "*"},
                    "Action": ["s3:GetObject"],
                    "Resource": [f"arn:aws:s3:::{bucket_name}/*"]
                }
            ]
        }
        
        import json
        policy_json = json.dumps(bucket_policy)
        
        # Устанавливаем bucket policy через MinIO API
        # Используем PUT запрос к MinIO API для установки bucket policy
        import urllib.request
        import base64
        from urllib.error import HTTPError
        
        # Формируем URL для установки bucket policy
        # MinIO API: PUT /{bucket}?policy - устанавливает bucket policy
        policy_url = f"http://{HOST_MINIO}:{PORT_MINIO}/{bucket_name}?policy"
        
        # Создаем Basic Auth заголовок
        credentials = f"{USER_MINIO}:{PASSWORD_MINIO}"
        auth_string = base64.b64encode(credentials.encode()).decode()
        
        # Создаем запрос
        req = urllib.request.Request(
            policy_url,
            data=policy_json.encode('utf-8'),
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Basic {auth_string}'
            },
            method='PUT'
        )
        
        try:
            response = urllib.request.urlopen(req)
            logger.info(f"Bucket policy set successfully for {bucket_name} (status: {response.status})")
        except HTTPError as e:
            if e.code == 200 or e.code == 204:
                logger.info(f"Bucket policy set successfully for {bucket_name}")
            else:
                logger.warning(f"Failed to set bucket policy via API: {e.code} {e.reason}")
                raise
        
        logger.info(f"Successfully set public read policy for bucket: {bucket_name}")
        return True
        
    except S3Error as e:
        logger.error(f"Error setting bucket policy: {e}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error setting bucket policy: {e}")
        return False


def upload_image_to_s3(image_base64: str, prefix: str = "asans") -> str:
    """
    Загружает изображение в S3 и возвращает путь к файлу.
    
    Args:
        image_base64: Изображение в формате base64 (может быть с префиксом data:image/...)
        prefix: Префикс для пути файла (по умолчанию "asans")
    
    Returns:
        Путь к файлу в S3 в формате: {bucket_name}/{prefix}/{uuid}.jpg
    """
    try:
        minio_client = get_minio_client()
        bucket_name = NAME_BUCKET_IMAGES_MINIO
        
        # Извлекаем base64 данные (убираем префикс data:image/... если есть)
        if ',' in image_base64:
            image_base64 = image_base64.split(',')[1]
        
        # Декодируем base64
        image_data = base64.b64decode(image_base64)
        
        # Генерируем уникальное имя файла
        file_extension = "jpg"  # Можно определить по содержимому, но для простоты используем jpg
        object_name = f"{prefix}/{str(uuid.uuid4())}.{file_extension}"
        
        # Создаем bucket если его нет
        if not minio_client.bucket_exists(bucket_name):
            minio_client.make_bucket(bucket_name)
            logger.info(f"Created bucket: {bucket_name}")
        
        # Загружаем файл
        minio_client.put_object(
            bucket_name,
            object_name,
            BytesIO(image_data),
            length=len(image_data),
            content_type='image/jpeg'
        )
        
        # Возвращаем путь к файлу в S3
        s3_path = f"{bucket_name}/{object_name}"
        logger.info(f"Uploaded image to S3: {s3_path}")
        return s3_path
        
    except S3Error as e:
        logger.error(f"Error uploading to S3: {e}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error uploading to S3: {e}")
        raise


def get_s3_url(s3_path: str) -> str:
    """
    Возвращает URL для доступа к файлу в S3 через Nginx прокси.
    Используем обычный URL (требуется публичный доступ к bucket или bucket policy).
    
    Args:
        s3_path: Путь к файлу в формате bucket/path/to/file (например: images/asans/uuid.jpg)
    
    Returns:
        URL для доступа к файлу через Nginx прокси
    """
    # Проверяем, что путь начинается с bucket name
    if not s3_path.startswith(NAME_BUCKET_IMAGES_MINIO):
        s3_path = f"{NAME_BUCKET_IMAGES_MINIO}/{s3_path}"
    
    # MINIO_URL_PREFIX = http://localhost/images
    # s3_path = images/asans/uuid.jpg
    # Результат: http://localhost/images/images/asans/uuid.jpg
    # Nginx location /images/ проксирует к minio:9000/
    # Когда запрашиваем http://localhost/images/images/asans/uuid.jpg
    # Nginx заменяет /images/ на пустую строку и отправляет на minio:9000/images/asans/uuid.jpg
    # MinIO получает запрос на /images/asans/uuid.jpg (bucket=images, object=asans/uuid.jpg)
    # Для работы требуется настроить bucket policy на публичный доступ для GET запросов
    url = f"{MINIO_URL_PREFIX}/{s3_path}"
    logger.debug(f"Generated S3 URL for {s3_path}: {url}")
    return url

