from rdflib import Graph, Namespace, URIRef, Literal, RDF
from app import config
from typing import Optional, Dict, Any
import uuid
import logging
import os
import base64

logger = logging.getLogger("asana_service.ontology")

ASANA = Namespace("http://www.semanticweb.org/platinum_watermelon/ontologies/Asana#")

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
        photos_base64 = [str(g.value(photo, ASANA.base64Photo)) for photo in photo_objs if g.value(photo, ASANA.base64Photo)]
        logger.debug(f"Photos count: {len(photos_base64)}")
        asana_data = {
            "id": str(asana),
            "name": name_data,
            "source": source_data,
            "photos": photos_base64,
            "photo": photos_base64[0] if photos_base64 else ""
        }
        logger.debug(f"Adding asana with ID: {asana_data['id']}")
        asanas.append(asana_data)
    logger.info(f"Successfully loaded {len(asanas)} asanas")
    return asanas

def add_asana(name_id: str, source_id: str, photo_base64: str):
    try:
        logger.info("Starting to add new asana")
        logger.debug(f"Parameters: name_id={name_id}, source_id={source_id}, photo_base64=<truncated>")
        
        g = get_graph()
        
        # Create new asana instance
        asana_uri = URIRef(f"{ASANA}asana_{uuid.uuid4()}")
        logger.debug(f"Created asana URI: {asana_uri}")
        
        g.add((asana_uri, RDF.type, ASANA.Asana))
        logger.debug("Added asana type triple")
        
        # Link existing name
        name_uri = URIRef(name_id)
        g.add((asana_uri, ASANA.hasName, name_uri))
        logger.debug(f"Linked name: {name_uri}")
        
        # Create and link photo
        photo_uri = URIRef(f"{ASANA}photo_{uuid.uuid4()}")
        logger.debug(f"Created photo URI: {photo_uri}")
        
        g.add((photo_uri, RDF.type, ASANA.AsanaPhoto))
        g.add((photo_uri, ASANA.base64Photo, Literal(photo_base64)))
        g.add((photo_uri, ASANA.hasSource, URIRef(source_id)))
        g.add((asana_uri, ASANA.hasPhoto, photo_uri))
        logger.debug("Added photo and source triples")
        
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

def add_source(source_data: Dict[str, Any]) -> str:
    try:
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
        photo_base64 = base64.b64encode(photo_bytes).decode()
        photo_uri = URIRef(f"{ASANA}photo_{uuid.uuid4()}")
        g.add((photo_uri, RDF.type, ASANA.AsanaPhoto))
        g.add((photo_uri, ASANA.base64Photo, Literal(photo_base64)))
        
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
        
        photos_base64 = [str(g.value(photo, ASANA.base64Photo)) for photo in source_photo_objs if g.value(photo, ASANA.base64Photo)]
        logger.debug(f"Found {len(photos_base64)} photos for asana {name_ru}")
        
        asana_data = {
            "id": str(asana_uri),
            "name": name_data,
            "photos": photos_base64,
            "photo": photos_base64[0] if photos_base64 else ""
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
    Возвращает base64 фото асаны по id асаны и id источника, если такое фото есть
    """
    g = get_graph()
    ASANA = Namespace("http://www.semanticweb.org/platinum_watermelon/ontologies/Asana#")
    asana_uri = URIRef(asana_id)
    source_uri = URIRef(source_id)
    # Найти все фото, связанные с асаной
    photo_uris = list(g.objects(asana_uri, ASANA.hasPhoto))
    for photo_uri in photo_uris:
        # Проверяем, связано ли фото с нужным источником
        if g.value(photo_uri, ASANA.hasSource) == source_uri:
            base64_photo = g.value(photo_uri, ASANA.base64Photo)
            if base64_photo:
                return str(base64_photo)
    return None