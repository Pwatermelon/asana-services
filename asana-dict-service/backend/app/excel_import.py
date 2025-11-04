"""
Модуль для импорта данных из Excel файлов
"""
import base64
import json
import logging
from datetime import datetime
from io import BytesIO
from typing import Dict, Any, List, Optional, Tuple

from openpyxl import load_workbook

from app.config import logger, SQLALCHEMY_DATABASE_URL
from app.models import ModerationItem
from app.ontology import load_asana_names, add_asana_name, add_asana, find_existing_source, add_source
from app.s3_utils import upload_image_to_s3
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

def extract_images_from_worksheet(ws) -> Dict[int, str]:
    """
    Извлекает все изображения из листа Excel и возвращает словарь {row_number: base64}.
    Привязывает изображение к строке, в которой оно находится.
    """
    images = {}
    try:
        # Проверяем наличие изображений в листе
        if not hasattr(ws, '_images'):
            logger.debug("Worksheet has no _images attribute")
            return images
            
        if not ws._images:
            logger.debug("No images found in worksheet")
            return images
        
        logger.info(f"Found {len(ws._images)} image objects in worksheet")
        
        for img in ws._images:
            try:
                # Получаем координаты ячейки
                row = None
                
                if hasattr(img, 'anchor') and img.anchor:
                    # openpyxl использует TwoCellAnchor для позиционирования
                    if hasattr(img.anchor, '_from'):
                        if hasattr(img.anchor._from, 'row'):
                            row = img.anchor._from.row + 1  # +1 потому что openpyxl индексирует с 0
                    elif hasattr(img.anchor, 'row'):
                        row = img.anchor.row + 1
                
                if not row:
                    logger.debug(f"Could not determine row for image: {img}")
                    continue
                
                # Получаем данные изображения
                img_data = None
                
                # Попробуем разные способы получения данных
                if hasattr(img, 'ref'):
                    # ref может быть PIL Image объектом
                    if hasattr(img.ref, 'save'):
                        img_bytes = BytesIO()
                        try:
                            img.ref.save(img_bytes, format='PNG')
                            img_bytes.seek(0)
                            img_data = img_bytes.read()
                        except Exception as e:
                            logger.warning(f"Failed to save image to BytesIO: {e}")
                    elif hasattr(img.ref, 'read'):
                        try:
                            img_data = img.ref.read()
                        except Exception as e:
                            logger.warning(f"Failed to read image ref: {e}")
                    elif isinstance(img.ref, bytes):
                        img_data = img.ref
                
                # Если не получилось через ref, пробуем другие способы
                if not img_data:
                    if hasattr(img, '_data') and img._data:
                        img_data = img._data
                    elif hasattr(img, 'image') and img.image:
                        if hasattr(img.image, 'save'):
                            img_bytes = BytesIO()
                            try:
                                img.image.save(img_bytes, format='PNG')
                                img_bytes.seek(0)
                                img_data = img_bytes.read()
                            except Exception as e:
                                logger.warning(f"Failed to save image.image to BytesIO: {e}")
                        elif isinstance(img.image, bytes):
                            img_data = img.image
                
                if not img_data:
                    logger.warning(f"Could not extract image data for row {row}")
                    continue
                
                # Конвертируем в base64
                img_base64 = base64.b64encode(img_data).decode('utf-8')
                
                # Если в строке уже есть изображение, берем последнее
                images[row] = f"data:image/png;base64,{img_base64}"
                logger.debug(f"Extracted image from row {row} (size: {len(img_data)} bytes)")
                
            except Exception as e:
                logger.warning(f"Failed to extract image: {e}", exc_info=True)
                continue
        
        logger.info(f"Successfully extracted {len(images)} images from worksheet")
        
    except Exception as e:
        logger.error(f"Failed to extract images from worksheet: {e}", exc_info=True)
    
    return images


