from rdflib import Graph, Namespace, URIRef, Literal, RDF
from app import config
from app.s3_utils import get_s3_url
from typing import Optional, Dict, Any, List
import uuid
import logging
from datetime import datetime, timezone
import os
import base64

logger = logging.getLogger("asana_service.ontology")


def rdf_property_value_str(val: Any) -> str:
    """Значение из RDF graph.value (Literal) — стабильная строка для сравнения путей/хешей."""
    if val is None:
        return ""
    try:
        if hasattr(val, "toPython"):
            py = val.toPython()
            return "" if py is None else str(py).strip()
    except Exception:
        pass
    return str(val).strip()


def norm_s3_path(p: Any) -> str:
    if p is None:
        return ""
    return str(p).strip().replace("\\", "/")


def norm_image_hash_hex(h: Any) -> str:
    if h is None:
        return ""
    return str(h).strip().lower()

ASANA = Namespace("http://www.semanticweb.org/platinum_watermelon/ontologies/Asana#")
# Добавляем новое свойство для S3 пути к фото
ASANA.s3PhotoPath = URIRef(f"{ASANA}s3PhotoPath")
# Добавляем свойство для хеша изображения (для сравнения дубликатов)
ASANA.photoHash = URIRef(f"{ASANA}photoHash")
# Определяем base64Photo явно, чтобы контролировать его использование (только для чтения старых данных)
ASANA.base64Photo = URIRef(f"{ASANA}base64Photo")
# Свойство для указания идентичных/аналогичных асан
ASANA.isSameAsObject = URIRef(f"{ASANA}isSameAsObject")
# Свойство «определение» в OWL (имя из Protégé)
ASANA_DEFINITION = ASANA.OWLDataProperty_c8100b71_09ff_49ec_8fbf_63fa1be3947a
# Дата создания записи названия (ISO 8601), для сортировки в каталоге
ASANA.nameCreatedAt = URIRef(f"{ASANA}nameCreatedAt")


def _persist_ontology_graph(g: Graph) -> None:
    """DB-first: зеркало PostgreSQL + экспорт в OWL."""
    from app.catalog_ontology import persist_ontology_graph

    persist_ontology_graph(g)


def ensure_ontology_file_exists():
    """Создает файл онтологии, если он не существует"""
    try:
        if not os.path.exists(config.OWL_FILE_PATH):
            logger.info(f"Creating new ontology file at {config.OWL_FILE_PATH}")
            # Создаем базовый граф с основными классами
            g = Graph()
            g.bind("asana", ASANA)
            
            # Добавляем основные классы
            g.add((ASANA.Asana, RDF.type, RDF.Class))
            g.add((ASANA.AsanaName, RDF.type, RDF.Class))
            g.add((ASANA.AsanaSource, RDF.type, RDF.Class))
            g.add((ASANA.AsanaPhoto, RDF.type, RDF.Class))
            
            # Создаем директорию, если её нет
            os.makedirs(os.path.dirname(config.OWL_FILE_PATH), exist_ok=True)

            _persist_ontology_graph(g)
            logger.info("Successfully created new ontology file")
        return True
    except Exception as e:
        logger.error(f"Error ensuring ontology file exists: {str(e)}")
        raise


def get_graph():
    """
    DB-first: если в БД есть зеркало catalog_mirror_items — граф собирается из него.
    Иначе — загрузка из ontology_updated.owl и первичное заполнение зеркала.
    """
    try:
        from app.main import SessionLocal
        from app.models import CatalogMirrorItem
        from app.catalog_ontology import build_graph_from_mirror, snapshot_graph_to_mirror

        session = SessionLocal()
        try:
            n = session.query(CatalogMirrorItem).count()
            if n > 0:
                logger.info("Loading RDF graph from PostgreSQL mirror (DB-first)")
                g = build_graph_from_mirror(session)
                logger.debug("Loaded graph with %s triples from mirror", len(g))
                return g
        finally:
            session.close()

        ensure_ontology_file_exists()
        logger.info(f"Loading RDF graph from {config.OWL_FILE_PATH} (bootstrap mirror)")
        g = Graph()
        g.parse(config.OWL_FILE_PATH, format="xml")
        session = SessionLocal()
        try:
            snapshot_graph_to_mirror(session, g)
            session.commit()
            logger.info("Bootstrap: зеркало каталога заполнено из OWL-файла")
        finally:
            session.close()
        return g
    except Exception as e:
        logger.error(f"Failed to load RDF graph: {str(e)}")
        raise

def load_asanas_from_graph(g: Graph):
    """Сериализуемый снимок асан для зеркала БД (включая URI названия и s3_path фото)."""
    logger.info("Starting to load asanas from graph")
    asanas = []
    all_asanas = list(g.subjects(RDF.type, ASANA.Asana))
    logger.info(f"Found {len(all_asanas)} asanas in graph")
    for asana in all_asanas:
        logger.debug(f"Processing asana: {asana}")
        name_obj = g.value(asana, ASANA.hasName)
        photo_objs = list(g.objects(asana, ASANA.hasPhoto))
        logger.debug(f"Name object: {name_obj}")
        logger.debug(f"Photo objects: {photo_objs}")
        name_data = {
            "id": str(name_obj) if name_obj else "",
            "name_ru": str(g.value(name_obj, ASANA.nameInRussian)) if name_obj else "",
            "name_sanskrit": str(g.value(name_obj, ASANA.nameInSanskrit)) if name_obj and g.value(name_obj, ASANA.nameInSanskrit) else "",
            "transliteration": str(g.value(name_obj, ASANA.nameInTranslit)) if name_obj and g.value(name_obj, ASANA.nameInTranslit) else "",
            "definition": str(g.value(name_obj, ASANA.OWLDataProperty_c8100b71_09ff_49ec_8fbf_63fa1be3947a)) if name_obj and g.value(name_obj, ASANA.OWLDataProperty_c8100b71_09ff_49ec_8fbf_63fa1be3947a) else ""
        }
        # Собираем все уникальные источники из всех фото
        sources_set = set()
        photos_with_sources = []
        for photo in photo_objs:
            source_obj = g.value(photo, ASANA.hasSource)
            if source_obj:
                sources_set.add(source_obj)
            
            # Получаем фото: сначала пробуем S3 путь, потом base64 (для обратной совместимости)
            s3_path = g.value(photo, ASANA.s3PhotoPath)
            base64_photo = g.value(photo, ASANA.base64Photo)
            ph_hash = g.value(photo, ASANA.photoHash)
            
            photo_data = {
                "id": str(photo),
                "s3_path": str(s3_path) if s3_path else None,
                "image": get_s3_url(str(s3_path)) if s3_path else (str(base64_photo) if base64_photo else None),
                "source": str(source_obj) if source_obj else None,
                "photo_hash": str(ph_hash) if ph_hash else None,
            }
            if photo_data["image"]:
                photos_with_sources.append(photo_data)
        
        # Формируем список источников с полной информацией
        sources_list = []
        for source_obj in sources_set:
            source_id = str(source_obj)
            source_data = {
                "id": source_id,
                "title": str(g.value(source_obj, ASANA.sourseTitle)) if g.value(source_obj, ASANA.sourseTitle) else "",
                "author": str(g.value(source_obj, ASANA.sourceAuthor)) if g.value(source_obj, ASANA.sourceAuthor) else "",
                "year": int(g.value(source_obj, ASANA.sourceYear)) if g.value(source_obj, ASANA.sourceYear) else None,
                "publisher": str(g.value(source_obj, ASANA.sourcePublisher)) if g.value(source_obj, ASANA.sourcePublisher) else "",
                "pages": int(g.value(source_obj, ASANA.sourcePages)) if g.value(source_obj, ASANA.sourcePages) else 0,
                "annotation": str(g.value(source_obj, ASANA.sourceAnnotation)) if g.value(source_obj, ASANA.sourceAnnotation) else ""
            }
            sources_list.append(source_data)
        
        # Для обратной совместимости оставляем первый источник в source
        source_data = sources_list[0] if sources_list else {}
        
        # Формируем список фото (для обратной совместимости)
        photos = [p["image"] for p in photos_with_sources if p["image"]]
        
        logger.debug(f"Photos count: {len(photos)}, Sources count: {len(sources_list)}")
        same_as_ids = [str(o) for o in g.objects(asana, ASANA.isSameAsObject)]
        asana_data = {
            "id": str(asana),
            "name": name_data,
            "source": source_data,  # Первый источник для обратной совместимости
            "sources": sources_list,  # Все источники
            "photos": photos_with_sources,  # Фото с источниками
            "photo": photos[0] if photos else "",  # Первое фото для обратной совместимости
            "same_as_ids": same_as_ids,
        }
        logger.debug(f"Adding asana with ID: {asana_data['id']}")
        asanas.append(asana_data)
    logger.info(f"Successfully loaded {len(asanas)} asanas")
    # Сортируем асаны по названию на русском языке
    asanas.sort(key=lambda a: (a["name"]["name_ru"] or "").lower())
    return asanas


