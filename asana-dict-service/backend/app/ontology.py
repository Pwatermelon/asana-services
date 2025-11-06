from rdflib import Graph, Namespace, URIRef, Literal, RDF
from app import config
from app.s3_utils import get_s3_url
from typing import Optional, Dict, Any, List
import uuid
import logging
import os
import base64

logger = logging.getLogger("asana_service.ontology")

ASANA = Namespace("http://www.semanticweb.org/platinum_watermelon/ontologies/Asana#")
# Добавляем новое свойство для S3 пути к фото
ASANA.s3PhotoPath = URIRef(f"{ASANA}s3PhotoPath")
# Определяем base64Photo явно, чтобы контролировать его использование (только для чтения старых данных)
ASANA.base64Photo = URIRef(f"{ASANA}base64Photo")

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
            
            # Сохраняем граф
            g.serialize(destination=config.OWL_FILE_PATH, format="xml")
            logger.info("Successfully created new ontology file")
        return True
    except Exception as e:
        logger.error(f"Error ensuring ontology file exists: {str(e)}")
        raise

def get_graph():
    try:
        ensure_ontology_file_exists()
        logger.info(f"Loading RDF graph from {config.OWL_FILE_PATH}")
        g = Graph()
        g.parse(config.OWL_FILE_PATH, format="xml")
        logger.debug(f"Successfully loaded graph with {len(g)} triples")
        return g
    except Exception as e:
        logger.error(f"Failed to load RDF graph: {str(e)}")
        raise

def load_asanas():
    logger.info("Starting to load asanas from graph")
    g = get_graph()
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
            "name_ru": str(g.value(name_obj, ASANA.nameInRussian)) if name_obj else "",
            "name_sanskrit": str(g.value(name_obj, ASANA.nameInSanskrit)) if name_obj and g.value(name_obj, ASANA.nameInSanskrit) else "",
            "transliteration": str(g.value(name_obj, ASANA.nameInTranslit)) if name_obj and g.value(name_obj, ASANA.nameInTranslit) else "",
            "definition": str(g.value(name_obj, ASANA.OWLDataProperty_c8100b71_09ff_49ec_8fbf_63fa1be3947a)) if name_obj and g.value(name_obj, ASANA.OWLDataProperty_c8100b71_09ff_49ec_8fbf_63fa1be3947a) else ""
        }
        source_obj = None
        if photo_objs:
            source_obj = g.value(photo_objs[0], ASANA.hasSource)
            logger.debug(f"Source object: {source_obj}")
        source_data = {}
        if source_obj:
            source_data = {
                "title": str(g.value(source_obj, ASANA.sourseTitle)),
                "author": str(g.value(source_obj, ASANA.sourceAuthor)),
                "year": int(g.value(source_obj, ASANA.sourceYear)),
                "publisher": str(g.value(source_obj, ASANA.sourcePublisher)) if g.value(source_obj, ASANA.sourcePublisher) else "",
                "pages": int(g.value(source_obj, ASANA.sourcePages)) if g.value(source_obj, ASANA.sourcePages) else 0,
                "annotation": str(g.value(source_obj, ASANA.sourceAnnotation)) if g.value(source_obj, ASANA.sourceAnnotation) else ""
            }
        # Получаем фото: сначала пробуем S3 путь, потом base64 (для обратной совместимости)
        photos = []
        for photo in photo_objs:
            s3_path = g.value(photo, ASANA.s3PhotoPath)
            base64_photo = g.value(photo, ASANA.base64Photo)
            
            if s3_path:
                photos.append(get_s3_url(str(s3_path)))  # Use S3 URL
            elif base64_photo:
                photos.append(str(base64_photo))
        
        logger.debug(f"Photos count: {len(photos)}")
        asana_data = {
            "id": str(asana),
            "name": name_data,
            "source": source_data,
            "photos": photos,
            "photo": photos[0] if photos else ""
        }
        logger.debug(f"Adding asana with ID: {asana_data['id']}")
        asanas.append(asana_data)
    logger.info(f"Successfully loaded {len(asanas)} asanas")
    return asanas

def find_existing_asana(name_id: str, source_id: str) -> Optional[str]:
    """
    Ищет существующую асану с таким же названием и источником.
    
    Args:
        name_id: ID названия асаны
        source_id: ID источника
    
    Returns:
        ID асаны, если найдена, иначе None
    """
    try:
        g = get_graph()
        name_uri = URIRef(name_id)
        source_uri = URIRef(source_id)
        
        # Находим все асаны с таким же названием
        asanas_with_name = list(g.subjects(ASANA.hasName, name_uri))
        
        for asana_uri in asanas_with_name:
            # Проверяем, есть ли у этой асаны фото с таким же источником
            photo_objs = list(g.objects(asana_uri, ASANA.hasPhoto))
            for photo_uri in photo_objs:
                photo_source = g.value(photo_uri, ASANA.hasSource)
                if photo_source == source_uri:
                    logger.info(f"Found existing asana: {str(asana_uri)} with same name and source")
                    return str(asana_uri)
        
        logger.debug(f"No existing asana found for name_id={name_id}, source_id={source_id}")
        return None
    except Exception as e:
        logger.error(f"Error finding existing asana: {str(e)}", exc_info=True)
        return None