def normalize_column_names(row: Dict[str, Any]) -> Dict[str, Any]:
    """Нормализует имена колонок в строке данных"""
    normalized = {}
    column_mapping = {
        'название': 'name_ru',
        'название асаны': 'name_ru',
        'name_ru': 'name_ru',
        'название асаны (рус)': 'name_ru',
        'название на русском': 'name_ru',
        'санскрит': 'name_sanskrit',
        'name_sanskrit': 'name_sanskrit',
        'название на санскрите': 'name_sanskrit',
        'транслитерация': 'transliteration',
        'transliteration': 'transliteration',
        'определение': 'definition',
        'definition': 'definition',
        'фото': 'photo',
        'photo': 'photo',
        'изображение': 'photo',
        'image': 'photo',
        'название источника': 'source_title',
        'source_title': 'source_title',
        'title': 'source_title',
        'автор': 'source_author',
        'source_author': 'source_author',
        'author': 'source_author',
        'год': 'source_year',
        'source_year': 'source_year',
        'year': 'source_year',
        'издательство': 'source_publisher',
        'source_publisher': 'source_publisher',
        'publisher': 'source_publisher',
        'страницы': 'source_pages',
        'source_pages': 'source_pages',
        'pages': 'source_pages',
        'аннотация': 'source_annotation',
        'source_annotation': 'source_annotation',
        'annotation': 'source_annotation'
    }
    
    for key, value in row.items():
        key_lower = key.lower().strip()
        normalized_key = column_mapping.get(key_lower, key_lower)
        normalized[normalized_key] = value
    
    return normalized


def find_matching_asana_name(name_ru: str, fuzzy_threshold: float = 1.0) -> tuple:
    """
    Ищет существующее название асаны ТОЛЬКО по точному совпадению (100%, без учета регистра).
    Возвращает (ID найденного названия, None) если найдено точное совпадение,
    или (None, None) если не найдено точного совпадения.
    """
    try:
        existing_names = load_asana_names()
        if not existing_names:
            logger.warning("No existing asana names found in ontology")
            return None, None
        
        name_ru_lower = name_ru.lower().strip()
        
        # Проверяем ТОЛЬКО точное совпадение (100%, без учета регистра)
        for name_data in existing_names:
            existing_name_lower = name_data.get("name_ru", "").lower().strip()
            if existing_name_lower == name_ru_lower:
                logger.info(f"Found exact match (100%, case-insensitive) for '{name_ru}' -> '{name_data.get('name_ru')}'")
                return name_data["id"], None
        
        # Если точного совпадения нет, возвращаем None (не ищем похожие)
        logger.info(f"No exact match (100%) found for '{name_ru}'")
        return None, None
            
    except Exception as e:
        logger.error(f"Error finding matching asana name: {e}")
        return None, None


def has_source_data(row: Dict[str, Any]) -> bool:
    """Проверяет, есть ли в строке данные для источника"""
    source_fields = ['source_title', 'source_author', 'source_year', 
                     'source_publisher', 'source_pages', 'source_annotation']
    return any(row.get(field) for field in source_fields)


def parse_excel_file(file_path: str) -> List[Dict[str, Any]]:
    """Парсит Excel файл и возвращает список словарей с данными"""
    try:
        # НЕ используем data_only=True, так как это может помешать загрузке изображений
        wb = load_workbook(file_path, data_only=False)
        ws = wb.active
        
        # Извлекаем все изображения из листа
        images = extract_images_from_worksheet(ws)
        logger.info(f"Extracted {len(images)} images before parsing rows")
        
        # Определяем заголовки (первая строка)
        headers = []
        for cell in ws[1]:
            headers.append(cell.value.lower().strip() if cell.value else '')
        
        # Парсим данные
        rows = []
        for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=False), start=2):
            row_data = {}
            for col_idx, cell in enumerate(row):
                header = headers[col_idx] if col_idx < len(headers) else f'column_{col_idx}'
                
                if cell.value is not None:
                    row_data[header] = cell.value
            
            # Проверяем наличие изображения в этой строке (по номеру строки)
            if row_idx in images:
                row_data['photo'] = images[row_idx]
                logger.debug(f"Found image in row {row_idx}")
            
            # Пропускаем пустые строки
            if any(row_data.values()):
                rows.append(row_data)
        
        return rows
    except Exception as e:
        logger.error(f"Error parsing Excel file: {e}")
        raise


def get_db_session():
    """Создает и возвращает сессию базы данных"""
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return SessionLocal()