def load_asanas():
    return load_asanas_from_graph(get_graph())

def find_existing_asana(name_id: str, source_id: str) -> Optional[str]:
    """
    Ищет существующую асану с таким же названием И источником.
    Источник учитывается только на фото: то же название и фото с тем же источником.
    
    Args:
        name_id: ID названия асаны
        source_id: ID источника
    
    Returns:
        ID асаны, если найдена асана с таким же названием И источником, иначе None
    """
    try:
        g = get_graph()
        name_uri = URIRef(name_id)
        source_uri = URIRef(source_id)
        
        # Находим все асаны с таким же названием
        asanas_with_name = list(g.subjects(ASANA.hasName, name_uri))
        
        for asana_uri in asanas_with_name:
            photo_objs = list(g.objects(asana_uri, ASANA.hasPhoto))
            for photo_uri in photo_objs:
                photo_source = g.value(photo_uri, ASANA.hasSource)
                if photo_source == source_uri:
                    logger.info(f"Found existing asana: {str(asana_uri)} with same name and source (has photo with this source)")
                    return str(asana_uri)
        
        logger.debug(f"No existing asana found for name_id={name_id}, source_id={source_id} - will create new asana")
        return None
    except Exception as e:
        logger.error(f"Error finding existing asana: {str(e)}", exc_info=True)
        return None