def add_asana(name_id: str, source_id: str, photo_paths: List[str] = None):
    """
    Добавляет асану в онтологию или добавляет фото к существующей асане.
    
    Если уже существует асана с таким же названием (name_id) и источником (source_id),
    то добавляет новые фото к этой асане вместо создания новой.
    
    Args:
        name_id: ID названия асаны
        source_id: ID источника
        photo_paths: Список путей к фото в S3 (формат: bucket/path/to/file, например: images/asans/uuid.jpg)
                     Если передан один путь (строка), преобразуется в список для обратной совместимости
                     Поддержка base64 оставлена только для обратной совместимости со старыми данными
    
    Returns:
        ID асаны (существующей или новой)
    """
    try:
        # Поддержка обратной совместимости: если передан один путь (строка), преобразуем в список
        if isinstance(photo_paths, str):
            photo_paths = [photo_paths]
        elif photo_paths is None:
            photo_paths = []
        
        # Пропускаем пустые пути и проверяем, что это НЕ base64
        logger.info(f"[DEBUG ONTOLOGY] Validating {len(photo_paths)} photo paths")
        valid_paths = []
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
            logger.info(f"[DEBUG ONTOLOGY] Photo path {idx+1} validated successfully: {p}")
        
        photo_paths = valid_paths
        logger.info(f"[DEBUG ONTOLOGY] After validation: {len(photo_paths)} valid photo paths")
        
        # Асана может быть без фото, не пропускаем добавление
        if not photo_paths:
            logger.warning(f"[WARNING ONTOLOGY] No photos provided after validation, will add asana without photos")
        
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
            
            # Если есть фото, добавляем их
            if photo_paths:
                for i, photo_path in enumerate(photo_paths):
                    logger.info(f"[DEBUG ONTOLOGY] Processing photo {i+1}/{len(photo_paths)}: {photo_path}")
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
                        logger.info(f"[DEBUG ONTOLOGY] Added S3 photo path: {photo_path}")
                    else:
                        logger.error(f"[ERROR ONTOLOGY] Invalid photo path format: {photo_path[:100]}...")
                        logger.error(f"[ERROR ONTOLOGY] Expected format: images/asans/uuid.jpg")
                        raise ValueError(f"Invalid photo path format. Expected S3 path (images/...), got: {photo_path[:100]}")
                    
                    g.add((photo_uri, ASANA.hasSource, source_uri))
                    g.add((asana_uri, ASANA.hasPhoto, photo_uri))
                    logger.info(f"[DEBUG ONTOLOGY] Added photo and source triples for photo {i+1}")
            else:
                logger.info(f"[DEBUG ONTOLOGY] No photos to add to existing asana")
            
            logger.info(f"Saving graph to {config.OWL_FILE_PATH}")
            g.serialize(destination=config.OWL_FILE_PATH, format="xml")
            logger.info("Successfully saved graph with added photos")
            
            return existing_asana_id
        else:
            # Создаем новую асану
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
                        logger.info(f"[DEBUG ONTOLOGY] Added S3 photo path: {photo_path}")
                    else:
                        logger.error(f"[ERROR ONTOLOGY] Invalid photo path format: {photo_path[:100]}...")
                        logger.error(f"[ERROR ONTOLOGY] Expected format: images/asans/uuid.jpg")
                        raise ValueError(f"Invalid photo path format. Expected S3 path (images/...), got: {photo_path[:100]}")
                    
                    g.add((photo_uri, ASANA.hasSource, source_uri))
                    g.add((asana_uri, ASANA.hasPhoto, photo_uri))
                    logger.info(f"[DEBUG ONTOLOGY] Added photo and source triples for photo {i+1}")
            else:
                logger.info(f"[DEBUG ONTOLOGY] Creating new asana without photos")
            
            logger.info(f"Saving graph to {config.OWL_FILE_PATH}")
            g.serialize(destination=config.OWL_FILE_PATH, format="xml")
            logger.info("Successfully saved graph")
            
            return str(asana_uri)
    except Exception as e:
        logger.error(f"Error adding asana: {str(e)}", exc_info=True)
        raise

def load_sources():
    logger.info("Starting to load sources from graph")
    g = get_graph()
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
        g.serialize(destination=config.OWL_FILE_PATH, format="xml")
        logger.info("Successfully saved graph")
        
        return str(source_uri)
    except Exception as e:
        logger.error(f"Error adding source: {str(e)}", exc_info=True)
        raise

