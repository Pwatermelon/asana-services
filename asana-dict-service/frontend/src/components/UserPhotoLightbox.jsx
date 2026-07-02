import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { asanasAPI } from '../api/asanas';
import { useAuth } from '../contexts/AuthContext';
import { asanaPagePath, asanaPagePathSafe } from './CompactAsanaRow';
import {
  canonicalAsanaId,
  catalogRepresentativeByNameRu,
  galleryImageUrl,
  buildPhotoSourceMeta,
} from '../utils/asanaSameAs';
import {
  buildCorrespondencesListForPhoto,
  buildNotSameAsListForPhoto,
  canonicalPhotoId,
  decidedPhotoIdsForSubject,
  flattenCatalogPhotos,
  linkedPhotosOtherNames,
  linkedPhotosSameName,
  normalizeMatchCatalogRows,
  photoRowSecondaryParts,
  resolvePhotoId,
} from '../utils/photoSameAs';
import {
  buildFocusPhotoQuery,
  stashFocusPhoto,
  findSlideIndexByPhoto,
} from '../utils/catalogFocus';

const normRotation = (d) => ((d % 360) + 360) % 360;

/**
 * Универсальный лайтбокс фотографий асан со всеми боковыми блоками и модалками
 * эксперта. Может использоваться на странице асаны (по русскому имени) и на
 * странице источника.
 *
 * Контракт колбэков:
 *  - onMutation()     — родитель должен перезагрузить данные после успешной
 *                       мутации (delete photo, rotate photo, sameAs изменения,
 *                       добавление фото).
 *  - onAsanaDeleted() — вызывается, когда из-за удаления последнего фото
 *                       (или явного удаления сущности) исчезла запись асаны.
 *                       Родитель решает, что сделать (например, навигировать).
 *  - renderEditionCaption(slide, ownerAsana) → ReactNode — ссылка на источник
 *                       под заголовком (editionStripVariant='edition').
 *  - editionStripVariant: 'edition' | 'asana-link' — на странице источника под
 *                       заголовком показывается ссылка на страницу асаны в каталоге.
 *  - getPageAsana(slide, ownerAsana) → asana — «страница» для sameAs/похожих (группа по имени).
 *  - getTitleParts(slide, ownerAsana, defaultTitle) → { title, subtitle? } —
 *                       заголовок и подзаголовок над фото.
 */