def add_asana(name_id: str, source_id: str, photo_paths: List[str] = None, photo_hashes: List[str] = None):
    """
    Добавляет асану в онтологию или добавляет фото к существующей асане.
    
    Если уже существует асана с таким же названием И источником (source_id),
    то добавляет новые фото к этой асане вместо создания новой.
    Если название совпадает, но источник другой - создается новая асана с тем же названием, но новым источником.
    
    Args:
        name_id: ID названия асаны
        source_id: ID источника
        photo_paths: Список путей к фото в S3 (формат: bucket/path/to/file, например: images/asans/uuid.jpg)
                     Если передан один путь (строка), преобразуется в список для обратной совместимости
        photo_hashes: Список MD5 хешей изображений (опционально, для сравнения дубликатов)
                     Должен соответствовать по индексу photo_paths
    
    Returns:
        ID асаны (существующей или новой)
    """
    try:
        # Поддержка обратной совместимости: если передан один путь (строка), преобразуем в список
        if isinstance(photo_paths, str):
            photo_paths = [photo_paths]
        elif photo_paths is None:
            photo_paths = []
        
        # Нормализуем photo_hashes
        if photo_hashes is None:
            photo_hashes = []
        elif isinstance(photo_hashes, str):
            photo_hashes = [photo_hashes]
        
        # Пропускаем пустые пути и проверяем, что это НЕ base64
        logger.info(f"[DEBUG ONTOLOGY] Validating {len(photo_paths)} photo paths")
        valid_paths = []
        valid_hashes = []
        for idx, p in enumerate(photo_paths):
            logger.info(f"[DEBUG ONTOLOGY] Photo path {idx+1}: type={type(p)}, value={p[:100] if isinstance(p, str) else str(p)[:100]}")
            if not p:
                logger.warning(f"[DEBUG ONTOLOGY] Photo path {idx+1} is empty, skipping")
                continue
            # Проверяем, что это НЕ base64
            if isinstance(p, str) and p.startswith('data:'):
                logger.error(f"[ERROR ONTOLOGY] Got base64 data URI in photo_paths! Value preview: {p[:200]}...")
                raise ValueError(f"Base64 data URI found in photo_paths! Photo should be uploaded to S3 first!")
            # Проверяем формат S3 пути
            if isinstance(p, str) and not p.startswith('images/'):
                logger.error(f"[ERROR ONTOLOGY] Invalid photo path format: {p[:100]}... Expected 'images/...'")
                logger.error(f"[ERROR ONTOLOGY] Full path: {p}")
                raise ValueError(f"Invalid photo path format. Expected S3 path (images/...), got: {p[:100]}")
            valid_paths.append(p)
            # Сохраняем соответствующий хеш, если есть
            if idx < len(photo_hashes):
                valid_hashes.append(photo_hashes[idx])
            else:
                valid_hashes.append(None)
            logger.info(f"[DEBUG ONTOLOGY] Photo path {idx+1} validated successfully: {p}")
        
        photo_paths = valid_paths
        photo_hashes = valid_hashes
        logger.info(f"[DEBUG ONTOLOGY] After validation: {len(photo_paths)} valid photo paths, {len([h for h in photo_hashes if h])} hashes")
        
        logger.info("Starting to add/update asana")
        logger.debug(f"Parameters: name_id={name_id}, source_id={source_id}, photos_count={len(photo_paths)}")
        
        g = get_graph()
        
        # Проверяем, существует ли уже асана с таким же названием и источником
        existing_asana_id = find_existing_asana(name_id, source_id)
        
        if existing_asana_id:
            # Добавляем фото к существующей асане (если есть фото)
            logger.info(f"[DEBUG ONTOLOGY] Found existing asana {existing_asana_id}, adding photos to it")
            logger.info(f"[DEBUG ONTOLOGY] Photo paths to add: {photo_paths}")
            asana_uri = URIRef(existing_asana_id)
            source_uri = URIRef(source_id)
            
            # Если есть фото, добавляем их (проверяем на дубликаты)
            if photo_paths:
                # Получаем список уже существующих фото с этим источником для проверки дубликатов
                existing_photos = list(g.objects(asana_uri, ASANA.hasPhoto))
                existing_photo_hashes = set()
                existing_photo_paths = set()  # Для обратной совместимости
                for existing_photo_uri in existing_photos:
                    existing_photo_source = g.value(existing_photo_uri, ASANA.hasSource)
                    if existing_photo_source == source_uri:
                        # Приоритет: проверяем хеш, если есть
                        existing_hash = g.value(existing_photo_uri, ASANA.photoHash)
                        if existing_hash:
                            existing_photo_hashes.add(norm_image_hash_hex(rdf_property_value_str(existing_hash)))
                        # Для обратной совместимости также сохраняем пути
                        existing_s3_path = g.value(existing_photo_uri, ASANA.s3PhotoPath)
                        if existing_s3_path:
                            existing_photo_paths.add(norm_s3_path(rdf_property_value_str(existing_s3_path)))
                
                for i, photo_path in enumerate(photo_paths):
                    logger.info(f"[DEBUG ONTOLOGY] Processing photo {i+1}/{len(photo_paths)}: {photo_path}")
                    
                    # Получаем хеш для этого фото, если передан
                    photo_hash = photo_hashes[i] if i < len(photo_hashes) else None
                    path_n = norm_s3_path(photo_path)
                    hash_n = norm_image_hash_hex(photo_hash) if photo_hash else ""
                    
                    # Проверяем, не существует ли уже такое фото (по хешу, если есть, иначе по пути)
                    is_duplicate = False
                    if hash_n and hash_n in existing_photo_hashes:
                        logger.warning(f"[WARNING ONTOLOGY] Photo with hash '{hash_n}' already exists for this asana and source, skipping duplicate")
                        is_duplicate = True
                    elif path_n and path_n in existing_photo_paths:
                        # Для обратной совместимости: если хеша нет, проверяем по пути
                        logger.warning(f"[WARNING ONTOLOGY] Photo with path '{path_n}' already exists for this asana and source, skipping duplicate")
                        is_duplicate = True
                    
                    if is_duplicate:
                        continue
                    
                    photo_uri = URIRef(f"{ASANA}photo_{uuid.uuid4()}")
                    logger.info(f"[DEBUG ONTOLOGY] Created photo URI: {photo_uri}")
                    
                    g.add((photo_uri, RDF.type, ASANA.AsanaPhoto))
                    
                    # Добавляем фото: ТОЛЬКО S3 путь, base64 НЕ принимаем!
                    # S3 путь должен быть в формате bucket/path/to/file (например: images/asans/uuid.jpg)
                    if not photo_path:
                        logger.error(f"[ERROR ONTOLOGY] Photo path is empty for photo {i+1}")
                        continue
                    
                    if photo_path.startswith('data:'):
                        logger.error(f"[ERROR ONTOLOGY] Got base64 data URI instead of S3 path for photo {i+1}! This should not happen.")
                        logger.error(f"[ERROR ONTOLOGY] Photo path preview: {photo_path[:200]}...")
                        raise ValueError(f"Base64 data URI passed to add_asana instead of S3 path. Photo should be uploaded to S3 first!")
                    
                    # Проверяем, что это S3 путь (начинается с bucket name)
                    if '/' in photo_path and photo_path.startswith('images/'):
                        # ВАЖНО: Записываем ТОЛЬКО s3PhotoPath, НИКОГДА base64Photo!
                        # Дополнительная проверка: убеждаемся что это НЕ base64
                        if len(photo_path) > 1000 or 'data:' in photo_path or photo_path.startswith('iVBORw0KGgo'):
                            logger.error(f"[ERROR ONTOLOGY] Photo path looks like base64! Length: {len(photo_path)}, preview: {photo_path[:100]}")
                            raise ValueError(f"Photo path looks like base64 data! Expected S3 path, got suspicious data")
                        g.add((photo_uri, ASANA.s3PhotoPath, Literal(photo_path)))  # Store S3 path
                        # Сохраняем хеш изображения, если передан
                        if photo_hash:
                            g.add((photo_uri, ASANA.photoHash, Literal(photo_hash)))
                            logger.info(f"[DEBUG ONTOLOGY] Added S3 photo path: {photo_path}, hash: {photo_hash}")
                        else:
                            logger.info(f"[DEBUG ONTOLOGY] Added S3 photo path: {photo_path} (no hash provided)")
                    else:
                        logger.error(f"[ERROR ONTOLOGY] Invalid photo path format: {photo_path[:100]}...")
                        logger.error(f"[ERROR ONTOLOGY] Expected format: images/asans/uuid.jpg")
                        raise ValueError(f"Invalid photo path format. Expected S3 path (images/...), got: {photo_path[:100]}")
                    
                    g.add((photo_uri, ASANA.hasSource, source_uri))
                    g.add((asana_uri, ASANA.hasPhoto, photo_uri))
                    logger.info(f"[DEBUG ONTOLOGY] Added photo and source triples for photo {i+1}")
                    if hash_n:
                        existing_photo_hashes.add(hash_n)
                    if path_n:
                        existing_photo_paths.add(path_n)
            else:
                logger.info(f"[DEBUG ONTOLOGY] No photos to add to existing asana")
            
            logger.info(f"Saving graph to {config.OWL_FILE_PATH}")
            _persist_ontology_graph(g)
            logger.info("Successfully saved graph with added photos")
            
            return existing_asana_id
        else:
            # Создаём только новую асану с хотя бы одним фото в S3 (источник задаётся у AsanaPhoto)
            if not photo_paths:
                raise ValueError(
                    "Нельзя добавить новую асану без хотя бы одного успешно загруженного фото в хранилище (S3). "
                    "Проверьте файл импорта, колонки с изображениями и настройки MinIO (логин/пароль)."
                )
            logger.info("Creating new asana")
            asana_uri = URIRef(f"{ASANA}asana_{uuid.uuid4()}")
            logger.debug(f"Created asana URI: {asana_uri}")
            
            g.add((asana_uri, RDF.type, ASANA.Asana))
            logger.debug("Added asana type triple")
            
            # Link existing name
            name_uri = URIRef(name_id)
            g.add((asana_uri, ASANA.hasName, name_uri))
            logger.debug(f"Linked name: {name_uri}")
            
            # Create and link photos (если есть)
            source_uri = URIRef(source_id)
            if photo_paths:
                logger.info(f"[DEBUG ONTOLOGY] Creating {len(photo_paths)} photos for new asana")
                for i, photo_path in enumerate(photo_paths):
                    logger.info(f"[DEBUG ONTOLOGY] Processing photo {i+1}/{len(photo_paths)}: {photo_path}")
                    
                    # Получаем хеш для этого фото, если передан
                    photo_hash = photo_hashes[i] if i < len(photo_hashes) else None
                    
                    photo_uri = URIRef(f"{ASANA}photo_{uuid.uuid4()}")
                    logger.info(f"[DEBUG ONTOLOGY] Created photo URI: {photo_uri}")
                    
                    g.add((photo_uri, RDF.type, ASANA.AsanaPhoto))
                    
                    # Добавляем фото: ТОЛЬКО S3 путь, base64 НЕ принимаем!
                    # S3 путь должен быть в формате bucket/path/to/file (например: images/asans/uuid.jpg)
                    if not photo_path:
                        logger.error(f"[ERROR ONTOLOGY] Photo path is empty for photo {i+1}")
                        continue
                    
                    if photo_path.startswith('data:'):
                        logger.error(f"[ERROR ONTOLOGY] Got base64 data URI instead of S3 path for photo {i+1}! This should not happen.")
                        logger.error(f"[ERROR ONTOLOGY] Photo path preview: {photo_path[:200]}...")
                        raise ValueError(f"Base64 data URI passed to add_asana instead of S3 path. Photo should be uploaded to S3 first!")
                    
                    # Проверяем, что это S3 путь (начинается с bucket name)
                    if '/' in photo_path and photo_path.startswith('images/'):
                        # ВАЖНО: Записываем ТОЛЬКО s3PhotoPath, НИКОГДА base64Photo!
                        # Дополнительная проверка: убеждаемся что это НЕ base64
                        if len(photo_path) > 1000 or 'data:' in photo_path or photo_path.startswith('iVBORw0KGgo'):
                            logger.error(f"[ERROR ONTOLOGY] Photo path looks like base64! Length: {len(photo_path)}, preview: {photo_path[:100]}")
                            raise ValueError(f"Photo path looks like base64 data! Expected S3 path, got suspicious data")
                        g.add((photo_uri, ASANA.s3PhotoPath, Literal(photo_path)))  # Store S3 path
                        # Сохраняем хеш изображения, если передан
                        if photo_hash:
                            g.add((photo_uri, ASANA.photoHash, Literal(photo_hash)))
                            logger.info(f"[DEBUG ONTOLOGY] Added S3 photo path: {photo_path}, hash: {photo_hash}")
                        else:
                            logger.info(f"[DEBUG ONTOLOGY] Added S3 photo path: {photo_path} (no hash provided)")
                    else:
                        logger.error(f"[ERROR ONTOLOGY] Invalid photo path format: {photo_path[:100]}...")
                        logger.error(f"[ERROR ONTOLOGY] Expected format: images/asans/uuid.jpg")
                        raise ValueError(f"Invalid photo path format. Expected S3 path (images/...), got: {photo_path[:100]}")
                    
                    g.add((photo_uri, ASANA.hasSource, source_uri))
                    g.add((asana_uri, ASANA.hasPhoto, photo_uri))
                    logger.info(f"[DEBUG ONTOLOGY] Added photo and source triples for photo {i+1}")
            
            linked = list(g.objects(asana_uri, ASANA.hasPhoto))
            if not linked:
                g.remove((asana_uri, None, None))
                g.remove((None, None, asana_uri))
                raise ValueError(
                    "Ни одно изображение не было привязано к новой асане (все пути пустые или неверного формата). "
                    "Проверьте данные и загрузку в S3."
                )

            logger.info(f"Saving graph to {config.OWL_FILE_PATH}")
            _persist_ontology_graph(g)
            logger.info("Successfully saved graph")
            
            return str(asana_uri)
    except Exception as e:
        logger.error(f"Error adding asana: {str(e)}", exc_info=True)
        raise

