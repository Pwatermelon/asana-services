import { normalizeCatalogNameKey } from './catalogSearch';
import {
  buildPhotoSourceMeta,
  canonicalAsanaId,
  captionFromSourceDoc,
  galleryImageUrl,
} from './asanaSameAs';

/** Единый ключ id фото для сравнения. */
export function canonicalPhotoId(raw) {
  if (raw == null || raw === '') return '';
  let s = String(raw).trim();
  const h = s.lastIndexOf('#');
  if (h !== -1) s = s.slice(h + 1);
  const sl = s.lastIndexOf('/');
  if (sl !== -1) s = s.slice(sl + 1);
  s = s.replace(/^photo_/i, '').toLowerCase();
  return s ? `photo_${s}` : '';
}

export function resolvePhotoId(photo, photoIndex = 0) {
  if (typeof photo === 'object' && photo?.id) return photo.id;
  if (typeof photo === 'object' && photo?.photo_id) return photo.photo_id;
  return `photo_${photoIndex}`;
}

/** Строки из /api/photos/for-match или flattenCatalogPhotos — с thumbSrc. */
export function normalizeMatchCatalogRows(rows, photoGalleryVersion = 0) {
  if (!Array.isArray(rows) || !rows.length) return [];
  if (rows[0]?.photo_id && rows[0]?.nameRu !== undefined) {
    return rows.map((row) => ({
      ...row,
      thumbSrc:
        row.thumbSrc || galleryImageUrl(row.photo || { image: row.image }, photoGalleryVersion),
    }));
  }
  return flattenCatalogPhotos(rows, photoGalleryVersion);
}

/** Все фото каталога с контекстом асаны и источника. */
export function flattenCatalogPhotos(allAsanas, photoGalleryVersion = 0) {
  const rows = [];
  if (!Array.isArray(allAsanas)) return rows;
  for (const asana of allAsanas) {
    if (!asana?.photos?.length) continue;
    asana.photos.forEach((photo, idx) => {
      const photoId = resolvePhotoId(photo, idx);
      const { caption, linkId } = buildPhotoSourceMeta(photo, asana);
      rows.push({
        photo_id: photoId,
        photo,
        photoIndexInOwner: idx,
        ownerAsana: asana,
        ownerId: asana.id,
        nameRu: asana.name?.name_ru || '',
        nameSanskrit: asana.name?.name_sanskrit || '',
        sourceCaption: caption,
        linkId,
        thumbSrc: galleryImageUrl(photo, photoGalleryVersion),
      });
    });
  }
  return rows;
}

/** Строки «Посмотреть соответствия» для текущего фото. */
export function buildCorrespondencesListForPhoto(subjectPhotoId, similarPhotos) {
  const subjectCanon = canonicalPhotoId(subjectPhotoId);
  if (!subjectCanon || !Array.isArray(similarPhotos)) return [];

  const byPhoto = new Map();
  for (const row of similarPhotos) {
    const pid = row.photo_id || row.id;
    const k = canonicalPhotoId(pid);
    if (!k || k === subjectCanon) continue;
    const merged = {
      ...row,
      photo_id: pid,
      same_as_link_inferred: row.same_as_link_inferred === true,
      not_same_as_link: row.not_same_as_link === true,
      correspondence_kind: row.not_same_as_link ? 'not_same_as' : 'same_as',
    };
    if (!byPhoto.has(k)) byPhoto.set(k, merged);
    else {
      const prev = byPhoto.get(k);
      byPhoto.set(k, {
        ...prev,
        ...merged,
        same_as_link_inferred: prev.same_as_link_inferred || merged.same_as_link_inferred,
      });
    }
  }

  return [...byPhoto.values()].sort((a, b) => {
    const na = (a.name?.name_ru || a.nameRu || '').trim();
    const nb = (b.name?.name_ru || b.nameRu || '').trim();
    const cmp = na.localeCompare(nb, 'ru', { sensitivity: 'base' });
    if (cmp !== 0) return cmp;
    return (a.sourceCaption || '').localeCompare(b.sourceCaption || '', 'ru');
  });
}

export function photoRowSecondaryParts(row) {
  const src =
    row.sourceCaption ||
    (row.source && captionFromSourceDoc(row.source)) ||
    '';
  const nameRu = row.name?.name_ru || row.nameRu || '—';
  return { nameRu, sourceCaption: src || 'Источник не указан' };
}