def save_moderation_item(
    asana_name: str,
    source_id: Optional[str],
    error_message: str,
    row_number: int,
    import_data: Optional[Dict[str, Any]] = None,
    user: Optional[str] = None,
    moderation_type: str = "error",
    suggested_name_ru: Optional[str] = None,
    suggested_name_sanskrit: Optional[str] = None,
    suggested_transliteration: Optional[str] = None,
    suggested_definition: Optional[str] = None,
    existing_name_id: Optional[str] = None,
    existing_name_ru: Optional[str] = None
):
    """Сохраняет запись в таблицу модерации"""
    try:
        db = get_db_session()
        moderation_item = ModerationItem(
            asana_name=asana_name,
            source_id=source_id,
            error_message=error_message,
            row_number=row_number,
            import_data=json.dumps(import_data, ensure_ascii=False) if import_data else None,
            created_at=datetime.now().isoformat(),
            resolved=False,
            moderation_type=moderation_type,
            suggested_name_ru=suggested_name_ru,
            suggested_name_sanskrit=suggested_name_sanskrit,
            suggested_transliteration=suggested_transliteration,
            suggested_definition=suggested_definition,
            existing_name_id=existing_name_id,
            existing_name_ru=existing_name_ru
        )
        db.add(moderation_item)
        db.commit()
        db.close()
        logger.info(f"Saved moderation item for row {row_number}: {asana_name} (type: {moderation_type})")
    except Exception as e:
        logger.error(f"Failed to save moderation item: {e}")


def import_asanas_from_excel(file_path: str, source_id: str, user: Optional[str] = None) -> Dict[str, Any]:
    """
    Импортирует асаны из Excel файла с привязкой к существующему источнику.
    Ожидает колонку с названием асаны на русском языке.
    Система автоматически найдет существующее название (только точное совпадение, без учета регистра)
    или создаст новое, если не найдено.
    Если найдено похожее название - отправляется в модерацию.
    Также поддерживается колонка с фото (опционально).
    """
    rows = parse_excel_file(file_path)
    imported = 0
    errors = []
    
    for idx, row in enumerate(rows, start=2):
        try:
            normalized = normalize_column_names(row)
            
            if not normalized.get('name_ru'):
                error_msg = f"Строка {idx}: отсутствует название асаны"
                errors.append(error_msg)
                save_moderation_item(
                    asana_name="",
                    source_id=source_id,
                    error_message=error_msg,
                    row_number=idx,
                    import_data=normalized,
                    user=user
                )
                continue
            
            name_ru = str(normalized['name_ru']).strip()
            if not name_ru:
                error_msg = f"Строка {idx}: пустое название асаны"
                errors.append(error_msg)
                save_moderation_item(
                    asana_name="",
                    source_id=source_id,
                    error_message=error_msg,
                    row_number=idx,
                    import_data=normalized,
                    user=user
                )
                continue
            
            # Ищем существующее название асаны (только точное совпадение 100%, без учета регистра)
            name_id, _ = find_matching_asana_name(name_ru, fuzzy_threshold=1.0)
            
            if name_id:
                # Найдено точное совпадение (100%) - используем его
                logger.info(f"Строка {idx}: найдено точное совпадение (100%) для '{name_ru}'")
            else:
                # Если не найдено точное совпадение, отправляем в модерацию
                error_msg = f"Строка {idx}: название '{name_ru}' не найдено в существующих (требуется 100% совпадение)"
                errors.append(error_msg)
                save_moderation_item(
                    asana_name=name_ru,
                    source_id=source_id,
                    error_message=error_msg,
                    row_number=idx,
                    import_data=normalized,
                    user=user,
                    moderation_type="name_mismatch",
                    suggested_name_ru=normalized.get('name_ru')
                )
                continue  # Пропускаем эту строку
            
            # Обрабатываем фото и загружаем в S3
            photo_s3_path = None
            photo_base64 = normalized.get('photo')
            if photo_base64:
                try:
                    # Преобразуем в base64 если нужно
                    if isinstance(photo_base64, bytes):
                        photo_base64 = base64.b64encode(photo_base64).decode('utf-8')
                    if not photo_base64.startswith('data:'):
                        photo_base64 = f"data:image/png;base64,{photo_base64}"
                    
                    # Загружаем в S3
                    photo_s3_path = upload_image_to_s3(photo_base64, prefix="asans")
                except Exception as e:
                    error_msg = f"Строка {idx}: ошибка загрузки фото в S3: {str(e)}"
                    logger.warning(error_msg)
                    save_moderation_item(
                        asana_name=name_ru,
                        source_id=source_id,
                        error_message=error_msg,
                        row_number=idx,
                        import_data=normalized,
                        user=user
                    )
                    # Продолжаем без фото
                    photo_s3_path = None
            
            # Добавляем асану с путем к фото в S3
            add_asana(name_id, source_id, photo_s3_path or "")
            imported += 1
            logger.info(f"Imported asana: {name_ru}")
            
        except Exception as e:
            error_msg = f"Строка {idx}: {str(e)}"
            errors.append(error_msg)
            logger.error(error_msg)
            # Сохраняем в модерацию
            try:
                asana_name = normalized.get('name_ru', '') if 'normalized' in locals() else ''
                save_moderation_item(
                    asana_name=str(asana_name),
                    source_id=source_id,
                    error_message=error_msg,
                    row_number=idx,
                    import_data=normalized if 'normalized' in locals() else None,
                    user=user
                )
            except Exception as save_error:
                logger.error(f"Failed to save moderation item: {save_error}")
    
    return {
        "imported": imported,
        "errors": errors
    }