def load_sources_from_graph(g: Graph):
    logger.info("Starting to load sources from graph")
    sources = []
    for source in g.subjects(RDF.type, ASANA.AsanaSource):
        source_data = {
            "id": str(source),
            "title": str(g.value(source, ASANA.sourseTitle)),
            "author": str(g.value(source, ASANA.sourceAuthor)),
            "year": int(g.value(source, ASANA.sourceYear)),
            "publisher": str(g.value(source, ASANA.sourcePublisher)) if g.value(source, ASANA.sourcePublisher) else "",
            "pages": int(g.value(source, ASANA.sourcePages)) if g.value(source, ASANA.sourcePages) else 0,
            "annotation": str(g.value(source, ASANA.sourceAnnotation)) if g.value(source, ASANA.sourceAnnotation) else ""
        }
        logger.debug(f"Loaded source: {source_data}")
        sources.append(source_data)
    logger.info(f"Successfully loaded {len(sources)} sources")
    return sources


def load_sources():
    return load_sources_from_graph(get_graph())

def find_existing_source(source_data: Dict[str, Any]) -> Optional[str]:
    """
    Ищет существующий источник по title, author и year.
    Возвращает ID источника, если найден, иначе None.
    """
    try:
        g = get_graph()
        title = source_data.get("title", "").strip()
        author = source_data.get("author", "").strip()
        year = source_data.get("year", 0)
        
        if not title and not author:
            logger.debug("No title or author provided, skipping search")
            return None
        
        # Ищем все источники
        sources_found = 0
        for source_uri in g.subjects(RDF.type, ASANA.AsanaSource):
            sources_found += 1
            existing_title = str(g.value(source_uri, ASANA.sourseTitle) or "").strip()
            existing_author = str(g.value(source_uri, ASANA.sourceAuthor) or "").strip()
            existing_year = int(g.value(source_uri, ASANA.sourceYear) or 0)
            
            # Сравниваем title и author (case-insensitive)
            title_match = False
            if title and existing_title:
                title_match = title.lower().strip() == existing_title.lower().strip()
            elif not title and not existing_title:
                title_match = True  # Оба пустые
            
            author_match = False
            if author and existing_author:
                author_match = author.lower().strip() == existing_author.lower().strip()
            elif not author and not existing_author:
                author_match = True  # Оба пустые
            
            # Сравниваем год: если оба не равны 0, должны совпадать
            # Если один из них 0, считаем что год не важен для сравнения
            year_match = True
            if year != 0 and existing_year != 0:
                year_match = year == existing_year
            # Если один из них 0, год не учитывается в сравнении
            
            # Если совпадают title и author (и год если оба указаны), возвращаем существующий
            if title_match and author_match and year_match:
                logger.info(f"Found existing source: {str(source_uri)} (title: '{existing_title}', author: '{existing_author}', year: {existing_year})")
                return str(source_uri)
        
        logger.debug(f"Checked {sources_found} sources, no match found for title='{title}', author='{author}', year={year}")
        return None
    except Exception as e:
        logger.error(f"Error finding existing source: {str(e)}", exc_info=True)
        return None

def add_source(source_data: Dict[str, Any], check_existing: bool = True) -> str:
    """
    Добавляет источник в онтологию.
    
    Args:
        source_data: Данные источника
        check_existing: Если True, проверяет существующие источники перед созданием
    
    Returns:
        ID созданного или найденного источника
    """
    try:
        # Проверяем существующий источник
        if check_existing:
            existing_id = find_existing_source(source_data)
            if existing_id:
                logger.info(f"Using existing source: {existing_id}")
                return existing_id
        
        logger.info("Starting to add new source")
        logger.debug(f"Source data: {source_data}")
        
        g = get_graph()
        source_uri = URIRef(f"{ASANA}source_{uuid.uuid4()}")
        logger.debug(f"Created source URI: {source_uri}")
        
        g.add((source_uri, RDF.type, ASANA.AsanaSource))
        g.add((source_uri, ASANA.sourseTitle, Literal(source_data["title"])))
        g.add((source_uri, ASANA.sourceAuthor, Literal(source_data["author"])))
        g.add((source_uri, ASANA.sourceYear, Literal(source_data["year"])))
        
        # Добавляем новые поля источника, если они есть
        if "publisher" in source_data and source_data["publisher"]:
            g.add((source_uri, ASANA.sourcePublisher, Literal(source_data["publisher"])))
        
        if "pages" in source_data and source_data["pages"]:
            g.add((source_uri, ASANA.sourcePages, Literal(source_data["pages"])))
        
        if "annotation" in source_data and source_data["annotation"]:
            g.add((source_uri, ASANA.sourceAnnotation, Literal(source_data["annotation"])))
            
        logger.debug("Added source triples")
        
        logger.info(f"Saving graph to {config.OWL_FILE_PATH}")
        _persist_ontology_graph(g)
        logger.info("Successfully saved graph")
        
        return str(source_uri)
    except Exception as e:
        logger.error(f"Error adding source: {str(e)}", exc_info=True)
        raise