export default function UserPhotoLightbox({
  open,
  onClose,
  slides,
  index,
  setIndex,
  allAsanas = [],
  similarAsanas = [],
  pageAsana = null,
  getPageAsana = null,
  photoGalleryVersion = 0,
  onMutation,
  onAsanaDeleted,
  renderEditionCaption,
  editionStripVariant = 'edition',
  getTitleParts,
}) {
  const { isExpertOrAdmin } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchSubjectPhotoId, setMatchSubjectPhotoId] = useState(null);
  const [matchSearchQuery, setMatchSearchQuery] = useState('');
  const [matchAllPhotos, setMatchAllPhotos] = useState([]);
  const [matchExcludePhotoIds, setMatchExcludePhotoIds] = useState(() => new Set());
  const [matchSearchLoading, setMatchSearchLoading] = useState(false);
  const [matchCatalogLoaded, setMatchCatalogLoaded] = useState(false);

  const [showViewLinksModal, setShowViewLinksModal] = useState(false);
  const [viewLinksSubjectPhotoId, setViewLinksSubjectPhotoId] = useState(null);
  /** same | not_same — вкладки только в модалке просмотра */
  const [viewLinksTab, setViewLinksTab] = useState('same');
  const [viewLinksSearchQuery, setViewLinksSearchQuery] = useState('');
  const [modalSimilarLinks, setModalSimilarLinks] = useState([]);
  const [modalNotSameLinks, setModalNotSameLinks] = useState([]);
  const [viewLinksLoading, setViewLinksLoading] = useState(false);

  /** Свежий /api/photo/{id}/similar для текущего слайда. */
  const [lightboxSimilarFresh, setLightboxSimilarFresh] = useState([]);

  const [showAddPhotoForm, setShowAddPhotoForm] = useState(false);
  const [addPhotoTarget, setAddPhotoTarget] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);

  const [showPhotoEditorModal, setShowPhotoEditorModal] = useState(false);
  const [photoEditorContext, setPhotoEditorContext] = useState(null);
  const [editorRotationDeg, setEditorRotationDeg] = useState(0);
  const [editorSaving, setEditorSaving] = useState(false);
  const [linksRefreshTick, setLinksRefreshTick] = useState(0);

  const stableSlidesRef = useRef([]);
  const lastGoodSlideRef = useRef(null);
  const displaySlides = useMemo(() => {
    if (slides.length > 0) {
      stableSlidesRef.current = slides;
      return slides;
    }
    if (open && stableSlidesRef.current.length > 0) {
      return stableSlidesRef.current;
    }
    return slides;
  }, [slides, open]);

  useEffect(() => {
    if (!open) {
      stableSlidesRef.current = [];
      lastGoodSlideRef.current = null;
    }
  }, [open]);

  useEffect(() => () => {
    document.body.style.overflow = '';
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [index, open]);

  useEffect(() => {
    if (!open) {
      document.body.style.overflow = '';
      return undefined;
    }
    const len = displaySlides.length;
    if (len === 0) {
      document.body.style.overflow = 'hidden';
      const onKey = (e) => {
        if (e.key === 'Escape') onClose?.();
      };
      window.addEventListener('keydown', onKey);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', onKey);
      };
    }
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setIndex((i) => (i - 1 + len) % len);
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setIndex((i) => (i + 1) % len);
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open, displaySlides, onClose, setIndex]);

  useEffect(() => {
    if (!open) return;
    if (!displaySlides.length) return;
    if (index >= displaySlides.length) setIndex(displaySlides.length - 1);
    else if (index < 0) setIndex(0);
  }, [open, displaySlides, index, setIndex]);

  const safeIndex =
    displaySlides.length > 0
      ? Math.max(0, Math.min(index, displaySlides.length - 1))
      : 0;
  const lbSlideFromArray =
    displaySlides.length > 0 ? displaySlides[safeIndex] : null;

  if (open && lbSlideFromArray) {
    lastGoodSlideRef.current = lbSlideFromArray;
  }

  const lbSlide =
    lbSlideFromArray || (open ? lastGoodSlideRef.current : null);
  const lbSlideSrc = lbSlide
    ? galleryImageUrl(lbSlide.photo, photoGalleryVersion) || lbSlide.src || ''
    : '';
  const lbSubjectPhotoId = useMemo(() => {
    if (!lbSlide) return null;
    return resolvePhotoId(lbSlide.photo, lbSlide.photoIndexInOwner);
  }, [lbSlide]);

  const effectiveSimilarPhotos = useMemo(() => {
    const byK = new Map();
    const ingest = (s) => {
      const pid = s?.photo_id || s?.id;
      if (!pid) return;
      const k = canonicalPhotoId(pid);
      if (!k) return;
      const prev = byK.get(k);
      byK.set(
        k,
        prev
          ? {
              ...prev,
              ...s,
              photo_id: pid,
              same_as_link_inferred:
                prev.same_as_link_inferred === true || s.same_as_link_inferred === true,
            }
          : { ...s, photo_id: pid }
      );
    };
    for (const s of lightboxSimilarFresh || []) ingest(s);
    return [...byK.values()];
  }, [lightboxSimilarFresh]);

  const lbSlideOwnerFull = useMemo(() => {
    if (!lbSlide || !allAsanas.length) return null;
    return (
      allAsanas.find((a) => a.id === lbSlide.ownerId) ||
      allAsanas.find(
        (a) => canonicalAsanaId(a.id) === canonicalAsanaId(lbSlide.ownerId)
      ) ||
      null
    );
  }, [lbSlide, allAsanas]);

  useEffect(() => {
    if (!open || !lbSubjectPhotoId) {
      setLightboxSimilarFresh([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const similar = await asanasAPI.getSimilarPhotos(lbSubjectPhotoId).catch(() => []);
        if (!cancelled) setLightboxSimilarFresh(similar || []);
      } catch {
        if (!cancelled) setLightboxSimilarFresh([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, lbSubjectPhotoId, photoGalleryVersion, linksRefreshTick]);

  const effectivePageAsana = useMemo(() => {
    if (typeof getPageAsana === 'function' && lbSlide && lbSlideOwnerFull) {
      try {
        return getPageAsana(lbSlide, lbSlideOwnerFull) || pageAsana;
      } catch {
        return pageAsana;
      }
    }
    return pageAsana;
  }, [getPageAsana, lbSlide, lbSlideOwnerFull, pageAsana]);

  const defaultTitle =
    lbSlideOwnerFull?.name?.name_ru || effectivePageAsana?.name?.name_ru || 'Асана';
  const titleParts = useMemo(() => {
    const fallback = { title: defaultTitle, subtitle: null };
    if (typeof getTitleParts === 'function' && lbSlide) {
      try {
        const r = getTitleParts(lbSlide, lbSlideOwnerFull, defaultTitle) || fallback;
        return {
          title: r.title || fallback.title,
          subtitle: r.subtitle || null,
        };
      } catch {
        return fallback;
      }
    }
    return fallback;
  }, [getTitleParts, lbSlide, lbSlideOwnerFull, defaultTitle]);

  const lightboxSameNameLinkedPhotos = useMemo(() => {
    if (!open || !lbSlideOwnerFull || !lbSubjectPhotoId) return [];
    const linked = linkedPhotosSameName(
      lbSlideOwnerFull,
      effectiveSimilarPhotos,
      lbSubjectPhotoId
    );
    return linked.map((p) => {
      const pid = p.photo_id || p.id;
      const thumb =
        p.image != null
          ? galleryImageUrl({ image: p.image }, photoGalleryVersion)
          : galleryImageUrl(p.photo || p, photoGalleryVersion);
      const srcCaption =
        p.source && typeof p.source === 'object'
          ? [p.source.author, p.source.title].filter(Boolean).join(' — ')
          : buildPhotoSourceMeta(p.photo, lbSlideOwnerFull).caption;
      return {
        key: canonicalPhotoId(pid) || String(pid),
        photo_id: pid,
        src: thumb,
        caption: srcCaption,
        asana_id: p.asana_id,
        nameRu: p.name?.name_ru || '',
      };
    });
  }, [open, lbSlideOwnerFull, lbSubjectPhotoId, effectiveSimilarPhotos, photoGalleryVersion]);

  const topbarSourceNode = useMemo(() => {
    if (!lbSlide) return null;
    if (editionStripVariant === 'edition') {
      if (!lbSlide.caption) return null;
      if (typeof renderEditionCaption === 'function') {
        return renderEditionCaption(lbSlide, lbSlideOwnerFull);
      }
      return lbSlide.caption;
    }
    if (editionStripVariant === 'asana-link' && lbSlideOwnerFull) {
      return (
        <Link
          className="user-photo-source-caption-link user-photo-source-caption-link--on-dark"
          to={asanaPagePath(lbSlideOwnerFull)}
          onClick={(e) => e.stopPropagation()}
        >
          {lbSlideOwnerFull.name?.name_ru || 'Открыть асану в каталоге'}
        </Link>
      );
    }
    return null;
  }, [lbSlide, lbSlideOwnerFull, editionStripVariant, renderEditionCaption]);

  const lightboxOtherNameRows = useMemo(() => {
    if (!open || !lbSlideOwnerFull || !lbSubjectPhotoId) return [];
    const linked = linkedPhotosOtherNames(
      lbSlideOwnerFull,
      effectiveSimilarPhotos,
      lbSubjectPhotoId
    );
    return linked
      .map((p) => {
        const nameRu = (p.name?.name_ru || '').trim() || 'Асана';
        const linkTarget =
          catalogRepresentativeByNameRu(allAsanas, nameRu) ||
          allAsanas.find((a) => a.id === p.asana_id) ||
          null;
        const thumb =
          p.image != null
            ? galleryImageUrl({ image: p.image }, photoGalleryVersion)
            : galleryImageUrl(p.photo || p, photoGalleryVersion);
        const sourceCaption =
          p.source && typeof p.source === 'object'
            ? [p.source.author, p.source.title].filter(Boolean).join(' — ') ||
              'Источник не указан'
            : 'Источник не указан';
        return {
          key: canonicalPhotoId(p.photo_id || p.id) || String(p.photo_id),
          nameRu,
          photoSrc: thumb,
          sourceCaption,
          sourceMuted: false,
          linkTarget,
        };
      })
      .sort((a, b) =>
        (a.nameRu || '').localeCompare(b.nameRu || '', 'ru', { sensitivity: 'base' })
      );
  }, [
    open,
    lbSlideOwnerFull,
    lbSubjectPhotoId,
    effectiveSimilarPhotos,
    allAsanas,
    photoGalleryVersion,
  ]);

  const location = useLocation();
  const navigate = useNavigate();

  const openLinkedPhotoInLightbox = (photoId, asanaId = null) => {
    const photoCanon = canonicalPhotoId(photoId);
    if (!photoCanon) return;

    const idx = findSlideIndexByPhoto(displaySlides, photoCanon);
    if (idx >= 0) {
      setIndex(idx);
      return;
    }

    const ownerCanon = asanaId ? canonicalAsanaId(asanaId) : null;
    const target =
      (ownerCanon &&
        allAsanas.find((a) => canonicalAsanaId(a.id) === ownerCanon)) ||
      null;
    if (!target) return;

    stashFocusPhoto(photoCanon, target.id);
    const path = asanaPagePath(target);
    const query = buildFocusPhotoQuery(photoCanon, target.id);
    onClose();
    navigate(`${path}?${query}`, {
      state: { focusPhoto: photoCanon, focusOwner: target.id },
    });
  };

  const closeMatchModal = () => {
    setShowMatchModal(false);
    setMatchSubjectPhotoId(null);
    setMatchSearchQuery('');
    setMatchCatalogLoaded(false);
  };

  const loadMatchCatalogRows = async () => {
    try {
      const index = await asanasAPI.getPhotosForMatch();
      const normalized = normalizeMatchCatalogRows(index, photoGalleryVersion);
      if (normalized.length) return normalized;
    } catch (err) {
      console.warn('getPhotosForMatch failed, falling back to getAll:', err);
    }
    try {
      const all = await asanasAPI.getAll();
      const normalized = normalizeMatchCatalogRows(all, photoGalleryVersion);
      if (normalized.length) return normalized;
    } catch (err) {
      console.warn('getAll for match modal failed:', err);
    }
    return normalizeMatchCatalogRows(allAsanas, photoGalleryVersion);
  };

  const closeViewLinksModal = () => {
    setShowViewLinksModal(false);
    setViewLinksSubjectPhotoId(null);
    setViewLinksSearchQuery('');
    setViewLinksTab('same');
  };

  const refreshMatchExclude = async (subjectPhotoId) => {
    if (!subjectPhotoId) return;
    const [similar, notSame] = await Promise.all([
      asanasAPI.getSimilarPhotos(subjectPhotoId).catch(() => []),
      asanasAPI.getNotSameAsPhotos(subjectPhotoId).catch(() => []),
    ]);
    let flat = matchAllPhotos;
    if (!flat.length) {
      flat = await loadMatchCatalogRows();
      if (flat.length) setMatchAllPhotos(flat);
    }
    setMatchExcludePhotoIds(
      decidedPhotoIdsForSubject(subjectPhotoId, similar, flat, notSame)
    );
  };

  const refreshViewLinkLists = async (subjectPhotoId) => {
    if (!subjectPhotoId) return;
    const [similar, notSame] = await Promise.all([
      asanasAPI.getSimilarPhotos(subjectPhotoId).catch(() => []),
      asanasAPI.getNotSameAsPhotos(subjectPhotoId).catch(() => []),
    ]);
    setModalSimilarLinks(similar || []);
    setModalNotSameLinks(notSame || []);
  };

  useEffect(() => {
    if (!showMatchModal || !matchSubjectPhotoId) {
      setMatchAllPhotos([]);
      setMatchExcludePhotoIds(new Set());
      setMatchSearchLoading(false);
      setMatchCatalogLoaded(false);
      return undefined;
    }
    let cancelled = false;
    const seedFlat = normalizeMatchCatalogRows(allAsanas, photoGalleryVersion);
    if (seedFlat.length) {
      setMatchAllPhotos(seedFlat);
    }
    setMatchSearchLoading(true);
    setMatchCatalogLoaded(false);
    (async () => {
      try {
        const [flat, similar, notSame] = await Promise.all([
          loadMatchCatalogRows(),
          asanasAPI.getSimilarPhotos(matchSubjectPhotoId).catch(() => []),
          asanasAPI.getNotSameAsPhotos(matchSubjectPhotoId).catch(() => []),
        ]);
        if (cancelled) return;
        setMatchAllPhotos(flat);
        setMatchCatalogLoaded(true);
        setMatchExcludePhotoIds(
          decidedPhotoIdsForSubject(matchSubjectPhotoId, similar, flat, notSame)
        );
      } catch {
        if (!cancelled) {
          const fallback = normalizeMatchCatalogRows(allAsanas, photoGalleryVersion);
          setMatchAllPhotos(fallback);
          setMatchCatalogLoaded(true);
          setMatchExcludePhotoIds(new Set([canonicalPhotoId(matchSubjectPhotoId)].filter(Boolean)));
        }
      } finally {
        if (!cancelled) setMatchSearchLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showMatchModal, matchSubjectPhotoId, photoGalleryVersion, allAsanas]);

  useEffect(() => {
    if (!showViewLinksModal || !viewLinksSubjectPhotoId) {
      setModalSimilarLinks([]);
      setModalNotSameLinks([]);
      setViewLinksLoading(false);
      return undefined;
    }
    let cancelled = false;
    setViewLinksLoading(true);
    (async () => {
      try {
        const [similar, notSame] = await Promise.all([
          asanasAPI.getSimilarPhotos(viewLinksSubjectPhotoId).catch(() => []),
          asanasAPI.getNotSameAsPhotos(viewLinksSubjectPhotoId).catch(() => []),
        ]);
        if (!cancelled) {
          setModalSimilarLinks(similar || []);
          setModalNotSameLinks(notSame || []);
        }
      } catch {
        if (!cancelled) {
          setModalSimilarLinks([]);
          setModalNotSameLinks([]);
        }
      } finally {
        if (!cancelled) setViewLinksLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showViewLinksModal, viewLinksSubjectPhotoId, photoGalleryVersion, linksRefreshTick]);

  const sameAsLinksForModal = useMemo(() => {
    if (!showViewLinksModal || !viewLinksSubjectPhotoId) return [];
    return buildCorrespondencesListForPhoto(viewLinksSubjectPhotoId, modalSimilarLinks);
  }, [showViewLinksModal, viewLinksSubjectPhotoId, modalSimilarLinks]);

  const notSameAsLinksForModal = useMemo(() => {
    if (!showViewLinksModal || !viewLinksSubjectPhotoId) return [];
    return buildNotSameAsListForPhoto(viewLinksSubjectPhotoId, modalNotSameLinks);
  }, [showViewLinksModal, viewLinksSubjectPhotoId, modalNotSameLinks]);

  const filteredSameAsLinksForModal = useMemo(() => {
    const q = viewLinksSearchQuery.trim().toLowerCase();
    if (!q) return sameAsLinksForModal;
    return sameAsLinksForModal.filter((row) => {
      const parts = photoRowSecondaryParts(row);
      const nameSa = row.name?.name_sanskrit?.toLowerCase() || '';
      return (
        parts.nameRu.toLowerCase().includes(q) ||
        nameSa.includes(q) ||
        parts.sourceCaption.toLowerCase().includes(q)
      );
    });
  }, [sameAsLinksForModal, viewLinksSearchQuery]);

  const filteredNotSameAsLinksForModal = useMemo(() => {
    const q = viewLinksSearchQuery.trim().toLowerCase();
    if (!q) return notSameAsLinksForModal;
    return notSameAsLinksForModal.filter((row) => {
      const parts = photoRowSecondaryParts(row);
      const nameSa = row.name?.name_sanskrit?.toLowerCase() || '';
      return (
        parts.nameRu.toLowerCase().includes(q) ||
        nameSa.includes(q) ||
        parts.sourceCaption.toLowerCase().includes(q)
      );
    });
  }, [notSameAsLinksForModal, viewLinksSearchQuery]);

  const filteredPhotosForMatch = useMemo(() => {
    if (!matchAllPhotos.length || !matchSubjectPhotoId) return [];
    return matchAllPhotos
      .filter((row) => {
        const k = canonicalPhotoId(row.photo_id);
        if (!k || matchExcludePhotoIds.has(k)) return false;
        const q = matchSearchQuery.trim().toLowerCase();
        if (!q) return true;
        const nameRu = row.nameRu?.toLowerCase() || '';
        const nameSa = row.nameSanskrit?.toLowerCase() || '';
        const src = row.sourceCaption?.toLowerCase() || '';
        return nameRu.includes(q) || nameSa.includes(q) || src.includes(q);
      })
      .slice(0, 150);
  }, [matchAllPhotos, matchSubjectPhotoId, matchSearchQuery, matchExcludePhotoIds]);

  const photoPreviewSrc = (row) => {
    if (row?.thumbSrc) return row.thumbSrc;
    if (row?.image) return galleryImageUrl({ image: row.image }, photoGalleryVersion);
    return null;
  };

  const refreshLinksOnly = async () => {
    setLinksRefreshTick((n) => n + 1);
    if (lbSubjectPhotoId) {
      try {
        const similar = await asanasAPI.getSimilarPhotos(lbSubjectPhotoId);
        setLightboxSimilarFresh(similar || []);
      } catch {
        /* keep previous */
      }
    }
  };

  const handleDownloadPhoto = async () => {
    if (!lbSlideSrc) return;
    setMenuOpen(false);
    const baseName = titleParts.title || 'asana';
    const raw = baseName
      .replace(/[<>"/\\|?*\x00-\x1f]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 72);
    const filename = `${raw || 'asana'}_${index + 1}.jpg`;
    const url = lbSlideSrc;
    try {
      if (url.startsWith('data:') || url.startsWith('blob:')) {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) throw new Error('fetch failed');
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      try {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch (e2) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
      console.warn('Download fallback:', err);
    }
  };

  const resolvePhotoIdForApi = (photo, photoIndex) => resolvePhotoId(photo, photoIndex);

  const openPhotoEditor = (photo, photoIndex, ownerAsanaId) => {
    const photoId = resolvePhotoIdForApi(photo, photoIndex);
    setPhotoEditorContext({
      photo,
      photoId,
      index: photoIndex,
      ownerAsanaId,
    });
    setEditorRotationDeg(0);
    setShowPhotoEditorModal(true);
  };

  const handlePhotoEditorCancel = () => {
    setShowPhotoEditorModal(false);
    setPhotoEditorContext(null);
    setEditorRotationDeg(0);
  };

  const handlePhotoEditorSave = async () => {
    const r = normRotation(editorRotationDeg);
    if (!photoEditorContext) return;
    if (r === 0) {
      handlePhotoEditorCancel();
      return;
    }
    if (![90, 180, 270].includes(r)) {
      alert('Некорректный угол поворота');
      return;
    }
    setEditorSaving(true);
    try {
      await asanasAPI.rotatePhoto(
        photoEditorContext.ownerAsanaId,
        photoEditorContext.photoId,
        r
      );
      handlePhotoEditorCancel();
      onMutation?.();
    } catch (error) {
      const detail = error.response?.data?.detail;
      alert(detail || error.message || 'Ошибка при повороте фотографии');
      console.error('Error rotating photo:', error);
    } finally {
      setEditorSaving(false);
    }
  };

  const handleDeletePhoto = async (photo, photoIndex, ownerAsanaId) => {
    if (!photo) return;
    const owner =
      allAsanas.find((a) => a.id === ownerAsanaId) ||
      allAsanas.find((a) => canonicalAsanaId(a.id) === canonicalAsanaId(ownerAsanaId));
    if (!owner) return;

    const photoCount = Array.isArray(owner.photos) ? owner.photos.length : 0;
    const isLastPhoto = photoCount === 1;
    const confirmText = isLastPhoto
      ? 'У этой асаны это последнее фото. После удаления запись асаны будет удалена целиком — иначе из того же источника нельзя будет снова прикрепить фотографии. Продолжить?'
      : 'Вы уверены, что хотите удалить это фото? Это действие нельзя отменить.';

    if (!window.confirm(confirmText)) return;

    try {
      const photoId = resolvePhotoIdForApi(photo, photoIndex);
      const data = await asanasAPI.deletePhoto(owner.id, photoId);
      if (data?.asana_deleted) {
        alert(data.message || 'Фото удалено. Запись асаны удалена — не осталось фотографий.');
        const isPageOwner =
          pageAsana && canonicalAsanaId(owner.id) === canonicalAsanaId(pageAsana.id);
        if (isPageOwner) {
          onAsanaDeleted?.(owner.id);
          return;
        }
        onMutation?.();
        return;
      }
      onMutation?.();
      alert(data?.message || 'Фотография успешно удалена');
    } catch (error) {
      alert('Ошибка при удалении фотографии');
      console.error('Error deleting photo:', error);
    }
  };

  const handleDeleteOwnerEntity = async (ownerId) => {
    if (!ownerId || !allAsanas.length) return;
    const own =
      allAsanas.find((a) => a.id === ownerId) ||
      allAsanas.find((a) => canonicalAsanaId(a.id) === canonicalAsanaId(ownerId));
    if (!own) return;
    const title = own.name?.name_ru || 'запись';
    if (
      !window.confirm(
        `Удалить каталожную запись «${title}» со всеми фотографиями этой сущности? Действие необратимо.`
      )
    ) {
      return;
    }
    try {
      await asanasAPI.delete(own.id);
      setMenuOpen(false);
      const isPageOwner =
        pageAsana && canonicalAsanaId(own.id) === canonicalAsanaId(pageAsana.id);
      if (isPageOwner) {
        onAsanaDeleted?.(own.id);
        return;
      }
      onClose?.();
      onMutation?.();
    } catch (err) {
      alert('Не удалось удалить запись');
      console.error(err);
    }
  };

  const enrichAsanasFromMatchRow = (targetPhotoId) => {
    const targetCanon = canonicalPhotoId(targetPhotoId);
    if (!targetCanon) return [];
    const row = matchAllPhotos.find(
      (r) => canonicalPhotoId(r.photo_id) === targetCanon
    );
    if (!row) return [];
    return [row.ownerId, row.ownerAsana?.id, row.asana_id].filter(Boolean);
  };

  const handleSameAsPhoto = async (targetPhotoId) => {
    if (!matchSubjectPhotoId || !targetPhotoId) return;
    const enrichIds = enrichAsanasFromMatchRow(targetPhotoId);
    try {
      await asanasAPI.setSameAsPhoto(matchSubjectPhotoId, targetPhotoId);
      await refreshMatchExclude(matchSubjectPhotoId);
      closeMatchModal();
      if (enrichIds.length) {
        onMutation?.({ bumpGallery: false, enrichAsanaIds: enrichIds });
      }
      await refreshLinksOnly();
    } catch (error) {
      const detail = error.response?.data?.detail;
      alert(detail || 'Ошибка при указании совпадения');
      console.error('Error setting same as photo:', error);
    }
  };

  const openMatchRowAsanaPage = (row) => {
    const ownerId = row.ownerId || row.ownerAsana?.id;
    if (!ownerId) return;
    const photoCanon = canonicalPhotoId(row.photo_id);
    if (!photoCanon) return;

    closeMatchModal();

    /* Та же страница / та же группа по имени — переключить кадр в текущем лайтбоксе. */
    if (open && displaySlides.length) {
      const idx = findSlideIndexByPhoto(displaySlides, photoCanon);
      if (idx >= 0) {
        setIndex(idx);
        return;
      }
    }

    const target =
      catalogRepresentativeByNameRu(allAsanas, row.nameRu) ||
      row.ownerAsana ||
      allAsanas.find((a) => canonicalAsanaId(a.id) === canonicalAsanaId(ownerId)) ||
      { id: ownerId, name: { name_ru: row.nameRu || 'Асана' } };

    stashFocusPhoto(photoCanon, ownerId);
    const path = asanaPagePath(target);
    const query = buildFocusPhotoQuery(photoCanon, ownerId);
    onClose();
    navigate(`${path}?${query}`, { state: { focusPhoto: photoCanon, focusOwner: ownerId } });
  };

  const handleNotSameAsPhoto = async (targetPhotoId) => {
    if (!matchSubjectPhotoId || !targetPhotoId) return;
    if (!window.confirm('Пометить эти фото как «не соответствуют»?')) return;
    try {
      await asanasAPI.setNotSameAsPhoto(matchSubjectPhotoId, targetPhotoId);
      await refreshMatchExclude(matchSubjectPhotoId);
      closeMatchModal();
      await refreshLinksOnly();
    } catch (error) {
      const detail = error.response?.data?.detail;
      alert(detail || 'Ошибка при добавлении «не соответствует»');
      console.error('Error setting notSameAs photo:', error);
    }
  };

  const handleRemoveSameAsForPhoto = async (subjectPhotoId, targetPhotoId) => {
    if (!subjectPhotoId || !targetPhotoId) return;
    if (!window.confirm('Удалить соответствие с этим фото?')) return;
    try {
      await asanasAPI.removeSameAsPhoto(subjectPhotoId, targetPhotoId);
      await refreshViewLinkLists(subjectPhotoId);
      await refreshLinksOnly();
    } catch (error) {
      alert('Ошибка при удалении соответствия');
      console.error('Error removing same as photo:', error);
    }
  };

  const handleRemoveNotSameAsForPhoto = async (subjectPhotoId, targetPhotoId) => {
    if (!subjectPhotoId || !targetPhotoId) return;
    if (!window.confirm('Удалить пометку «не соответствует» для этой пары фото?')) return;
    try {
      await asanasAPI.removeNotSameAsPhoto(subjectPhotoId, targetPhotoId);
      await refreshViewLinkLists(subjectPhotoId);
      await refreshLinksOnly();
    } catch (error) {
      alert('Ошибка при удалении «не соответствует»');
      console.error('Error removing notSameAs photo:', error);
    }
  };

  const handleAssertExplicitSameAs = async (subjectPhotoId, targetPhotoId) => {
    if (!subjectPhotoId || !targetPhotoId) return;
    try {
      await asanasAPI.setSameAsPhoto(subjectPhotoId, targetPhotoId);
      await refreshViewLinkLists(subjectPhotoId);
      await refreshLinksOnly();
    } catch (error) {
      console.error('Error asserting sameAs:', error);
      const detail = error.response?.data?.detail;
      alert(detail || 'Не удалось сохранить явную связь в онтологии');
    }
  };

  const renderPhotoLinkRow = (row, actions) => {
    const parts = photoRowSecondaryParts(row);
    const targetPhotoId = row.photo_id || row.id;
    const thumbSrc =
      row.image != null
        ? galleryImageUrl({ image: row.image }, photoGalleryVersion)
        : photoPreviewSrc(row);
    const inferredLink = row.same_as_link_inferred === true;
    const linkTarget =
      catalogRepresentativeByNameRu(allAsanas, parts.nameRu) ||
      allAsanas.find((a) => a.id === row.asana_id);
    return (
      <li
        key={canonicalPhotoId(targetPhotoId)}
        className={`asana-sameas-links-item${
          inferredLink ? ' asana-sameas-links-item--inferred' : ''
        }${row.correspondence_kind === 'not_same_as' ? ' asana-sameas-links-item--not-same' : ''}`}
      >
        <div className="asana-sameas-links-thumb-wrap">
          {thumbSrc ? (
            <img src={thumbSrc} alt="" className="asana-sameas-links-thumb" />
          ) : (
            <span className="asana-sameas-links-thumb-empty" aria-hidden>
              —
            </span>
          )}
        </div>
        <div className="asana-sameas-links-item-info">
          <div className="asana-sameas-links-name">{parts.nameRu}</div>
          {row.name?.name_sanskrit && (
            <div className="asana-sameas-links-sa">{row.name.name_sanskrit}</div>
          )}
          <div className="asana-sameas-links-source">{parts.sourceCaption}</div>
          {inferredLink && (
            <p className="asana-sameas-links-inferred-badge" role="note">
              Связь выведена OWL reasoner. Сохраните явно, чтобы записать в онтологию.
            </p>
          )}
        </div>
        <div className="asana-sameas-links-item-actions">
          {linkTarget && (
            <Link
              className="btn-secondary asana-sameas-links-open"
              to={asanaPagePath(linkTarget)}
              onClick={closeViewLinksModal}
            >
              Открыть
            </Link>
          )}
          {actions}
        </div>
      </li>
    );
  };

  const handlePhotoSubmit = async (e) => {
    e.preventDefault();
    if (!photoFile || !addPhotoTarget?.ownerId || !addPhotoTarget?.sourceId) return;
    try {
      await asanasAPI.addPhoto(
        addPhotoTarget.ownerId,
        photoFile,
        addPhotoTarget.sourceId
      );
      setShowAddPhotoForm(false);
      setPhotoFile(null);
      setAddPhotoTarget(null);
      onMutation?.();
    } catch (error) {
      alert('Ошибка при добавлении фотографии');
      console.error('Error adding photo:', error);
    }
  };

  if (!open) return null;

  const waitingOverlay = !lbSlide ? (
    <div
      className="user-photo-lightbox user-photo-lightbox--waiting"
      role="dialog"
      aria-modal="true"
      aria-label="Загрузка фотографии"
      onClick={onClose}
    >
      <div className="user-photo-lightbox-waiting-inner" onClick={(e) => e.stopPropagation()}>
        <p>Загрузка фото…</p>
        <button type="button" className="btn-secondary" onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  ) : null;

  const lightboxOverlay = lbSlide ? (
      <div
        className="user-photo-lightbox"
        role="dialog"
        aria-modal="true"
        aria-label="Просмотр фотографий"
        onClick={onClose}
      >
        <div
          className="user-photo-lightbox-topbar"
          onClick={(e) => {
            e.stopPropagation();
            if (!e.target.closest('.user-lightbox-more-wrap')) {
              setMenuOpen(false);
            }
          }}
        >
            <div
              className="user-photo-lightbox-topbar-side user-photo-lightbox-topbar-side--left"
              aria-hidden="true"
            />
            <div className="user-photo-lightbox-topbar-center">
              <div className="user-photo-lightbox-catalog-title">
                {titleParts.title}
              </div>
              {titleParts.subtitle ? (
                <div className="user-photo-lightbox-catalog-subtitle">
                  {titleParts.subtitle}
                </div>
              ) : null}
              {topbarSourceNode ? (
                <div className="user-photo-lightbox-catalog-source">
                  {topbarSourceNode}
                </div>
              ) : null}
            </div>
            <div className="user-photo-lightbox-topbar-side user-photo-lightbox-topbar-side--right">
              <div className="user-lightbox-more-wrap">
                <button
                  type="button"
                  className="user-lightbox-more-btn"
                  aria-label="Меню"
                  aria-expanded={menuOpen}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen((v) => !v);
                  }}
                >
                  ⋯
                </button>
                {menuOpen && (
                  <div className="user-lightbox-more-menu" role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      className="user-lightbox-more-menu-item"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadPhoto();
                      }}
                    >
                      Скачать фото
                    </button>
                    {isExpertOrAdmin && lbSlide.photo && (
                      <>
                        <button
                          type="button"
                          role="menuitem"
                          className="user-lightbox-more-menu-item"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpen(false);
                            openPhotoEditor(
                              lbSlide.photo,
                              lbSlide.photoIndexInOwner,
                              lbSlide.ownerId
                            );
                          }}
                        >
                          Редактировать фото
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="user-lightbox-more-menu-item"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpen(false);
                            handleDeletePhoto(
                              lbSlide.photo,
                              lbSlide.photoIndexInOwner,
                              lbSlide.ownerId
                            );
                          }}
                        >
                          Удалить фото
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
              <button
                type="button"
                className="user-photo-lightbox-close"
                aria-label="Закрыть"
                onClick={onClose}
              >
                ×
              </button>
            </div>
          </div>

        <div
          className="user-photo-lightbox-inner"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="user-photo-lightbox-stage">
            {displaySlides.length > 1 && (
              <>
                <button
                  type="button"
                  className="user-photo-lightbox-nav user-photo-lightbox-nav--prev"
                  aria-label="Предыдущее фото"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIndex(
                      (i) => (i - 1 + displaySlides.length) % displaySlides.length
                    );
                  }}
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="user-photo-lightbox-nav user-photo-lightbox-nav--next"
                  aria-label="Следующее фото"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIndex((i) => (i + 1) % displaySlides.length);
                  }}
                >
                  ›
                </button>
              </>
            )}
            <div className="user-photo-lightbox-imgwrap">
              {lbSlideSrc ? (
                <img
                  key={`${lbSlide.key}-${photoGalleryVersion}`}
                  src={lbSlideSrc}
                  alt=""
                />
              ) : (
                <p className="user-photo-lightbox-img-missing">Не удалось загрузить изображение</p>
              )}
            </div>
          </div>

          {displaySlides.length > 1 && (
            <p className="user-photo-lightbox-counter">
              {safeIndex + 1} / {displaySlides.length}
            </p>
          )}

          {isExpertOrAdmin && lbSlide?.ownerId && (
            <div
              className="user-lightbox-source-strip user-lightbox-source-strip--actions-only"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="user-lightbox-expert-edition-actions">
                <button
                  type="button"
                  className="btn-secondary user-lightbox-expert-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!lbSlideOwnerFull || !lbSubjectPhotoId) return;
                    setMatchSubjectPhotoId(lbSubjectPhotoId);
                    setMatchSearchQuery('');
                    setShowMatchModal(true);
                  }}
                >
                  Указать соответствие
                </button>
                <button
                  type="button"
                  className="btn-secondary user-lightbox-expert-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!lbSubjectPhotoId) return;
                    if (!lbSubjectPhotoId) return;
                    setViewLinksSubjectPhotoId(lbSubjectPhotoId);
                    setViewLinksTab('same');
                    setViewLinksSearchQuery('');
                    setShowViewLinksModal(true);
                  }}
                >
                  Посмотреть соответствия
                </button>
                <button
                  type="button"
                  className="btn-primary user-lightbox-expert-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!lbSlideOwnerFull) return;
                    let sourceId = null;
                    if (lbSlide.linkId && lbSlideOwnerFull.sources?.length) {
                      const s = lbSlideOwnerFull.sources.find(
                        (x) => (x.id?.split('#').pop() || x.id) === lbSlide.linkId
                      );
                      if (s) sourceId = s.id;
                    }
                    if (!sourceId && lbSlideOwnerFull.sources?.length === 1) {
                      sourceId = lbSlideOwnerFull.sources[0].id;
                    }
                    if (!sourceId) {
                      alert('Не удалось определить источник для добавления фото.');
                      return;
                    }
                    setAddPhotoTarget({ ownerId: lbSlideOwnerFull.id, sourceId });
                    setShowAddPhotoForm(true);
                  }}
                >
                  Добавить фото
                </button>
                <button
                  type="button"
                  className="user-lightbox-expert-btn user-lightbox-expert-btn--entity-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteOwnerEntity(lbSlide.ownerId);
                  }}
                >
                  Удалить сущность
                </button>
              </div>
            </div>
          )}

          {lightboxSameNameLinkedPhotos.length > 0 && (
            <div
              className="user-lightbox-same-name-linked-strip"
              onClick={(e) => e.stopPropagation()}
            >
              <h4 className="user-lightbox-source-strip-title">
                Данная асана под таким же названием
              </h4>
              <div className="user-lightbox-same-name-linked-scroll">
                {lightboxSameNameLinkedPhotos.map((ph) => {
                  const isActive =
                    canonicalPhotoId(ph.photo_id) === canonicalPhotoId(lbSubjectPhotoId);
                  return (
                  <button
                    key={ph.key}
                    type="button"
                    className={
                      isActive
                        ? 'user-lightbox-same-name-linked-thumb user-lightbox-same-name-linked-thumb--active'
                        : 'user-lightbox-same-name-linked-thumb'
                    }
                    title={ph.caption}
                    aria-current={isActive ? 'true' : undefined}
                    onClick={(e) => {
                      e.stopPropagation();
                      openLinkedPhotoInLightbox(ph.photo_id, ph.asana_id);
                    }}
                  >
                    <img src={ph.src} alt="" />
                  </button>
                  );
                })}
              </div>
            </div>
          )}

          {lightboxOtherNameRows.length > 0 && (
            <div
              className="user-lightbox-other-sources-strip"
              onClick={(e) => e.stopPropagation()}
            >
              <h4 className="user-lightbox-source-strip-title">
                Данная асана под другими названиями
              </h4>
              <ul className="user-lightbox-other-sources-name-list">
                {lightboxOtherNameRows.map((row) => {
                  const rowTo =
                    asanaPagePathSafe(row.linkTarget) || asanaPagePathSafe(row.asanaId);
                  const rowInner = (
                    <div className="user-lightbox-other-source-row-inner user-lightbox-other-source-row-inner--with-photo">
                      <div className="user-lightbox-other-source-photo--row">
                        {row.photoSrc ? (
                          <img src={row.photoSrc} alt="" />
                        ) : (
                          <span className="user-lightbox-other-source-photo-empty">—</span>
                        )}
                      </div>
                      <div className="user-lightbox-other-source-name-cell">
                        <span className="user-lightbox-other-source-row-title-text">
                          {row.nameRu}
                        </span>
                        <span
                          className={
                            row.sourceMuted
                              ? 'user-lightbox-other-source-edition user-lightbox-other-source-edition--muted user-lightbox-other-source-edition--under-name'
                              : 'user-lightbox-other-source-edition user-lightbox-other-source-edition--under-name'
                          }
                        >
                          {row.sourceCaption}
                        </span>
                      </div>
                    </div>
                  );
                  return (
                    <li key={row.key} className="user-lightbox-other-source-row">
                      {rowTo ? (
                        <Link
                          to={rowTo}
                          className="user-lightbox-other-source-row-link"
                          onClick={(e) => {
                            e.stopPropagation();
                            onClose();
                            if (location.pathname === rowTo) {
                              e.preventDefault();
                            }
                          }}
                        >
                          {rowInner}
                        </Link>
                      ) : (
                        <div className="user-lightbox-other-source-row-link">{rowInner}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

        </div>
      </div>
  ) : null;

  return (
    <>
      {waitingOverlay &&
        (typeof document !== 'undefined'
          ? createPortal(waitingOverlay, document.body)
          : waitingOverlay)}
      {lightboxOverlay &&
        (typeof document !== 'undefined'
          ? createPortal(lightboxOverlay, document.body)
          : lightboxOverlay)}

      {/* Модалка добавления фото к конкретному источнику-владельцу */}
      {isExpertOrAdmin && showAddPhotoForm && (
        <div
          className="modal-overlay asana-detail-overlay-top"
          role="presentation"
          onClick={() => {
            setShowAddPhotoForm(false);
            setPhotoFile(null);
            setAddPhotoTarget(null);
          }}
        >
          <div
            className="add-photo-form add-photo-form--modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="form-title">Добавление фотографии</h3>
            <div
              className="form-group"
              style={{
                marginBottom: '1em',
                padding: '0.75em',
                background: 'var(--background-alt)',
                borderRadius: '8px',
              }}
            >
              <p
                style={{ color: 'var(--text-secondary)', fontSize: '0.9em', margin: 0 }}
              >
                <strong>Источник:</strong>{' '}
                {(() => {
                  const own =
                    allAsanas.find((a) => a.id === addPhotoTarget?.ownerId) ||
                    allAsanas.find(
                      (a) =>
                        canonicalAsanaId(a.id) ===
                        canonicalAsanaId(addPhotoTarget?.ownerId)
                    );
                  if (!own || !addPhotoTarget?.sourceId) return 'Источник не определен';
                  const sid =
                    addPhotoTarget.sourceId.split('#').pop() || addPhotoTarget.sourceId;
                  const src = own.sources?.find(
                    (s) => (s.id?.split('#').pop() || s.id) === sid
                  );
                  return src
                    ? `${src.author} — ${src.title}${
                        src.year != null && src.year !== '' ? ` (${src.year})` : ''
                      }`
                    : addPhotoTarget.sourceId;
                })()}
              </p>
            </div>
            <form onSubmit={handlePhotoSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="lb-add-photo">
                  Фотография *
                </label>
                <input
                  type="file"
                  id="lb-add-photo"
                  accept="image/*"
                  onChange={(e) => setPhotoFile(e.target.files[0])}
                  required
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="btn-primary">
                  Добавить
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowAddPhotoForm(false);
                    setPhotoFile(null);
                    setAddPhotoTarget(null);
                  }}
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модалка «Указать соответствие» */}
      {isExpertOrAdmin && showMatchModal && matchSubjectPhotoId && (
        <div
          className="modal-overlay asana-detail-overlay-top"
          onClick={closeMatchModal}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Указать соответствие</h3>
              <button type="button" className="modal-close" onClick={closeMatchModal}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="modal-search">
                <input
                  type="search"
                  placeholder="Поиск по названию или источнику…"
                  value={matchSearchQuery}
                  onChange={(e) => setMatchSearchQuery(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              {matchSearchLoading && (
                <p className="asana-sameas-links-empty">Загрузка каталога…</p>
              )}
              <div className="modal-asanas-list">
                {filteredPhotosForMatch.map((row) => {
                  const parts = photoRowSecondaryParts(row);
                  return (
                    <div key={row.photo_id} className="modal-asana-item">
                      <button
                        type="button"
                        className="modal-asana-item-open"
                        title={`Открыть страницу асаны: ${parts.nameRu}`}
                        onClick={() => openMatchRowAsanaPage(row)}
                      >
                        {photoPreviewSrc(row) ? (
                          <img
                            src={photoPreviewSrc(row)}
                            alt={parts.nameRu}
                            className="modal-asana-thumb"
                          />
                        ) : (
                          <div className="modal-asana-thumb" style={{ background: '#eee' }} />
                        )}
                        <div className="modal-asana-info">
                          <div className="modal-asana-name">{parts.nameRu}</div>
                          <div className="modal-asana-source">{parts.sourceCaption}</div>
                        </div>
                      </button>
                      <div className="modal-asana-item-actions">
                        <button
                          type="button"
                          className="btn-primary modal-asana-item-action-same"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSameAsPhoto(row.photo_id);
                          }}
                        >
                          Соответствует
                        </button>
                        <button
                          type="button"
                          className="btn-secondary asana-sameas-links-not-same"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNotSameAsPhoto(row.photo_id);
                          }}
                        >
                          Не соответствует
                        </button>
                      </div>
                    </div>
                  );
                })}
                {filteredPhotosForMatch.length === 0 && !matchSearchLoading && matchCatalogLoaded && (
                  <p style={{ textAlign: 'center', color: '#666' }}>
                    {matchAllPhotos.length === 0
                      ? 'Не удалось загрузить каталог фото. Обновите страницу и попробуйте снова.'
                      : matchSearchQuery.trim()
                        ? 'Ничего не найдено по запросу'
                        : 'Нет других фото для указания соответствия (все уже связаны или помечены «не соответствует»)'}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модалка «Посмотреть соответствия» — вкладки isSameAs / notSameAs */}
      {isExpertOrAdmin && showViewLinksModal && viewLinksSubjectPhotoId && (
        <div
          className="modal-overlay asana-detail-overlay-top"
          role="presentation"
          onClick={closeViewLinksModal}
        >
          <div
            className="modal-content asana-sameas-links-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 className="modal-title">Посмотреть соответствия</h3>
              <button type="button" className="modal-close" onClick={closeViewLinksModal}>
                ×
              </button>
            </div>

            <div className="photo-links-view-tabs" role="tablist" aria-label="Тип связи">
              <button
                type="button"
                role="tab"
                aria-selected={viewLinksTab === 'same'}
                className={`photo-links-view-tab${
                  viewLinksTab === 'same' ? ' photo-links-view-tab--active' : ''
                }`}
                onClick={() => setViewLinksTab('same')}
              >
                Соответствует ({sameAsLinksForModal.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewLinksTab === 'not_same'}
                className={`photo-links-view-tab${
                  viewLinksTab === 'not_same' ? ' photo-links-view-tab--active' : ''
                }`}
                onClick={() => setViewLinksTab('not_same')}
              >
                Не соответствует ({notSameAsLinksForModal.length})
              </button>
            </div>

            <div className="modal-body">
              {viewLinksLoading ? (
                <p className="asana-sameas-links-empty">Загрузка…</p>
              ) : (
                <>
                  <div className="modal-search">
                    <input
                      type="search"
                      placeholder="Поиск по названию или источнику…"
                      value={viewLinksSearchQuery}
                      onChange={(e) => setViewLinksSearchQuery(e.target.value)}
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </div>
                  {viewLinksTab === 'same' && (
                    <>
                      {filteredSameAsLinksForModal.length > 0 ? (
                        <ul className="asana-sameas-links-list">
                          {filteredSameAsLinksForModal.map((row) => {
                            const targetPhotoId = row.photo_id || row.id;
                            const inferredLink = row.same_as_link_inferred === true;
                            return renderPhotoLinkRow(
                              row,
                              inferredLink ? (
                                <>
                                  <button
                                    type="button"
                                    className="btn-primary asana-sameas-links-assert"
                                    onClick={() =>
                                      handleAssertExplicitSameAs(
                                        viewLinksSubjectPhotoId,
                                        targetPhotoId
                                      )
                                    }
                                  >
                                    Добавить явно
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-secondary asana-sameas-links-not-same"
                                    onClick={async () => {
                                      if (
                                        !window.confirm(
                                          'Пометить эти фото как «не соответствуют»? Выведенная reasoner связь isSameAs будет отменена.'
                                        )
                                      ) {
                                        return;
                                      }
                                      try {
                                        await asanasAPI.setNotSameAsPhoto(
                                          viewLinksSubjectPhotoId,
                                          targetPhotoId
                                        );
                                        await refreshViewLinkLists(viewLinksSubjectPhotoId);
                                        await refreshLinksOnly();
                                      } catch (error) {
                                        const detail = error.response?.data?.detail;
                                        alert(
                                          detail || 'Ошибка при добавлении «не соответствует»'
                                        );
                                      }
                                    }}
                                  >
                                    Не соответствует
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  className="btn-secondary asana-sameas-links-remove"
                                  onClick={() =>
                                    handleRemoveSameAsForPhoto(
                                      viewLinksSubjectPhotoId,
                                      targetPhotoId
                                    )
                                  }
                                >
                                  Удалить
                                </button>
                              )
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="asana-sameas-links-empty">
                          {viewLinksSearchQuery.trim()
                            ? `По запросу «${viewLinksSearchQuery.trim()}» ничего не найдено`
                            : 'Соответствий пока нет.'}
                        </p>
                      )}
                    </>
                  )}
                  {viewLinksTab === 'not_same' && (
                    <>
                      {filteredNotSameAsLinksForModal.length > 0 ? (
                        <ul className="asana-sameas-links-list">
                          {filteredNotSameAsLinksForModal.map((row) => {
                            const targetPhotoId = row.photo_id || row.id;
                            return renderPhotoLinkRow(
                              row,
                              <button
                                type="button"
                                className="btn-secondary asana-sameas-links-remove"
                                onClick={() =>
                                  handleRemoveNotSameAsForPhoto(
                                    viewLinksSubjectPhotoId,
                                    targetPhotoId
                                  )
                                }
                              >
                                Удалить
                              </button>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="asana-sameas-links-empty">
                          {viewLinksSearchQuery.trim()
                            ? `По запросу «${viewLinksSearchQuery.trim()}» ничего не найдено`
                            : 'Пометок «не соответствует» пока нет.'}
                        </p>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Редактор поворота фото */}
      {isExpertOrAdmin && showPhotoEditorModal && photoEditorContext && (
        <div
          className="modal-overlay asana-detail-overlay-top"
          onClick={() => !editorSaving && handlePhotoEditorCancel()}
        >
          <div
            className="modal-content photo-editor-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 className="modal-title">Редактировать фото</h3>
              <button
                type="button"
                className="modal-close"
                disabled={editorSaving}
                onClick={handlePhotoEditorCancel}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="photo-editor-preview-wrap">
                <img
                  src={galleryImageUrl(photoEditorContext.photo, photoGalleryVersion)}
                  alt=""
                  className="photo-editor-preview-img"
                  style={{ transform: `rotate(${editorRotationDeg}deg)` }}
                />
              </div>
              <div className="photo-editor-toolbar">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={editorSaving}
                  onClick={() => setEditorRotationDeg((d) => normRotation(d - 90))}
                >
                  ↺ −90°
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={editorSaving}
                  onClick={() => setEditorRotationDeg((d) => normRotation(d + 90))}
                >
                  ↻ +90°
                </button>
                <span className="photo-editor-angle">
                  <strong>{normRotation(editorRotationDeg) || 0}°</strong>
                </span>
              </div>
            </div>
            <div className="modal-footer photo-editor-footer">
              <button
                type="button"
                className="btn-secondary"
                disabled={editorSaving}
                onClick={handlePhotoEditorCancel}
              >
                Отмена
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={editorSaving || normRotation(editorRotationDeg) === 0}
                onClick={handlePhotoEditorSave}
              >
                {editorSaving ? 'Сохранение…' : 'Сохранить поворот'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