def import_full_from_excel(file_path: str, user: Optional[str] = None) -> Dict[str, Any]:
    """
    Импортирует асаны и источники из Excel файла.
    Если в строке есть данные источника, создается новый источник.
    Иначе асана привязывается к последнему созданному источнику.
    """
    rows = parse_excel_file(file_path)
    imported_asanas = 0
    imported_sources = 0
    errors = []
    current_source_id = None
    
    # Кеш для уже проверенных источников (чтобы не загружать граф каждый раз)
    source_cache = {}  # {tuple(title, author, year): source_id}
    
    for idx, row in enumerate(rows, start=2):
        try:
            normalized = normalize_column_names(row)
            
            # Проверяем, нужно ли создать новый источник
            if has_source_data(normalized):
                source_data = {
                    "title": normalized.get('source_title', 'Неизвестный источник'),
                    "author": normalized.get('source_author', ''),
                    "year": int(normalized.get('source_year', 0)) if normalized.get('source_year') else 0,
                }
                
                if normalized.get('source_publisher'):
                    source_data["publisher"] = normalized['source_publisher']
                if normalized.get('source_pages'):
                    source_data["pages"] = int(normalized['source_pages'])
                if normalized.get('source_annotation'):
                    source_data["annotation"] = normalized['source_annotation']
                
                # Проверяем кеш
                cache_key = (
                    source_data.get('title', '').strip().lower(),
                    source_data.get('author', '').strip().lower(),
                    source_data.get('year', 0)
                )
                
                if cache_key in source_cache:
                    # Используем из кеша
                    current_source_id = source_cache[cache_key]
                    logger.debug(f"Using cached source: '{source_data['title']}' (ID: {current_source_id})")
                else:
                    # Проверяем, существует ли уже такой источник
                    existing_source_id = find_existing_source(source_data)
                    
                    if existing_source_id:
                        # Используем существующий источник
                        current_source_id = existing_source_id
                        source_cache[cache_key] = current_source_id  # Сохраняем в кеш
                        logger.info(f"Using existing source: '{source_data['title']}' (ID: {current_source_id})")
                    else:
                        # Создаем новый источник
                        current_source_id = add_source(source_data, check_existing=False)
                        source_cache[cache_key] = current_source_id  # Сохраняем в кеш
                        imported_sources += 1
                        logger.info(f"Created new source: '{source_data['title']}' (ID: {current_source_id})")
            
            # Если нет текущего источника, пропускаем
            if not current_source_id:
                errors.append(f"Строка {idx}: нет источника для асаны")
                continue
            
            # Проверяем обязательное поле для асаны
            name_ru = normalized.get('name_ru')
            if not name_ru:
                continue  # Пропускаем строки без названия асаны
            
            name_ru = str(name_ru).strip()
            if not name_ru:
                continue
            
            # Ищем существующее название асаны (только точное совпадение 100%, без учета регистра)
            name_id, _ = find_matching_asana_name(name_ru, fuzzy_threshold=1.0)
            
            if name_id:
                # Найдено точное совпадение (100%) - используем его
                logger.info(f"Строка {idx}: найдено точное совпадение (100%) для '{name_ru}'")
            else:
                # Если не найдено точное совпадение, отправляем в модерацию
                error_msg = f"Строка {idx}: название '{name_ru}' не найдено в существующих (требуется 100% совпадение)"
                errors.append(error_msg)
                save_moderation_item(
                    asana_name=name_ru,
                    source_id=current_source_id,
                    error_message=error_msg,
                    row_number=idx,
                    import_data=normalized,
                    user=user,
                    moderation_type="name_mismatch",
                    suggested_name_ru=normalized.get('name_ru')
                )
                continue  # Пропускаем эту строку
            
            # Обрабатываем фото и загружаем в S3
            photo_s3_path = None
            photo_base64 = normalized.get('photo')
            if photo_base64:
                try:
                    # Преобразуем в base64 если нужно
                    if isinstance(photo_base64, bytes):
                        photo_base64 = base64.b64encode(photo_base64).decode('utf-8')
                    if not photo_base64.startswith('data:'):
                        photo_base64 = f"data:image/png;base64,{photo_base64}"
                    
                    # Загружаем в S3
                    photo_s3_path = upload_image_to_s3(photo_base64, prefix="asans")
                except Exception as e:
                    error_msg = f"Строка {idx}: ошибка загрузки фото в S3: {str(e)}"
                    logger.warning(error_msg)
                    save_moderation_item(
                        asana_name=name_ru,
                        source_id=current_source_id,
                        error_message=error_msg,
                        row_number=idx,
                        import_data=normalized,
                        user=user
                    )
                    photo_s3_path = None
            
            # Добавляем асану к текущему источнику с путем к фото в S3
            add_asana(name_id, current_source_id, photo_s3_path or "")
            imported_asanas += 1
            logger.info(f"Imported asana: {name_ru}")
            
        except Exception as e:
            error_msg = f"Строка {idx}: {str(e)}"
            errors.append(error_msg)
            logger.error(error_msg)
            # Сохраняем в модерацию
            try:
                asana_name = normalized.get('name_ru', '') if 'normalized' in locals() else ''
                save_moderation_item(
                    asana_name=str(asana_name),
                    source_id=current_source_id,
                    error_message=error_msg,
                    row_number=idx,
                    import_data=normalized if 'normalized' in locals() else None,
                    user=user
                )
            except Exception as save_error:
                logger.error(f"Failed to save moderation item: {save_error}")
    
    return {
        "imported_asanas": imported_asanas,
        "imported_sources": imported_sources,
        "errors": errors
    }