def load_asana_names_from_graph(g: Graph):
    logger.info("Starting to load asana names from graph")
    names = []
    for name in g.subjects(RDF.type, ASANA.AsanaName):
        created_lit = g.value(name, ASANA.nameCreatedAt)
        name_data = {
            "id": str(name),
            "name_ru": str(g.value(name, ASANA.nameInRussian)),
            "name_sanskrit": str(g.value(name, ASANA.nameInSanskrit)) if g.value(name, ASANA.nameInSanskrit) else "",
            "transliteration": str(g.value(name, ASANA.nameInTranslit)) if g.value(name, ASANA.nameInTranslit) else "",
            "definition": str(g.value(name, ASANA_DEFINITION)) if g.value(name, ASANA_DEFINITION) else "",
            "name_created_at": str(created_lit) if created_lit else None,
        }
        logger.debug(f"Loaded asana name: {name_data}")
        names.append(name_data)
    logger.info(f"Successfully loaded {len(names)} asana names")
    return names


def load_asana_names():
    return load_asana_names_from_graph(get_graph())


def _resolve_asana_name_uri(g, name_id: str) -> Optional[URIRef]:
    """Находит URI сущности AsanaName по полному URI или по суффиксу UUID."""
    obj = URIRef(name_id)
    if (obj, RDF.type, ASANA.AsanaName) in g:
        return obj
    suffix = name_id.split("_")[-1]
    for s in g.subjects(RDF.type, ASANA.AsanaName):
        if str(s).endswith(suffix):
            return URIRef(s)
    return None


def list_asanas_referencing_name(name_id: str) -> List[str]:
    """Список URI асан, у которых выбрано это название (hasName)."""
    g = get_graph()
    name_uri = _resolve_asana_name_uri(g, name_id)
    if not name_uri:
        return []
    return [str(s) for s in g.subjects(ASANA.hasName, name_uri)]


def update_asana_name(name_id: str, name_data: Dict[str, Any]) -> None:
    """Обновляет поля существующего AsanaName. URI не меняется."""
    g = get_graph()
    name_uri = _resolve_asana_name_uri(g, name_id)
    if not name_uri:
        raise ValueError("Название не найдено")

    name_ru = (name_data.get("name_ru") or "").strip()
    if not name_ru:
        raise ValueError("Поле «название» обязательно")

    name_ru_lower = name_ru.lower()
    for n in g.subjects(RDF.type, ASANA.AsanaName):
        if str(n) == str(name_uri):
            continue
        existing = g.value(n, ASANA.nameInRussian)
        if existing and str(existing).lower().strip() == name_ru_lower:
            raise ValueError("Название на русском уже занято другой записью")

    for pred in (ASANA.nameInRussian, ASANA.nameInSanskrit, ASANA.nameInTranslit, ASANA_DEFINITION):
        for o in list(g.objects(name_uri, pred)):
            g.remove((name_uri, pred, o))

    g.add((name_uri, ASANA.nameInRussian, Literal(name_ru)))
    if name_data.get("name_sanskrit"):
        g.add((name_uri, ASANA.nameInSanskrit, Literal(str(name_data["name_sanskrit"]).strip())))
    if name_data.get("transliteration"):
        g.add((name_uri, ASANA.nameInTranslit, Literal(str(name_data["transliteration"]).strip())))
    if name_data.get("definition"):
        g.add((name_uri, ASANA_DEFINITION, Literal(str(name_data["definition"]).strip())))

    _persist_ontology_graph(g)


def add_asana_name(name_data: Dict[str, str]) -> str:
    try:
        logger.info("Starting to add new asana name")
        logger.debug(f"Name data: {name_data}")
        
        g = get_graph()
        name_uri = URIRef(f"{ASANA}name_{uuid.uuid4()}")
        logger.debug(f"Created name URI: {name_uri}")
        
        g.add((name_uri, RDF.type, ASANA.AsanaName))
        g.add((name_uri, ASANA.nameInRussian, Literal(name_data["name_ru"])))
        g.add(
            (
                name_uri,
                ASANA.nameCreatedAt,
                Literal(datetime.now(timezone.utc).isoformat()),
            )
        )
        if "name_sanskrit" in name_data and name_data["name_sanskrit"]:
            g.add((name_uri, ASANA.nameInSanskrit, Literal(name_data["name_sanskrit"])))
        if "transliteration" in name_data and name_data["transliteration"]:
            g.add((name_uri, ASANA.nameInTranslit, Literal(name_data["transliteration"])))
        if "definition" in name_data and name_data["definition"]:
            g.add((name_uri, ASANA_DEFINITION, Literal(name_data["definition"])))
        logger.debug("Added name triples")
        logger.info(f"Saving graph to {config.OWL_FILE_PATH}")
        _persist_ontology_graph(g)
        logger.info("Successfully saved graph")
        return str(name_uri)
    except Exception as e:
        logger.error(f"Error adding asana name: {str(e)}", exc_info=True)
        raise

def delete_any_by_uri(uri: str) -> bool:
    try:
        g = get_graph()
        obj_uri = URIRef(uri)
        found = False
        # Пробуем точное совпадение
        if (obj_uri, None, None) in g or (None, None, obj_uri) in g:
            found = True
            g.remove((obj_uri, None, None))
            g.remove((None, None, obj_uri))
        else:
            # Если не найдено — ищем по окончанию (UUID)
            suffix = uri.split("_")[-1]
            candidates = [s for s in g.subjects() if str(s).endswith(suffix)]
            for cand in candidates:
                g.remove((cand, None, None))
                g.remove((None, None, cand))
                found = True
            # Если всё равно не найдено — ищем по подстроке UUID
            if not found:
                uuid_part = suffix
                candidates = [s for s in g.subjects() if uuid_part in str(s)]
                for cand in candidates:
                    g.remove((cand, None, None))
                    g.remove((None, None, cand))
                    found = True
        if not found:
            print(f'НЕ НАЙДЕН В ГРАФЕ: {uri}')
            return False
        _persist_ontology_graph(g)
        print(f'УДАЛЁН(Ы): {uri}')
        return True
    except Exception as e:
        print(f'ОШИБКА ПРИ УДАЛЕНИИ: {e}')
        raise

def delete_source_from_ontology(source_id: str) -> bool:
    return delete_any_by_uri(source_id)

def delete_asana_name_from_ontology(name_id: str) -> bool:
    g = get_graph()
    name_uri = _resolve_asana_name_uri(g, name_id)
    if not name_uri:
        return False
    refs = list(g.subjects(ASANA.hasName, name_uri))
    if refs:
        raise ValueError(
            f"Нельзя удалить название: оно используется в {len(refs)} асанах. "
            "Сначала смените название у этих асан или удалите их."
        )
    return delete_any_by_uri(str(name_uri))

