import { normalizeCatalogNameKey } from './catalogSearch';

/** Единый ключ id асаны для сравнения (полный URI, #asana_uuid, asana_uuid). */
export function canonicalAsanaId(raw) {
  if (raw == null || raw === '') return '';
  let s = String(raw).trim();
  const h = s.lastIndexOf('#');
  if (h !== -1) s = s.slice(h + 1);
  const sl = s.lastIndexOf('/');
  if (sl !== -1) s = s.slice(sl + 1);
  s = s.replace(/^asana_/i, '').toLowerCase();
  return s ? `asana_${s}` : '';
}

/** sameAs для конкретного объекта (owner): /similar только если это страница, иначе same_as_ids из каталога. */
export function combinedSameAsForOwner(
  ownerAsana,
  pageAsana,
  allAsanas,
  similarAsanasFromApi
) {
  if (!ownerAsana?.id) return [];
  const my = canonicalAsanaId(ownerAsana.id);
  const map = new Map();

  const byCanon = new Map();
  if (allAsanas?.length) {
    for (const a of allAsanas) {
      const k = canonicalAsanaId(a.id);
      if (k) byCanon.set(k, a);
    }
  }

  const put = (obj) => {
    if (!obj?.id) return;
    const k = canonicalAsanaId(obj.id);
    if (!k || k === my) return;
    const full = byCanon.get(k);
    const merged = full ? { ...obj, ...full, id: full.id ?? obj.id } : obj;
    if (!map.has(k)) map.set(k, merged);
  };

  const ownerIsPage =
    pageAsana && canonicalAsanaId(ownerAsana.id) === canonicalAsanaId(pageAsana.id);
  if (ownerIsPage) {
    for (const s of similarAsanasFromApi || []) put(s);
  }

  if (allAsanas?.length) {
    const tryAddRaw = (raw) => {
      const k = canonicalAsanaId(raw);
      if (!k || k === my || map.has(k)) return;
      const full = byCanon.get(k);
      if (full) map.set(k, full);
    };
    for (const raw of ownerAsana.same_as_ids || []) tryAddRaw(raw);
    for (const o of allAsanas) {
      const refs = o.same_as_ids || [];
      if (refs.some((ref) => canonicalAsanaId(ref) === my)) tryAddRaw(o.id);
    }
  }

  return Array.from(map.values()).map((obj) => {
    const k = canonicalAsanaId(obj.id);
    const full = k ? byCanon.get(k) : null;
    return full ? { ...obj, ...full, id: full.id ?? obj.id } : obj;
  });
}

/** Гость: только связи, у которых русское название отличается от названия группы. */
export function filterGuestSameAsDifferentGroupName(links, groupNameKey) {
  if (!links?.length) return [];
  const gk = groupNameKey || '';
  return links.filter((s) => {
    const sk = normalizeCatalogNameKey(s.name?.name_ru || '');
    return gk === '' || sk !== gk;
  });
}

export function captionFromSourceDoc(s) {
  if (!s) return '';
  return (
    [s.author, s.title].filter(Boolean).join(' — ') +
    (s.year != null && s.year !== '' ? ` (${s.year})` : '')
  );
}

/** Первое непустое «автор — название (год)» среди источников записи или у фото. */
export function pickEditionCaptionFromRecord(sim) {
  if (!sim) return '';
  for (const s of sim.sources || []) {
    const line = captionFromSourceDoc(s);
    if (line) return line;
  }
  for (const photo of sim.photos || []) {
    if (photo == null || typeof photo !== 'object') continue;
    const embed = photo.source;
    if (typeof embed !== 'object' || !embed) continue;
    const fromPhoto = captionFromSourceDoc(embed);
    if (fromPhoto) return fromPhoto;
  }
  return '';
}