/** Связанные фото с тем же русским названием, что у владельца слайда. */
export function linkedPhotosSameName(ownerAsana, linkedPhotos, subjectPhotoId) {
  if (!ownerAsana || !linkedPhotos?.length) return [];
  const nameKey = normalizeCatalogNameKey(ownerAsana.name?.name_ru || '');
  const subjectCanon = canonicalPhotoId(subjectPhotoId);
  return linkedPhotos.filter((p) => {
    const k = canonicalPhotoId(p.photo_id || p.id);
    if (!k || k === subjectCanon) return false;
    const pk = normalizeCatalogNameKey(p.name?.name_ru || '');
    return nameKey && pk === nameKey;
  });
}

/** Связанные фото, у которых русское название асаны отличается от владельца. */
export function linkedPhotosOtherNames(ownerAsana, linkedPhotos, subjectPhotoId) {
  if (!ownerAsana || !linkedPhotos?.length) return [];
  const nameKey = normalizeCatalogNameKey(ownerAsana.name?.name_ru || '');
  const subjectCanon = canonicalPhotoId(subjectPhotoId);
  return linkedPhotos.filter((p) => {
    const k = canonicalPhotoId(p.photo_id || p.id);
    if (!k || k === subjectCanon) return false;
    const pk = normalizeCatalogNameKey(p.name?.name_ru || '');
    return !nameKey || pk !== nameKey;
  });
}

/** Строки «Не соответствует» для текущего фото. */
export function buildNotSameAsListForPhoto(subjectPhotoId, notSamePhotos) {
  const subjectCanon = canonicalPhotoId(subjectPhotoId);
  if (!subjectCanon || !Array.isArray(notSamePhotos)) return [];

  const byPhoto = new Map();
  for (const row of notSamePhotos) {
    const pid = row.photo_id || row.id;
    const k = canonicalPhotoId(pid);
    if (!k || k === subjectCanon) continue;
    byPhoto.set(k, {
      ...row,
      photo_id: pid,
      not_same_as_link: true,
      correspondence_kind: 'not_same_as',
    });
  }
  return [...byPhoto.values()].sort((a, b) => {
    const na = (a.name?.name_ru || a.nameRu || '').trim();
    const nb = (b.name?.name_ru || b.nameRu || '').trim();
    return na.localeCompare(nb, 'ru', { sensitivity: 'base' });
  });
}

/**
 * Id фото, которые не показываем в «Указать соответствие»:
 * — явный (asserted) sameAs и любой notSameAs;
 * — inferred sameAs НЕ скрываем: эксперт может пометить «не соответствует».
 */
export function decidedPhotoIdsForSubject(subjectPhotoId, similarPhotos, catalogPhotos, notSamePhotos = []) {
  const decided = new Set();
  const subjectCanon = canonicalPhotoId(subjectPhotoId);
  if (subjectCanon) decided.add(subjectCanon);

  for (const p of similarPhotos || []) {
    if (p.same_as_link_inferred === true) continue;
    const k = canonicalPhotoId(p.photo_id || p.id);
    if (k) decided.add(k);
  }

  for (const p of notSamePhotos || []) {
    const k = canonicalPhotoId(p.photo_id || p.id);
    if (k) decided.add(k);
  }

  const subjectRow = (catalogPhotos || []).find(
    (r) => canonicalPhotoId(r.photo_id) === subjectCanon
  );
  if (subjectRow?.photo && typeof subjectRow.photo === 'object') {
    for (const id of subjectRow.photo.same_as_photo_ids || []) {
      const k = canonicalPhotoId(id);
      if (k) decided.add(k);
    }
    for (const id of subjectRow.photo.not_same_as_photo_ids || []) {
      const k = canonicalPhotoId(id);
      if (k) decided.add(k);
    }
  }

  return decided;
}

export function findAsanaForPhotoRow(row, allAsanas) {
  if (row?.ownerAsana) return row.ownerAsana;
  const aid = row?.asana_id || row?.ownerId;
  if (!aid || !allAsanas?.length) return null;
  const canon = canonicalAsanaId(aid);
  return (
    allAsanas.find((a) => a.id === aid) ||
    allAsanas.find((a) => canonicalAsanaId(a.id) === canon) ||
    null
  );
}