def delete_asana_from_ontology(asana_id: str) -> bool:
    try:
        g = get_graph()
        ASANA = Namespace("http://www.semanticweb.org/platinum_watermelon/ontologies/Asana#")
        asana_uri = URIRef(asana_id)
        # Если не найдено точное совпадение — ищем по UUID
        if (asana_uri, None, None) not in g:
            suffix = asana_id.split("_")[-1]
            candidates = [s for s in g.subjects(RDF.type, ASANA.Asana) if str(s).endswith(suffix)]
            if not candidates:
                print(f'Асана не найдена: {asana_id}')
                return False
            asana_uri = candidates[0]
        # Найти все связанные фото и удалить их из S3
        photo_uris = list(g.objects(asana_uri, ASANA.hasPhoto))
        from app.s3_utils import delete_file_from_s3
        for photo_uri in photo_uris:
            # Получаем S3 путь фото перед удалением
            s3_path = g.value(photo_uri, ASANA.s3PhotoPath)
            if s3_path:
                # Удаляем файл из S3
                delete_file_from_s3(str(s3_path))
            # Удалить все триплеты, где фигурирует фото
            g.remove((photo_uri, None, None))
            g.remove((None, None, photo_uri))
        # Удалить все триплеты, где фигурирует асана
        g.remove((asana_uri, None, None))
        g.remove((None, None, asana_uri))
        _persist_ontology_graph(g)
        print(f'Удалена асана и связанные фото: {asana_id}')
        return True
    except Exception as e:
        print(f'ОШИБКА ПРИ УДАЛЕНИИ АСАНЫ: {e}')
        raise


def purge_asanas_without_photos_from_ontology() -> int:
    """
    Удаляет индивидов Asana без ни одного hasPhoto (битые записи после сбойного импорта).
    Снимает связи isSameAsObject в обе стороны. Файлы в S3 не трогаем (фото нет).
    Персистит OWL только если что-то удалили.
    """
    g = get_graph()
    removed = 0
    candidates = [uri for uri in g.subjects(RDF.type, ASANA.Asana)]
    for asana_uri in candidates:
        if list(g.objects(asana_uri, ASANA.hasPhoto)):
            continue
        for o in list(g.objects(asana_uri, ASANA.isSameAsObject)):
            g.remove((asana_uri, ASANA.isSameAsObject, o))
            g.remove((o, ASANA.isSameAsObject, asana_uri))
        for s in list(g.subjects(ASANA.isSameAsObject, asana_uri)):
            g.remove((s, ASANA.isSameAsObject, asana_uri))
            g.remove((asana_uri, ASANA.isSameAsObject, s))
        g.remove((asana_uri, None, None))
        g.remove((None, None, asana_uri))
        removed += 1
    if removed:
        _persist_ontology_graph(g)
        logger.info("purge_asanas_without_photos_from_ontology: удалено асан без фото: %s", removed)
    return removed


def add_photo_to_asana(asana_id: str, photo_bytes: bytes, source_id: str = None):
    try:
        g = get_graph()
        asana_uri = URIRef(asana_id)
        # Если не найдено точное совпадение — ищем по UUID
        if (asana_uri, None, None) not in g:
            suffix = asana_id.split("_")[-1]
            candidates = [s for s in g.subjects(RDF.type, ASANA.Asana) if str(s).endswith(suffix)]
            if not candidates:
                raise Exception("Асана не найдена")
            asana_uri = candidates[0]
        # Загружаем в S3 вместо сохранения base64
        from app.s3_utils import upload_image_to_s3
        logger.warning(f"[WARNING] add_photo_to_asana uses base64 - uploading to S3 instead!")
        photo_s3_path, photo_hash = upload_image_to_s3(photo_bytes, prefix="asans")
        logger.info(f"[DEBUG] Uploaded photo to S3: {photo_s3_path}, hash: {photo_hash}")
        
        photo_uri = URIRef(f"{ASANA}photo_{uuid.uuid4()}")
        g.add((photo_uri, RDF.type, ASANA.AsanaPhoto))
        # Сохраняем S3 путь вместо base64
        # ВАЖНО: Записываем ТОЛЬКО s3PhotoPath, НИКОГДА base64Photo!
        # Дополнительная проверка: убеждаемся что это НЕ base64
        if len(photo_s3_path) > 1000 or 'data:' in photo_s3_path or photo_s3_path.startswith('iVBORw0KGgo'):
            logger.error(f"[ERROR ONTOLOGY] Photo path looks like base64! Length: {len(photo_s3_path)}, preview: {photo_s3_path[:100]}")
            raise ValueError(f"Photo path looks like base64 data! Expected S3 path, got suspicious data")
        g.add((photo_uri, ASANA.s3PhotoPath, Literal(photo_s3_path)))
        # Сохраняем хеш изображения
        if photo_hash:
            g.add((photo_uri, ASANA.photoHash, Literal(photo_hash)))
            logger.info(f"[DEBUG ONTOLOGY] Added S3 photo path: {photo_s3_path}, hash: {photo_hash}")
        else:
            logger.info(f"[DEBUG ONTOLOGY] Added S3 photo path: {photo_s3_path} (no hash)")
        
        # Если указан источник, добавляем его
        if source_id:
            source_uri = URIRef(source_id)
            g.add((photo_uri, ASANA.hasSource, source_uri))
            
        g.add((asana_uri, ASANA.hasPhoto, photo_uri))
        _persist_ontology_graph(g)
        
        return str(photo_uri)
    except Exception as e:
        raise

# Получение асан по первой букве (для каталога по алфавиту)
def get_asanas_by_first_letter(letter: str):
    logger.info(f"Getting asanas starting with letter: {letter}")
    asanas = load_asanas()  # load_asanas уже сортирует, но на всякий случай еще раз
    filtered_asanas = [asana for asana in asanas if asana["name"]["name_ru"] and asana["name"]["name_ru"][0].upper() == letter.upper()]
    # Сортируем по названию (на всякий случай, хотя load_asanas уже сортирует)
    filtered_asanas.sort(key=lambda a: (a["name"]["name_ru"] or "").lower())
    logger.info(f"Found {len(filtered_asanas)} asanas starting with letter: {letter}")
    return filtered_asanas

