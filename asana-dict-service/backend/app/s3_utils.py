"""
Утилиты для работы с MINIO S3 хранилищем
"""
import base64
import uuid
from io import BytesIO
from typing import Optional, Tuple
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
        
        # Устанавливаем bucket policy через MinIO Python SDK
        # Используем метод set_bucket_policy, если доступен
        try:
            # Пробуем использовать метод set_bucket_policy из minio
            if hasattr(minio_client, 'set_bucket_policy'):
                minio_client.set_bucket_policy(bucket_name, policy_json)
                logger.info(f"Bucket policy set successfully using set_bucket_policy method")
            else:
                # Альтернативный способ через MinIO Admin API
                import urllib.request
                import base64
                from urllib.error import HTTPError
                
                # Формируем URL для установки bucket policy
                # MinIO S3 API: PUT /{bucket}?policy
                policy_url = f"http://{HOST_MINIO}:{PORT_MINIO}/{bucket_name}?policy"
                
                # Создаем Basic Auth заголовок (для MinIO используется S3 API signature)
                # Но для простоты используем прямую установку через mc команду
                logger.warning("set_bucket_policy method not available, bucket policy should be set manually")
                logger.info("To set bucket policy manually, run: docker exec -it minio mc anonymous set public images")
                return False
        except Exception as policy_error:
            logger.warning(f"Could not set bucket policy automatically: {policy_error}")
            logger.info("To set bucket policy manually, run: docker exec -it minio mc anonymous set public images")
            return False
        
        logger.info(f"Successfully set public read policy for bucket: {bucket_name}")
        return True
        
    except S3Error as e:
        logger.error(f"Error setting bucket policy: {e}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error setting bucket policy: {e}")
        return False


def detect_image_format(image_data: bytes) -> Tuple[str, str]:
    """
    Определяет формат изображения по его сигнатуре (магическим байтам).
    
    Args:
        image_data: Байтовые данные изображения
    
    Returns:
        Кортеж (расширение_файла, content_type)
    """
    if len(image_data) < 4:
        # По умолчанию используем PNG, если данных недостаточно
        return ("png", "image/png")
    
    # PNG: начинается с 89 50 4E 47 (0x89 0x50 0x4E 0x47)
    if image_data[:4] == b'\x89\x50\x4E\x47':
        return ("png", "image/png")
    
    # JPEG: начинается с FF D8 FF
    if image_data[:3] == b'\xFF\xD8\xFF':
        return ("jpg", "image/jpeg")
    
    # GIF: начинается с 47 49 46 38 (GIF8)
    if image_data[:4] == b'\x47\x49\x46\x38':
        return ("gif", "image/gif")
    
    # WebP: начинается с RIFF...WEBP
    if image_data[:4] == b'RIFF' and image_data[8:12] == b'WEBP':
        return ("webp", "image/webp")
    
    # По умолчанию используем PNG
    logger.warning(f"Unknown image format, using PNG as default. First bytes: {image_data[:8].hex()}")
    return ("png", "image/png")