export function catalogIdFallbackLabel(sim) {
  const raw =
    typeof sim?.id === 'string' ? sim.id.split('#').pop() || String(sim.id) : '';
  const short = raw.replace(/^asana_/i, '').replace(/^[^:]+:\s*\/?\/?#?\/?/i, '') || raw;
  if (short && short !== 'undefined') return `Каталожная запись · ${short}`;
  return 'источник не указан';
}

export function catalogRecordSecondaryParts(sim) {
  const edition = pickEditionCaptionFromRecord(sim);
  const secondary = edition || catalogIdFallbackLabel(sim);
  return { secondary, muted: !edition };
}

export function groupLightboxOtherNamesByDisplayRu(variants) {
  if (!variants?.length) return [];
  const map = new Map();
  for (const sim of variants) {
    const nk = normalizeCatalogNameKey(sim.name?.name_ru || '');
    const key = nk || `__id_${canonicalAsanaId(sim.id)}`;
    let g = map.get(key);
    if (!g) {
      g = {
        key,
        nameRu: (sim.name?.name_ru || '').trim() || 'Асана',
        items: [],
      };
      map.set(key, g);
    }
    g.items.push(sim);
    const nm = (sim.name?.name_ru || '').trim();
    if (nm && g.nameRu === 'Асана') g.nameRu = nm;
  }
  const out = [];
  for (const g of map.values()) {
    const seen = new Set();
    const editionLines = [];
    for (const sim of g.items) {
      const parts = catalogRecordSecondaryParts(sim);
      if (!seen.has(parts.secondary)) {
        seen.add(parts.secondary);
        editionLines.push({ secondary: parts.secondary, muted: parts.muted });
      }
    }
    const rep = [...g.items].sort((a, b) =>
      canonicalAsanaId(a.id).localeCompare(canonicalAsanaId(b.id))
    )[0];
    out.push({ ...g, editionLines, linkTarget: rep });
  }
  out.sort((a, b) =>
    (a.nameRu || '').localeCompare(b.nameRu || '', 'ru', { sensitivity: 'base' })
  );
  return out;
}

export function getPhotoSrc(photoData) {
  if (typeof photoData === 'object' && photoData?.image) {
    return photoData.image.startsWith('http') || photoData.image.startsWith('data:')
      ? photoData.image
      : `data:image/jpeg;base64,${photoData.image}`;
  }
  if (typeof photoData === 'string') {
    return photoData.startsWith('http') || photoData.startsWith('data:')
      ? photoData
      : `data:image/jpeg;base64,${photoData}`;
  }
  return photoData;
}

/** HTTP(S) URL картинки с cache-bust (важно после поворота — путь S3 тот же). */
export function galleryImageUrl(photo, photoGalleryVersion) {
  if (photo == null) return '';
  const sep = (url) => (url.includes('?') ? '&' : '?');
  const withBust = (url, hashPart) => {
    const h = hashPart ? String(hashPart) : '';
    const v = String(photoGalleryVersion ?? 0);
    const bust = h ? `v${v}_${h}` : `v${v}`;
    return `${url}${sep(url)}_cb=${encodeURIComponent(bust)}`;
  };
  if (typeof photo === 'string') {
    const u = getPhotoSrc(photo);
    if (!u || typeof u !== 'string' || u.startsWith('data:')) return u;
    return withBust(u, '');
  }
  const u =
    typeof photo === 'object' && photo.image ? getPhotoSrc(photo.image) : getPhotoSrc(photo);
  if (!u || typeof u !== 'string' || u.startsWith('data:')) return u;
  const hashKey =
    (typeof photo === 'object' &&
      (photo.photo_hash || photo.photo_dedup_fingerprint || photo.photoHash)) ||
    '';
  return withBust(u, hashKey);
}

/** Подпись «автор — название (год)» + linkId источника для фото (с фолбэком на единственный источник записи). */
export function buildPhotoSourceMeta(photo, ownerAsana) {
  let srcObj = null;
  let linkId = null;
  if (typeof photo === 'object' && photo?.source) {
    if (typeof photo.source === 'object' && photo.source.id) {
      linkId = photo.source.id.split('#').pop();
      srcObj =
        photo.source.author || photo.source.title
          ? photo.source
          : ownerAsana?.sources?.find((s) => (s.id?.split('#').pop() || s.id) === linkId) ||
            null;
    } else if (typeof photo.source === 'string') {
      linkId = photo.source.split('#').pop();
      srcObj =
        ownerAsana?.sources?.find((s) => (s.id?.split('#').pop() || s.id) === linkId) || null;
    }
  }
  if (!srcObj && ownerAsana?.sources?.length === 1) {
    srcObj = ownerAsana.sources[0];
    linkId = srcObj.id?.split('#').pop() || srcObj.id;
  }
  const caption = srcObj
    ? captionFromSourceDoc(srcObj) || 'Источник не указан'
    : 'Источник не указан';
  return { caption, linkId };
}

/** Все записи каталога с тем же русским названием. */
export function catalogGroupByNameRu(allAsanas, nameRu) {
  if (!Array.isArray(allAsanas)) return [];
  const key = normalizeCatalogNameKey(nameRu || '');
  if (!key) return [];
  return allAsanas.filter(
    (a) => normalizeCatalogNameKey(a.name?.name_ru || '') === key
  );
}

/** Представитель группы каталога по русскому названию (для sameAs / страницы асаны). */
export function catalogRepresentativeByNameRu(allAsanas, nameRu) {
  const group = catalogGroupByNameRu(allAsanas, nameRu);
  if (!group.length) return null;
  return [...group].sort((a, b) =>
    canonicalAsanaId(a.id).localeCompare(canonicalAsanaId(b.id))
  )[0];
}

/** Сформировать массив слайдов из массива асан: каждая фотография → отдельный слайд. */
export function buildSlidesFromAsanas(asanas, photoGalleryVersion) {
  const slides = [];
  if (!Array.isArray(asanas)) return slides;
  for (const own of asanas) {
    if (!own?.photos?.length) continue;
    own.photos.forEach((photo, idx) => {
      const { caption, linkId } = buildPhotoSourceMeta(photo, own);
      const img = galleryImageUrl(photo, photoGalleryVersion);
      const key =
        typeof photo === 'object' && photo.id ? String(photo.id) : `${own.id}#photo_${idx}`;
      slides.push({
        key,
        src: img,
        caption,
        linkId,
        ownerId: own.id,
        photo,
        photoIndexInOwner: idx,
      });
    });
  }
  return slides;
}