# Получение асан по источнику
def get_asanas_by_source(source_id: str):
    logger.info(f"Getting asanas for source ID: {source_id}")
    g = get_graph()
    
    # Формируем полный URI источника, если передан только ID
    if not source_id.startswith('http://'):
        source_id = f"http://www.semanticweb.org/platinum_watermelon/ontologies/Asana#source_{source_id}"
    source_uri = URIRef(source_id)
    
    # Найти все фото, связанные с источником
    photo_uris = list(g.subjects(ASANA.hasSource, source_uri))
    logger.debug(f"Found {len(photo_uris)} photos for source")
    
    # Найти все асаны, связанные с этими фото
    asana_uris = set()
    for photo_uri in photo_uris:
        asanas = list(g.subjects(ASANA.hasPhoto, photo_uri))
        asana_uris.update(asanas)
    
    # Также найти асаны, напрямую связанные с источником
    direct_asanas = list(g.subjects(ASANA.hasSource, source_uri))
    asana_uris.update(direct_asanas)
    
    logger.debug(f"Found {len(asana_uris)} total asana URIs")
    
    # Загрузить данные для каждой асаны
    asanas = []
    for asana_uri in asana_uris:
        # Проверяем, что это действительно асана
        if (asana_uri, RDF.type, ASANA.Asana) not in g:
            logger.debug(f"Skipping {asana_uri} - not an asana")
            continue
            
        name_obj = g.value(asana_uri, ASANA.hasName)
        if not name_obj:
            logger.debug(f"Skipping {asana_uri} - no name object")
            continue
            
        photo_objs = list(g.objects(asana_uri, ASANA.hasPhoto))
        
        # Фильтруем фото только от указанного источника
        source_photo_objs = [photo for photo in photo_objs if g.value(photo, ASANA.hasSource) == source_uri]
        
        name_ru = str(g.value(name_obj, ASANA.nameInRussian)) if name_obj else ""
        name_sanskrit = str(g.value(name_obj, ASANA.nameInSanskrit)) if name_obj and g.value(name_obj, ASANA.nameInSanskrit) else ""
        transliteration = str(g.value(name_obj, ASANA.nameInTranslit)) if name_obj and g.value(name_obj, ASANA.nameInTranslit) else ""
        definition = str(g.value(name_obj, ASANA.OWLDataProperty_c8100b71_09ff_49ec_8fbf_63fa1be3947a)) if name_obj and g.value(name_obj, ASANA.OWLDataProperty_c8100b71_09ff_49ec_8fbf_63fa1be3947a) else ""
        
        name_data = {
            "name_ru": name_ru,
            "name_sanskrit": name_sanskrit,
            "transliteration": transliteration,
            "definition": definition
        }
        
        # Получаем фото: сначала пробуем S3 путь, потом base64
        photos = []
        for photo in source_photo_objs:
            s3_path = g.value(photo, ASANA.s3PhotoPath)
            base64_photo = g.value(photo, ASANA.base64Photo)
            
            if s3_path:
                photos.append(get_s3_url(str(s3_path)))
            elif base64_photo:
                photos.append(str(base64_photo))
        
        logger.debug(f"Found {len(photos)} photos for asana {name_ru}")
        
        asana_data = {
            "id": str(asana_uri),
            "name": name_data,
            "photos": photos,
            "photo": photos[0] if photos else ""
        }
        asanas.append(asana_data)
    
    logger.info(f"Found {len(asanas)} asanas for source ID: {source_id}")
    # Сортируем асаны по названию
    asanas.sort(key=lambda a: (a["name"]["name_ru"] or "").lower())
    return asanas

# Поиск асан по названию (с поддержкой нечеткого поиска)
def search_asanas_by_name(query: str, fuzzy_threshold: float = 0.7):
    logger.info(f"Searching asanas with query: {query}")
    try:
        from rapidfuzz import fuzz
        
        asanas = load_asanas()
        results = []
        
        # Приводим запрос к нижнему регистру для регистронезависимого поиска
        query_lower = query.lower()
        
        for asana in asanas:
            name_ru = asana["name"]["name_ru"].lower()
            
            # Точное совпадение
            if query_lower in name_ru:
                asana["match_score"] = 1.0
                results.append(asana)
                continue
                
            # Нечеткое совпадение
            ratio = fuzz.ratio(query_lower, name_ru) / 100.0
            partial_ratio = fuzz.partial_ratio(query_lower, name_ru) / 100.0
            
            # Используем максимальный из показателей схожести
            match_score = max(ratio, partial_ratio)
            
            if match_score >= fuzzy_threshold:
                asana["match_score"] = match_score
                results.append(asana)
        
        # Сортируем результаты по релевантности
        results.sort(key=lambda a: a["match_score"], reverse=True)
        
        logger.info(f"Found {len(results)} asanas matching query: {query}")
        return results
    except ImportError:
        # Если библиотека rapidfuzz не установлена, используем обычный поиск
        logger.warning("rapidfuzz not installed, using simple search")
        asanas = load_asanas()
        query_lower = query.lower()
        results = [asana for asana in asanas if query_lower in asana["name"]["name_ru"].lower()]
        logger.info(f"Found {len(results)} asanas matching query: {query}")
        return results

def delete_photo_from_asana(asana_id: str, photo_id: str) -> bool:
    """
    Удаляет фото асаны из онтологии и S3.
    
    Args:
        asana_id: ID асаны
        photo_id: ID фото (URI фото в онтологии)
    
    Returns:
        True если успешно удалено, False если фото не найдено
    """
    try:
        g = get_graph()
        asana_uri = URIRef(asana_id)
        photo_uri = URIRef(photo_id)
        
        # Проверяем, что фото принадлежит асане
        if (asana_uri, ASANA.hasPhoto, photo_uri) not in g:
            logger.warning(f"Photo {photo_id} does not belong to asana {asana_id}")
            return False
        
        # Получаем S3 путь перед удалением
        s3_path = g.value(photo_uri, ASANA.s3PhotoPath)
        
        # Удаляем файл из S3, если есть путь
        if s3_path:
            from app.s3_utils import delete_file_from_s3
            delete_file_from_s3(str(s3_path))
            logger.info(f"Deleted photo file from S3: {s3_path}")
        
        # Удаляем все триплеты, связанные с фото
        # Удаляем связь асаны с фото
        g.remove((asana_uri, ASANA.hasPhoto, photo_uri))
        
        # Удаляем все свойства фото
        g.remove((photo_uri, None, None))
        g.remove((None, None, photo_uri))
        
        # Сохраняем онтологию
        _persist_ontology_graph(g)
        
        logger.info(f"Successfully deleted photo {photo_id} from asana {asana_id}")
        return True
        
    except Exception as e:
        logger.error(f"Error deleting photo: {str(e)}", exc_info=True)
        raise


def replace_photo_in_asana(asana_id: str, photo_id: str, new_photo_bytes: bytes) -> bool:
    """
    Заменяет фото асаны новым изображением, сохраняя тот же путь в S3.
    
    Args:
        asana_id: ID асаны
        photo_id: ID фото (URI фото в онтологии)
        new_photo_bytes: Новые данные изображения в виде bytes
    
    Returns:
        True если успешно заменено, False если фото не найдено
    """
    try:
        g = get_graph()
        asana_uri = URIRef(asana_id)
        photo_uri = URIRef(photo_id)
        
        # Проверяем, что фото принадлежит асане
        if (asana_uri, ASANA.hasPhoto, photo_uri) not in g:
            logger.warning(f"Photo {photo_id} does not belong to asana {asana_id}")
            return False
        
        # Получаем текущий S3 путь
        s3_path = g.value(photo_uri, ASANA.s3PhotoPath)
        if not s3_path:
            logger.warning(f"Photo {photo_id} does not have S3 path (might be base64)")
            return False
        
        s3_path_str = str(s3_path)
        
        # Заменяем файл в S3 (тот же путь, новое содержимое)
        from app.s3_utils import replace_file_in_s3
        new_s3_path, new_hash = replace_file_in_s3(s3_path_str, new_photo_bytes)
        
        # Обновляем хеш в онтологии
        # Удаляем старый хеш
        old_hash = g.value(photo_uri, ASANA.photoHash)
        if old_hash:
            g.remove((photo_uri, ASANA.photoHash, old_hash))
        
        # Добавляем новый хеш
        g.add((photo_uri, ASANA.photoHash, Literal(new_hash)))
        
        # Сохраняем онтологию
        _persist_ontology_graph(g)
        
        logger.info(f"Successfully replaced photo {photo_id} for asana {asana_id}, new hash: {new_hash}")
        return True
        
    except Exception as e:
        logger.error(f"Error replacing photo: {str(e)}", exc_info=True)
        raise