def import_asana_names_from_excel(file_path: str, user: Optional[str] = None) -> Dict[str, Any]:
    """
    Импортирует названия асан из Excel файла.
    Ожидает колонки: название (name_ru), санскрит (name_sanskrit),
    транслитерация (transliteration), определение (definition).
    Если название уже существует (точное совпадение), пропускает его.
    Если найдено похожее - отправляет в модерацию.
    """
    rows = parse_excel_file(file_path)
    imported = 0
    skipped = 0
    errors = []
    
    for idx, row in enumerate(rows, start=2):
        try:
            normalized = normalize_column_names(row)
            
            if not normalized.get('name_ru'):
                error_msg = f"Строка {idx}: отсутствует название асаны"
                errors.append(error_msg)
                continue
            
            name_ru = str(normalized['name_ru']).strip()
            if not name_ru:
                error_msg = f"Строка {idx}: пустое название асаны"
                errors.append(error_msg)
                continue
            
            # Проверяем, существует ли уже такое название (только точное совпадение 100%)
            existing_name_id, _ = find_matching_asana_name(name_ru, fuzzy_threshold=1.0)
            
            if existing_name_id:
                logger.info(f"Строка {idx}: название '{name_ru}' уже существует (100% совпадение), пропускаем")
                skipped += 1
                continue
            
            # Создаем новое название асаны
            name_data = {"name_ru": name_ru}
            
            if normalized.get('name_sanskrit'):
                name_data["name_sanskrit"] = str(normalized['name_sanskrit']).strip()
            if normalized.get('transliteration'):
                name_data["transliteration"] = str(normalized['transliteration']).strip()
            if normalized.get('definition'):
                name_data["definition"] = str(normalized['definition']).strip()
            
            add_asana_name(name_data)
            imported += 1
            logger.info(f"Imported asana name: {name_ru}")
            
        except Exception as e:
            error_msg = f"Строка {idx}: {str(e)}"
            errors.append(error_msg)
            logger.error(error_msg)
    
    return {
        "imported": imported,
        "skipped": skipped,
        "errors": errors
    }