def load_asana_names():
    logger.info("Starting to load asana names from graph")
    g = get_graph()
    names = []
    for name in g.subjects(RDF.type, ASANA.AsanaName):
        name_data = {
            "id": str(name),
            "name_ru": str(g.value(name, ASANA.nameInRussian)),
            "name_sanskrit": str(g.value(name, ASANA.nameInSanskrit)) if g.value(name, ASANA.nameInSanskrit) else "",
            "transliteration": str(g.value(name, ASANA.nameInTranslit)) if g.value(name, ASANA.nameInTranslit) else "",
            "definition": str(g.value(name, ASANA.OWLDataProperty_c8100b71_09ff_49ec_8fbf_63fa1be3947a)) if g.value(name, ASANA.OWLDataProperty_c8100b71_09ff_49ec_8fbf_63fa1be3947a) else ""
        }
        logger.debug(f"Loaded asana name: {name_data}")
        names.append(name_data)
    logger.info(f"Successfully loaded {len(names)} asana names")
    return names

def add_asana_name(name_data: Dict[str, str]) -> str:
    try:
        logger.info("Starting to add new asana name")
        logger.debug(f"Name data: {name_data}")
        
        g = get_graph()
        name_uri = URIRef(f"{ASANA}name_{uuid.uuid4()}")
        logger.debug(f"Created name URI: {name_uri}")
        
        g.add((name_uri, RDF.type, ASANA.AsanaName))
        g.add((name_uri, ASANA.nameInRussian, Literal(name_data["name_ru"])))
        if "name_sanskrit" in name_data and name_data["name_sanskrit"]:
            g.add((name_uri, ASANA.nameInSanskrit, Literal(name_data["name_sanskrit"])))
        if "transliteration" in name_data and name_data["transliteration"]:
            g.add((name_uri, ASANA.nameInTranslit, Literal(name_data["transliteration"])))
        if "definition" in name_data and name_data["definition"]:
            g.add((name_uri, ASANA.OWLDataProperty_c8100b71_09ff_49ec_8fbf_63fa1be3947a, Literal(name_data["definition"])))
        logger.debug("Added name triples")
        logger.info(f"Saving graph to {config.OWL_FILE_PATH}")
        g.serialize(destination=config.OWL_FILE_PATH, format="xml")
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
        g.serialize(destination=config.OWL_FILE_PATH, format="xml")
        print(f'УДАЛЁН(Ы): {uri}')
        return True
    except Exception as e:
        print(f'ОШИБКА ПРИ УДАЛЕНИИ: {e}')
        raise

def delete_source_from_ontology(source_id: str) -> bool:
    return delete_any_by_uri(source_id)

def delete_asana_name_from_ontology(name_id: str) -> bool:
    return delete_any_by_uri(name_id)

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
        # Найти все связанные фото
        photo_uris = list(g.objects(asana_uri, ASANA.hasPhoto))
        for photo_uri in photo_uris:
            # Удалить все триплеты, где фигурирует фото
            g.remove((photo_uri, None, None))
            g.remove((None, None, photo_uri))
        # Удалить все триплеты, где фигурирует асана
        g.remove((asana_uri, None, None))
        g.remove((None, None, asana_uri))
        g.serialize(destination=config.OWL_FILE_PATH, format="xml")
        print(f'Удалена асана и связанные фото: {asana_id}')
        return True
    except Exception as e:
        print(f'ОШИБКА ПРИ УДАЛЕНИИ АСАНЫ: {e}')
        raise

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
        photo_s3_path = upload_image_to_s3(photo_bytes, prefix="asans")
        logger.info(f"[DEBUG] Uploaded photo to S3: {photo_s3_path}")
        
        photo_uri = URIRef(f"{ASANA}photo_{uuid.uuid4()}")
        g.add((photo_uri, RDF.type, ASANA.AsanaPhoto))
        # Сохраняем S3 путь вместо base64
        # ВАЖНО: Записываем ТОЛЬКО s3PhotoPath, НИКОГДА base64Photo!
        # Дополнительная проверка: убеждаемся что это НЕ base64
        if len(photo_s3_path) > 1000 or 'data:' in photo_s3_path or photo_s3_path.startswith('iVBORw0KGgo'):
            logger.error(f"[ERROR ONTOLOGY] Photo path looks like base64! Length: {len(photo_s3_path)}, preview: {photo_s3_path[:100]}")
            raise ValueError(f"Photo path looks like base64 data! Expected S3 path, got suspicious data")
        g.add((photo_uri, ASANA.s3PhotoPath, Literal(photo_s3_path)))
        logger.info(f"[DEBUG ONTOLOGY] Added S3 photo path: {photo_s3_path}")
        
        # Если указан источник, добавляем его
        if source_id:
            source_uri = URIRef(source_id)
            g.add((photo_uri, ASANA.hasSource, source_uri))
            
        g.add((asana_uri, ASANA.hasPhoto, photo_uri))
        g.serialize(destination=config.OWL_FILE_PATH, format="xml")
        
        return str(photo_uri)
    except Exception as e:
        raise

# Получение асан по первой букве (для каталога по алфавиту)
def get_asanas_by_first_letter(letter: str):
    logger.info(f"Getting asanas starting with letter: {letter}")
    asanas = load_asanas()
    filtered_asanas = [asana for asana in asanas if asana["name"]["name_ru"] and asana["name"]["name_ru"][0].upper() == letter.upper()]
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