def get_photo_of_asana_from_source(asana_id: str, source_id: str) -> str | None:
    """
    Возвращает фото асаны по id асаны и id источника, если такое фото есть.
    Приоритет: S3 путь, затем base64.
    """
    g = get_graph()
    asana_uri = URIRef(asana_id)
    source_uri = URIRef(source_id)
    # Найти все фото, связанные с асаной
    photo_uris = list(g.objects(asana_uri, ASANA.hasPhoto))
    for photo_uri in photo_uris:
        # Проверяем, связано ли фото с нужным источником
        if g.value(photo_uri, ASANA.hasSource) == source_uri:
            s3_path = g.value(photo_uri, ASANA.s3PhotoPath)
            if s3_path:
                return get_s3_url(str(s3_path))
            base64_photo = g.value(photo_uri, ASANA.base64Photo)
            if base64_photo:
                return str(base64_photo)
    return None


# Функции для работы с isSameAsObject (аналогичные асаны)

def get_similar_asanas(asana_id: str) -> List[Dict]:
    """
    Получает список асан, которые связаны с указанной через isSameAsObject.
    Возвращает данные в том же формате, что и load_asanas().
    """
    logger.info(f"Getting similar asanas for: {asana_id}")
    g = get_graph()
    
    # Формируем полный URI если нужно
    if not asana_id.startswith('http://'):
        if not asana_id.startswith('asana_'):
            asana_id = f"asana_{asana_id}"
        asana_id = f"http://www.semanticweb.org/platinum_watermelon/ontologies/Asana#{asana_id}"
    
    asana_uri = URIRef(asana_id)
    similar_asanas = []
    
    # Ищем связи в обе стороны (asana -> similar и similar -> asana)
    # isSameAsObject симметричен
    similar_uris = set()
    
    # Асаны, на которые ссылается текущая
    for similar_uri in g.objects(asana_uri, ASANA.isSameAsObject):
        similar_uris.add(similar_uri)
    
    # Асаны, которые ссылаются на текущую
    for similar_uri in g.subjects(ASANA.isSameAsObject, asana_uri):
        similar_uris.add(similar_uri)
    
    logger.debug(f"Found {len(similar_uris)} similar asanas")
    
    # Загружаем данные для каждой найденной асаны
    for similar_uri in similar_uris:
        if (similar_uri, RDF.type, ASANA.Asana) not in g:
            continue
            
        name_obj = g.value(similar_uri, ASANA.hasName)
        photo_objs = list(g.objects(similar_uri, ASANA.hasPhoto))
        
        name_data = {
            "name_ru": str(g.value(name_obj, ASANA.nameInRussian)) if name_obj else "",
            "name_sanskrit": str(g.value(name_obj, ASANA.nameInSanskrit)) if name_obj and g.value(name_obj, ASANA.nameInSanskrit) else "",
            "transliteration": str(g.value(name_obj, ASANA.nameInTranslit)) if name_obj and g.value(name_obj, ASANA.nameInTranslit) else "",
            "definition": str(g.value(name_obj, ASANA.OWLDataProperty_c8100b71_09ff_49ec_8fbf_63fa1be3947a)) if name_obj and g.value(name_obj, ASANA.OWLDataProperty_c8100b71_09ff_49ec_8fbf_63fa1be3947a) else ""
        }
        
        # Собираем источники и фото
        sources_set = set()
        photos_with_sources = []
        for photo in photo_objs:
            source_obj = g.value(photo, ASANA.hasSource)
            if source_obj:
                sources_set.add(source_obj)
            
            s3_path = g.value(photo, ASANA.s3PhotoPath)
            base64_photo = g.value(photo, ASANA.base64Photo)
            
            photo_data = {
                "id": str(photo),  # Добавляем ID фото
                "image": get_s3_url(str(s3_path)) if s3_path else (str(base64_photo) if base64_photo else None),
                "source": str(source_obj) if source_obj else None
            }
            if photo_data["image"]:
                photos_with_sources.append(photo_data)
        
        # Формируем список источников
        sources_list = []
        for source_obj in sources_set:
            source_data = {
                "id": str(source_obj),
                "title": str(g.value(source_obj, ASANA.sourseTitle)) if g.value(source_obj, ASANA.sourseTitle) else "",
                "author": str(g.value(source_obj, ASANA.sourceAuthor)) if g.value(source_obj, ASANA.sourceAuthor) else "",
                "year": int(g.value(source_obj, ASANA.sourceYear)) if g.value(source_obj, ASANA.sourceYear) else None,
            }
            sources_list.append(source_data)
        
        photos = [p["image"] for p in photos_with_sources if p["image"]]
        
        similar_asanas.append({
            "id": str(similar_uri),
            "name": name_data,
            "sources": sources_list,
            "photos": photos_with_sources,
            "photo": photos[0] if photos else ""
        })
    
    logger.info(f"Returning {len(similar_asanas)} similar asanas")
    return similar_asanas


def add_same_as_object(asana_id: str, target_asana_id: str) -> bool:
    """
    Добавляет связь isSameAsObject между двумя асанами.
    Связь симметрична - добавляется в обе стороны.
    """
    logger.info(f"Adding isSameAsObject: {asana_id} <-> {target_asana_id}")
    
    try:
        g = get_graph()
        
        # Формируем полные URI
        def make_full_uri(aid):
            if not aid.startswith('http://'):
                if not aid.startswith('asana_'):
                    aid = f"asana_{aid}"
                return f"http://www.semanticweb.org/platinum_watermelon/ontologies/Asana#{aid}"
            return aid
        
        asana_uri = URIRef(make_full_uri(asana_id))
        target_uri = URIRef(make_full_uri(target_asana_id))
        
        # Проверяем, что обе асаны существуют
        if (asana_uri, RDF.type, ASANA.Asana) not in g:
            logger.error(f"Asana not found: {asana_uri}")
            return False
        if (target_uri, RDF.type, ASANA.Asana) not in g:
            logger.error(f"Target asana not found: {target_uri}")
            return False
        
        # Добавляем связь (в одну сторону, при чтении ищем в обе)
        g.add((asana_uri, ASANA.isSameAsObject, target_uri))
        
        _persist_ontology_graph(g)
        logger.info(f"Successfully added isSameAsObject relation")
        return True
    except Exception as e:
        logger.error(f"Error adding isSameAsObject: {str(e)}", exc_info=True)
        return False


def remove_same_as_object(asana_id: str, target_asana_id: str) -> bool:
    """
    Удаляет связь isSameAsObject между двумя асанами.
    Удаляет связи в обе стороны.
    """
    logger.info(f"Removing isSameAsObject: {asana_id} <-> {target_asana_id}")
    
    try:
        g = get_graph()
        
        # Формируем полные URI
        def make_full_uri(aid):
            if not aid.startswith('http://'):
                if not aid.startswith('asana_'):
                    aid = f"asana_{aid}"
                return f"http://www.semanticweb.org/platinum_watermelon/ontologies/Asana#{aid}"
            return aid
        
        asana_uri = URIRef(make_full_uri(asana_id))
        target_uri = URIRef(make_full_uri(target_asana_id))
        
        # Удаляем связи в обе стороны
        g.remove((asana_uri, ASANA.isSameAsObject, target_uri))
        g.remove((target_uri, ASANA.isSameAsObject, asana_uri))
        
        _persist_ontology_graph(g)
        logger.info(f"Successfully removed isSameAsObject relation")
        return True
    except Exception as e:
        logger.error(f"Error removing isSameAsObject: {str(e)}", exc_info=True)
        return False