def upload_image_to_s3(image_data: bytes | str, prefix: str = "asans") -> str:
    """
    Загружает изображение в S3 и возвращает путь к файлу.
    
    Args:
        image_data: Изображение в виде bytes или base64 строка (может быть с префиксом data:image/...)
        prefix: Префикс для пути файла (по умолчанию "asans")
    
    Returns:
        Путь к файлу в S3 в формате: {bucket_name}/{prefix}/{uuid}.{extension}
    """
    try:
        minio_client = get_minio_client()
        bucket_name = NAME_BUCKET_IMAGES_MINIO
        
        # Если передан bytes, используем напрямую
        if isinstance(image_data, bytes):
            logger.info(f"[DEBUG S3] Starting upload from bytes. Size: {len(image_data)} bytes")
            image_bytes = image_data
        else:
            # Если передан base64 (для обратной совместимости)
            logger.info(f"[DEBUG S3] Starting upload from base64. Input length: {len(image_data)}, first 100 chars: {image_data[:100]}")
            
            # Извлекаем base64 данные (убираем префикс data:image/... если есть)
            image_base64 = image_data
            if ',' in image_base64:
                image_base64 = image_base64.split(',')[1]
                logger.info(f"[DEBUG S3] Extracted base64 data. Original length: {len(image_data)}, extracted length: {len(image_base64)}")
            
            # Очищаем base64 от пробелов, переносов строк и других недопустимых символов
            image_base64 = image_base64.strip().replace('\n', '').replace('\r', '').replace(' ', '')
            logger.info(f"[DEBUG S3] Cleaned base64 data. Length after cleaning: {len(image_base64)}")
            
            # Проверяем, что base64 не пустой
            if not image_base64:
                raise ValueError("Base64 строка пустая после очистки")
            
            # Декодируем base64 с обработкой ошибок
            logger.info(f"[DEBUG S3] Decoding base64...")
            try:
                image_bytes = base64.b64decode(image_base64, validate=True)
            except Exception as decode_error:
                logger.error(f"[DEBUG S3] Error decoding base64: {decode_error}")
                logger.error(f"[DEBUG S3] Base64 preview (first 200 chars): {image_base64[:200]}")
                raise ValueError(f"Ошибка декодирования base64: {str(decode_error)}")
        
        if len(image_bytes) == 0:
            raise ValueError("Данные изображения пустые")
        
        logger.info(f"[DEBUG S3] Image data size: {len(image_bytes)} bytes")
        logger.info(f"[DEBUG S3] First 20 bytes (hex): {image_bytes[:20].hex()}")
        
        # Определяем формат изображения по его содержимому
        file_extension, content_type = detect_image_format(image_bytes)
        logger.info(f"[DEBUG S3] Detected format: {file_extension}, content-type: {content_type}")
        
        # Генерируем уникальное имя файла с правильным расширением
        object_name = f"{prefix}/{str(uuid.uuid4())}.{file_extension}"
        logger.info(f"[DEBUG S3] Generated object name: {object_name}")
        
        # Создаем bucket если его нет
        if not minio_client.bucket_exists(bucket_name):
            logger.info(f"[DEBUG S3] Creating bucket: {bucket_name}")
            minio_client.make_bucket(bucket_name)
            logger.info(f"Created bucket: {bucket_name}")
        else:
            logger.info(f"[DEBUG S3] Bucket {bucket_name} already exists")
        
        # Загружаем файл с правильным content-type
        logger.info(f"[DEBUG S3] Uploading to MinIO: bucket={bucket_name}, object={object_name}, size={len(image_bytes)}, content-type={content_type}")
        minio_client.put_object(
            bucket_name,
            object_name,
            BytesIO(image_bytes),
            length=len(image_bytes),
            content_type=content_type
        )
        logger.info(f"[DEBUG S3] Successfully uploaded to MinIO")
        
        # Возвращаем путь к файлу в S3 (ТОЛЬКО путь, НИКОГДА base64!)
        s3_path = f"{bucket_name}/{object_name}"
        logger.info(f"[DEBUG S3] Uploaded image to S3: {s3_path} (format: {file_extension}, content-type: {content_type}, size: {len(image_bytes)} bytes)")
        
        # Проверяем формат пути
        if not s3_path.startswith('images/'):
            raise ValueError(f"Invalid S3 path format! Expected 'images/...', got: {s3_path}")
        if '/' not in s3_path:
            raise ValueError(f"Invalid S3 path format! Expected 'bucket/path', got: {s3_path}")
        
        # Проверяем, что файл действительно существует в S3
        try:
            stat = minio_client.stat_object(bucket_name, object_name)
            logger.info(f"[DEBUG S3] Verified file exists in S3: size={stat.size}, content-type={stat.content_type}, last_modified={stat.last_modified}")
        except Exception as verify_error:
            logger.warning(f"[DEBUG S3] Could not verify file in S3: {verify_error}")
        
        # Финальная проверка: убеждаемся что возвращаем путь, а не base64
        if len(s3_path) > 1000:
            raise ValueError(f"S3 path is too long ({len(s3_path)} chars), might be base64 data instead of path!")
        if 'data:' in s3_path or s3_path.startswith('iVBORw0KGgo'):
            raise ValueError(f"S3 path contains base64 data! Path preview: {s3_path[:100]}")
        logger.info(f"[DEBUG S3] Returning S3 path (NOT base64): {s3_path}")
        return s3_path
        
    except S3Error as e:
        logger.error(f"[DEBUG S3] S3Error uploading to S3: {e}", exc_info=True)
        raise
    except Exception as e:
        logger.error(f"[DEBUG S3] Unexpected error uploading to S3: {e}", exc_info=True)
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
    # Убеждаемся, что путь начинается с bucket name
    # s3_path уже содержит bucket name (images/asans/uuid.jpg)
    # Но если путь начинается только с объекта (asans/uuid.jpg), добавляем bucket name
    if not s3_path.startswith(NAME_BUCKET_IMAGES_MINIO + '/'):
        if s3_path.startswith(NAME_BUCKET_IMAGES_MINIO):
            # Уже начинается с bucket name, но без слеша
            s3_path = f"{NAME_BUCKET_IMAGES_MINIO}/{s3_path[len(NAME_BUCKET_IMAGES_MINIO):].lstrip('/')}"
        else:
            # Путь без bucket name, добавляем его
            s3_path = f"{NAME_BUCKET_IMAGES_MINIO}/{s3_path.lstrip('/')}"
    
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

