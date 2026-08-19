"""Генерация sitemap.xml для поисковых систем."""
from __future__ import annotations

import re
import unicodedata
from typing import Iterable, List, Tuple
from xml.sax.saxutils import escape

from app.ontology import load_catalog_entries, load_sources


def normalize_catalog_name_key(name: str) -> str:
    """Ключ для сравнения русских названий (как на фронте)."""
    if not name:
        return ""
    try:
        s = unicodedata.normalize("NFKC", str(name))
    except Exception:
        s = str(name)
    s = s.replace("\u00a0", " ")
    s = re.sub(r"[\u200b-\u200d\ufeff]", "", s)
    return " ".join(s.strip().lower().split())


def asana_page_path(asana_id: str) -> str:
    raw = str(asana_id or "").split("#")[-1]
    return f"/asana/{raw}-page" if raw else ""


def source_page_slug(source_id: str) -> str:
    raw = str(source_id or "").split("#")[-1]
    return str(raw).removeprefix("source_")


def _dedupe_catalog_paths(entries: Iterable[dict]) -> List[str]:
    seen: set[str] = set()
    paths: List[str] = []
    for entry in entries:
        name_ru = (entry.get("name") or {}).get("name_ru") or ""
        key = normalize_catalog_name_key(name_ru)
        if not key or key in seen:
            continue
        seen.add(key)
        path = asana_page_path(entry.get("id") or "")
        if path:
            paths.append(path)
    return paths


def collect_sitemap_paths() -> List[Tuple[str, str]]:
    """
    Возвращает пары (path, priority).
    Главная редиректит на /asanas — в карту сайта включаем целевую страницу каталога.
    """
    paths: List[Tuple[str, str]] = [
        ("/asanas", "1.0"),
        ("/sources", "0.8"),
        ("/about", "0.7"),
    ]

    for path in _dedupe_catalog_paths(load_catalog_entries()):
        paths.append((path, "0.7"))

    for source in load_sources():
        slug = source_page_slug(source.get("id") or "")
        if slug:
            paths.append((f"/sources/{slug}/asanas", "0.6"))

    return paths


def build_sitemap_xml(base_url: str) -> str:
    base = (base_url or "").strip().rstrip("/")
    if not base:
        base = "https://catalog-asan.ru"

    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]

    for path, priority in collect_sitemap_paths():
        loc = f"{base}{path}"
        lines.append("  <url>")
        lines.append(f"    <loc>{escape(loc)}</loc>")
        lines.append("    <changefreq>weekly</changefreq>")
        lines.append(f"    <priority>{priority}</priority>")
        lines.append("  </url>")

    lines.append("</urlset>")
    return "\n".join(lines) + "\n"
