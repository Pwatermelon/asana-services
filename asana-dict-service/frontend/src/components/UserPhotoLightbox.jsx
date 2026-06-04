import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { asanasAPI } from '../api/asanas';
import { useAuth } from '../contexts/AuthContext';
import { asanaPagePath } from './CompactAsanaRow';
import {
  canonicalAsanaId,
  combinedSameAsForOwner,
  catalogRecordSecondaryParts,
  catalogRepresentativeByNameRu,
  flattenLightboxOtherNameEntries,
  sameAsOtherNameVariantsForOwner,
  buildCorrespondencesListForOwner,
  mergeSameAsCluster,
  galleryImageUrl,
  getPhotoSrc,
  buildPhotoSourceMeta,
} from '../utils/asanaSameAs';
import { normalizeCatalogNameKey } from '../utils/catalogSearch';

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
 *  - renderEditionCaption(slide, ownerAsana) → ReactNode — рендер подписи под
 *                       картинкой в блоке «Это издание» (только editionStripVariant='edition').
 *  - editionStripVariant: 'edition' | 'asana-link' — на странице источника вместо
 *                       блока «Это издание» показывается ссылка на страницу асаны в каталоге.
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
  const [matchSubjectAsanaId, setMatchSubjectAsanaId] = useState(null);
  const [matchSearchQuery, setMatchSearchQuery] = useState('');
  const [selectedMatchAsana, setSelectedMatchAsana] = useState(null);

  const [showSameAsLinksModal, setShowSameAsLinksModal] = useState(false);
  const [sameAsLinksSubjectId, setSameAsLinksSubjectId] = useState(null);
  const [sameAsLinksSearchQuery, setSameAsLinksSearchQuery] = useState('');
  const [modalSimilarLinks, setModalSimilarLinks] = useState([]);
  const [modalCatalogPool, setModalCatalogPool] = useState([]);
  const [modalSimilarLoading, setModalSimilarLoading] = useState(false);

  const [matchAllCatalog, setMatchAllCatalog] = useState([]);
  const [matchExcludeLinkedCanon, setMatchExcludeLinkedCanon] = useState(() => new Set());
  const [matchSearchLoading, setMatchSearchLoading] = useState(false);

  /** Свежий /similar и полный кластер sameAs для лайтбокса (страница часто без всех связей). */
  const [lightboxSimilarFresh, setLightboxSimilarFresh] = useState([]);
  const [lightboxAsanasPool, setLightboxAsanasPool] = useState([]);

  const [showAddPhotoForm, setShowAddPhotoForm] = useState(false);
  const [addPhotoTarget, setAddPhotoTarget] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);

  const [showPhotoEditorModal, setShowPhotoEditorModal] = useState(false);
  const [photoEditorContext, setPhotoEditorContext] = useState(null);
  const [editorRotationDeg, setEditorRotationDeg] = useState(0);
  const [editorSaving, setEditorSaving] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [index, open]);

  useEffect(() => {
    if (!open) return undefined;
    const len = slides.length;
    if (len === 0) return undefined;
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
  }, [open, slides, onClose, setIndex]);

  useEffect(() => {
    if (!open) return;
    if (!slides.length) return;
    if (index >= slides.length) setIndex(slides.length - 1);
  }, [open, slides, index, setIndex]);

  const lbSlide = slides[index] || null;

  const effectiveSimilarAsanas = useMemo(() => {
    const byK = new Map();
    const ingest = (s) => {
      if (!s?.id) return;
      const k = canonicalAsanaId(s.id);
      if (!k) return;
      const prev = byK.get(k);
      byK.set(
        k,
        prev
          ? {
              ...prev,
              ...s,
              id: s.id ?? prev.id,
              same_as_link_inferred:
                prev.same_as_link_inferred === true || s.same_as_link_inferred === true,
            }
          : s
      );
    };
    for (const s of similarAsanas || []) ingest(s);
    for (const s of lightboxSimilarFresh || []) ingest(s);
    return [...byK.values()];
  }, [similarAsanas, lightboxSimilarFresh]);

  const effectiveAllAsanas = useMemo(() => {
    if (lightboxAsanasPool.length) return lightboxAsanasPool;
    return allAsanas;
  }, [lightboxAsanasPool, allAsanas]);

  const lbSlideOwnerFull = useMemo(() => {
    if (!lbSlide || !effectiveAllAsanas.length) return null;
    return (
      effectiveAllAsanas.find((a) => a.id === lbSlide.ownerId) ||
      effectiveAllAsanas.find(
        (a) => canonicalAsanaId(a.id) === canonicalAsanaId(lbSlide.ownerId)
      ) ||
      null
    );
  }, [lbSlide, effectiveAllAsanas]);

  useEffect(() => {
    if (!open || !lbSlide?.ownerId) {
      setLightboxSimilarFresh([]);
      setLightboxAsanasPool([]);
      return undefined;
    }
    const ownerFromPage =
      allAsanas.find((a) => a.id === lbSlide.ownerId) ||
      allAsanas.find(
        (a) => canonicalAsanaId(a.id) === canonicalAsanaId(lbSlide.ownerId)
      );
    if (!ownerFromPage?.id) {
      setLightboxSimilarFresh([]);
      setLightboxAsanasPool([]);
      return undefined;
    }
    let cancelled = false;
    const ownerId = ownerFromPage.id;
    (async () => {
      try {
        const similar = await asanasAPI.getSimilarAsanas(ownerId).catch(() => []);
        if (cancelled) return;
        setLightboxSimilarFresh(similar || []);
        const pool = await mergeSameAsCluster([
          ...allAsanas,
          ...(similar || []),
          ownerFromPage,
        ]);
        if (!cancelled) setLightboxAsanasPool(pool);
      } catch {
        if (!cancelled) {
          setLightboxSimilarFresh([]);
          setLightboxAsanasPool([...allAsanas]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, lbSlide?.ownerId, lbSlide, allAsanas]);

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
    if (!open || !lbSlide || !effectiveAllAsanas.length) return [];
    const owner = lbSlideOwnerFull;
    if (!owner) return [];
    const nameLower = owner.name?.name_ru?.toLowerCase().trim();
    if (!nameLower) return [];
    const lid = lbSlide.linkId;
    const linked = combinedSameAsForOwner(
      owner,
      effectivePageAsana,
      effectiveAllAsanas,
      effectiveSimilarAsanas
    );
    const out = [];
    for (const other of linked) {
      if (canonicalAsanaId(other.id) === canonicalAsanaId(owner.id)) continue;
      if (other.name?.name_ru?.toLowerCase().trim() !== nameLower) continue;
      if (!other.photos?.length) continue;
      other.photos.forEach((photo, idx) => {
        const { caption, linkId: pLid } = buildPhotoSourceMeta(photo, other);
        if (lid && pLid === lid) return;
        const img = galleryImageUrl(photo, photoGalleryVersion);
        const key =
          typeof photo === 'object' && photo.id ? String(photo.id) : `${other.id}#photo_${idx}`;
        out.push({
          key,
          src: img,
          caption,
          linkId: pLid,
          ownerId: other.id,
          photo,
          photoIndexInOwner: idx,
        });
      });
    }
    return out;
  }, [
    open,
    lbSlide,
    lbSlideOwnerFull,
    effectiveAllAsanas,
    effectivePageAsana,
    effectiveSimilarAsanas,
    photoGalleryVersion,
  ]);

  const lightboxSameSourceSiblings = useMemo(() => {
    if (!lbSlide || !lbSlide.linkId) return [];
    return slides
      .map((slide, i) => ({ slide, i }))
      .filter(({ slide }) => slide.linkId === lbSlide.linkId);
  }, [slides, lbSlide]);

  const lightboxOtherNameVariants = useMemo(() => {
    if (!open || !lbSlide || !lbSlideOwnerFull) return [];
    return sameAsOtherNameVariantsForOwner(
      lbSlideOwnerFull,
      effectivePageAsana,
      effectiveAllAsanas,
      effectiveSimilarAsanas
    );
  }, [
    open,
    lbSlide,
    lbSlideOwnerFull,
    effectivePageAsana,
    effectiveAllAsanas,
    effectiveSimilarAsanas,
  ]);

  const lightboxOtherNameRows = useMemo(() => {
    if (!lightboxOtherNameVariants.length) return [];
    return flattenLightboxOtherNameEntries(
      lightboxOtherNameVariants,
      effectiveAllAsanas,
      photoGalleryVersion,
      effectivePageAsana
    );
  }, [lightboxOtherNameVariants, effectiveAllAsanas, photoGalleryVersion, effectivePageAsana]);

  const location = useLocation();

  const findAsanaById = (list, asanaId) => {
    if (!asanaId || !list?.length) return null;
    const canon = canonicalAsanaId(asanaId);
    return (
      list.find((a) => a.id === asanaId) ||
      list.find((a) => canonicalAsanaId(a.id) === canon) ||
      null
    );
  };

  useEffect(() => {
    if (!showSameAsLinksModal || !sameAsLinksSubjectId) {
      setModalSimilarLinks([]);
      setModalCatalogPool([]);
      setModalSimilarLoading(false);
      return undefined;
    }
    let cancelled = false;
    setModalSimilarLoading(true);
    (async () => {
      try {
        let owner = findAsanaById(allAsanas, sameAsLinksSubjectId);
        if (!owner) {
          owner = await asanasAPI.getById(sameAsLinksSubjectId).catch(() => null);
        }
        const similar = await asanasAPI
          .getSimilarAsanas(sameAsLinksSubjectId)
          .catch(() => []);
        if (cancelled) return;
        setModalSimilarLinks(similar || []);
        const pool = await mergeSameAsCluster([
          ...allAsanas,
          ...(owner ? [owner] : []),
          ...(similar || []),
        ]);
        if (!cancelled) setModalCatalogPool(pool);
      } catch {
        if (!cancelled) {
          setModalSimilarLinks([]);
          setModalCatalogPool([...allAsanas]);
        }
      } finally {
        if (!cancelled) setModalSimilarLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [showSameAsLinksModal, sameAsLinksSubjectId, allAsanas]);

  const sameAsLinksForModal = useMemo(() => {
    if (!showSameAsLinksModal || !sameAsLinksSubjectId) return [];
    const catalog =
      modalCatalogPool.length > 0 ? modalCatalogPool : effectiveAllAsanas;
    const owner = findAsanaById(catalog, sameAsLinksSubjectId);
    if (!owner) return [];

    const inferredByCanon = new Map();
    const similarUnion = [];
    const seenSimilar = new Set();
    for (const s of [...effectiveSimilarAsanas, ...modalSimilarLinks]) {
      const k = canonicalAsanaId(s?.id);
      if (!k || seenSimilar.has(k)) continue;
      seenSimilar.add(k);
      similarUnion.push(s);
      if (s.same_as_link_inferred === true) {
        inferredByCanon.set(k, true);
      }
    }

    return buildCorrespondencesListForOwner(
      owner,
      effectivePageAsana,
      catalog,
      similarUnion,
      inferredByCanon
    );
  }, [
    showSameAsLinksModal,
    sameAsLinksSubjectId,
    effectiveAllAsanas,
    modalCatalogPool,
    modalSimilarLinks,
    effectiveSimilarAsanas,
    effectivePageAsana,
  ]);

  useEffect(() => {
    if (!showMatchModal || !matchSubjectAsanaId) {
      setMatchAllCatalog([]);
      setMatchExcludeLinkedCanon(new Set());
      setMatchSearchLoading(false);
      return undefined;
    }
    let cancelled = false;
    setMatchSearchLoading(true);
    (async () => {
      try {
        const [all, similar] = await Promise.all([
          asanasAPI.getAll(),
          asanasAPI.getSimilarAsanas(matchSubjectAsanaId).catch(() => []),
        ]);
        if (cancelled) return;
        setMatchAllCatalog(Array.isArray(all) ? all : []);
        const linked = new Set();
        for (const s of similar || []) {
          const k = canonicalAsanaId(s?.id);
          if (k) linked.add(k);
        }
        setMatchExcludeLinkedCanon(linked);
      } catch {
        if (!cancelled) {
          setMatchAllCatalog([]);
          setMatchExcludeLinkedCanon(new Set());
        }
      } finally {
        if (!cancelled) setMatchSearchLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showMatchModal, matchSubjectAsanaId]);

  const filteredSameAsLinksForModal = useMemo(() => {
    const q = sameAsLinksSearchQuery.trim().toLowerCase();
    if (!q) return sameAsLinksForModal;
    return sameAsLinksForModal.filter((sim) => {
      const nameRu = sim.name?.name_ru?.toLowerCase() || '';
      const nameSa = sim.name?.name_sanskrit?.toLowerCase() || '';
      const edition = catalogRecordSecondaryParts(sim).secondary.toLowerCase();
      return nameRu.includes(q) || nameSa.includes(q) || edition.includes(q);
    });
  }, [sameAsLinksForModal, sameAsLinksSearchQuery]);

  const filteredAsanasForMatch = useMemo(() => {
    if (!matchAllCatalog.length || !matchSubjectAsanaId) return [];
    const excludeCanon = canonicalAsanaId(matchSubjectAsanaId);
    const q = matchSearchQuery.trim().toLowerCase();
    return matchAllCatalog
      .filter((a) => {
        const k = canonicalAsanaId(a.id);
        if (!k || k === excludeCanon || matchExcludeLinkedCanon.has(k)) return false;
        if (!q) return true;
        const nameRu = a.name?.name_ru?.toLowerCase() || '';
        const nameSa = a.name?.name_sanskrit?.toLowerCase() || '';
        const edition = catalogRecordSecondaryParts(a).secondary.toLowerCase();
        return nameRu.includes(q) || nameSa.includes(q) || edition.includes(q);
      })
      .slice(0, 150);
  }, [
    matchAllCatalog,
    matchSubjectAsanaId,
    matchSearchQuery,
    matchExcludeLinkedCanon,
  ]);

  const similarPreviewSrc = (similar) => {
    if (similar.photos?.length) {
      const p = similar.photos[0];
      return typeof p === 'object'
        ? galleryImageUrl(p, photoGalleryVersion)
        : galleryImageUrl({ image: p }, photoGalleryVersion);
    }
    if (similar.photo) {
      const ph = similar.photo;
      return typeof ph === 'object' && ph.image
        ? galleryImageUrl(ph, photoGalleryVersion)
        : galleryImageUrl({ image: ph }, photoGalleryVersion);
    }
    return null;
  };

  const handleDownloadPhoto = async () => {
    if (!lbSlide?.src) return;
    setMenuOpen(false);
    const baseName = titleParts.title || 'asana';
    const raw = baseName
      .replace(/[<>"/\\|?*\x00-\x1f]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 72);
    const filename = `${raw || 'asana'}_${index + 1}.jpg`;
    const url = lbSlide.src;
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

  const resolvePhotoIdForApi = (photo, photoIndex) => {
    if (typeof photo === 'object' && photo?.id) return photo.id;
    return `photo_${photoIndex}`;
  };

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

  const handleMatchAsana = async () => {
    if (!selectedMatchAsana || !matchSubjectAsanaId) return;
    try {
      await asanasAPI.setSameAsObject(matchSubjectAsanaId, selectedMatchAsana.id);
      setShowMatchModal(false);
      setSelectedMatchAsana(null);
      setMatchSearchQuery('');
      setMatchSubjectAsanaId(null);
      onMutation?.();
      alert('Совпадение успешно указано!');
    } catch (error) {
      alert('Ошибка при указании совпадения');
      console.error('Error setting same as object:', error);
    }
  };

  const handleRemoveSameAsForOwner = async (subjectOwnerId, targetAsanaId) => {
    if (!subjectOwnerId || !targetAsanaId) return;
    if (!window.confirm('Удалить соответствие с этой записью?')) return;
    try {
      await asanasAPI.removeSameAsObject(subjectOwnerId, targetAsanaId);
      onMutation?.();
    } catch (error) {
      alert('Ошибка при удалении соответствия');
      console.error('Error removing same as object:', error);
    }
  };

  const handleAssertExplicitSameAs = async (subjectId, targetId) => {
    if (!subjectId || !targetId) return;
    try {
      await asanasAPI.setSameAsObject(subjectId, targetId);
      const fresh = await asanasAPI.getSimilarAsanas(subjectId).catch(() => []);
      setModalSimilarLinks(fresh || []);
      await onMutation?.();
    } catch (error) {
      console.error('Error asserting sameAs:', error);
      alert('Не удалось сохранить явную связь в онтологии');
    }
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

  if (!open || !slides.length || !lbSlide) return null;

  const lightboxOverlay = (
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
            {slides.length > 1 && (
              <>
                <button
                  type="button"
                  className="user-photo-lightbox-nav user-photo-lightbox-nav--prev"
                  aria-label="Предыдущее фото"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIndex((i) => (i - 1 + slides.length) % slides.length);
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
                    setIndex((i) => (i + 1) % slides.length);
                  }}
                >
                  ›
                </button>
              </>
            )}
            <div className="user-photo-lightbox-imgwrap">
              <img src={lbSlide.src} alt="" />
            </div>
          </div>

          {slides.length > 1 && (
            <p className="user-photo-lightbox-counter">
              {index + 1} / {slides.length}
            </p>
          )}

          <div className="user-lightbox-source-strip" onClick={(e) => e.stopPropagation()}>
            {editionStripVariant === 'edition' ? (
              <>
                <h4 className="user-lightbox-source-strip-title">Это издание</h4>
                {lbSlide.caption ? (
                  <p className="user-lightbox-edition-caption">
                    {typeof renderEditionCaption === 'function'
                      ? renderEditionCaption(lbSlide, lbSlideOwnerFull)
                      : lbSlide.caption}
                  </p>
                ) : null}
              </>
            ) : editionStripVariant === 'asana-link' && lbSlideOwnerFull ? (
              <p className="user-lightbox-edition-caption">
                <Link
                  className="user-photo-source-caption-link user-photo-source-caption-link--on-dark"
                  to={asanaPagePath(lbSlideOwnerFull)}
                  onClick={(e) => e.stopPropagation()}
                >
                  {lbSlideOwnerFull.name?.name_ru || 'Открыть асану в каталоге'}
                </Link>
              </p>
            ) : null}

            {isExpertOrAdmin && lbSlide?.ownerId && (
              <div className="user-lightbox-expert-edition-actions">
                <button
                  type="button"
                  className="btn-secondary user-lightbox-expert-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!lbSlideOwnerFull) return;
                    setMatchSubjectAsanaId(lbSlideOwnerFull.id);
                    setMatchSearchQuery('');
                    setMatchAllCatalog([]);
                    setMatchExcludeLinkedCanon(new Set());
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
                    if (!lbSlideOwnerFull) return;
                    setSameAsLinksSubjectId(lbSlideOwnerFull.id);
                    setSameAsLinksSearchQuery('');
                    setShowSameAsLinksModal(true);
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
            )}

            {lightboxSameSourceSiblings.length > 1 && (
              <div
                className="user-lightbox-source-thumbs"
                role="tablist"
                aria-label="Другие фото этой асаны из этого издания"
              >
                {lightboxSameSourceSiblings.map(({ slide, i }) => (
                  <button
                    key={slide.key}
                    type="button"
                    role="tab"
                    aria-selected={i === index}
                    className={
                      i === index
                        ? 'user-lightbox-source-thumb user-lightbox-source-thumb--active'
                        : 'user-lightbox-source-thumb'
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      setIndex(i);
                    }}
                  >
                    <img src={slide.src} alt="" />
                  </button>
                ))}
              </div>
            )}

          </div>

          {lightboxSameNameLinkedPhotos.length > 0 && (
            <div
              className="user-lightbox-same-name-linked-strip"
              onClick={(e) => e.stopPropagation()}
            >
              <h4 className="user-lightbox-source-strip-title">
                Асана с тем же названием но в других источниках
              </h4>
              <div className="user-lightbox-same-name-linked-scroll">
                {lightboxSameNameLinkedPhotos.map((ph) => (
                  <button
                    key={ph.key}
                    type="button"
                    className="user-lightbox-same-name-linked-thumb"
                    title={ph.caption}
                    onClick={(e) => {
                      e.stopPropagation();
                      const idx = slides.findIndex((s) => s.key === ph.key);
                      if (idx >= 0) setIndex(idx);
                    }}
                  >
                    <img src={ph.src} alt="" />
                  </button>
                ))}
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
                  const rowTo = asanaPagePath(row.linkTarget);
                  return (
                    <li key={row.key} className="user-lightbox-other-source-row">
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
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

        </div>
      </div>
  );

  return (
    <>
      {typeof document !== 'undefined'
        ? createPortal(lightboxOverlay, document.body)
        : lightboxOverlay}

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

      {/* Модалка «Указать совпадение» */}
      {isExpertOrAdmin && showMatchModal && (
        <div
          className="modal-overlay asana-detail-overlay-top"
          onClick={() => {
            setShowMatchModal(false);
            setMatchSubjectAsanaId(null);
          }}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Указать совпадение</h3>
              <button
                className="modal-close"
                onClick={() => {
                  setShowMatchModal(false);
                  setMatchSubjectAsanaId(null);
                }}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="modal-search">
                <input
                  type="search"
                  placeholder="Поиск по каталогу…"
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
                {filteredAsanasForMatch.map((a) => (
                  <div
                    key={a.id}
                    className={`modal-asana-item ${
                      selectedMatchAsana?.id === a.id ? 'selected' : ''
                    }`}
                    onClick={() => setSelectedMatchAsana(a)}
                  >
                    {similarPreviewSrc(a) ? (
                      <img
                        src={similarPreviewSrc(a)}
                        alt={a.name?.name_ru}
                        className="modal-asana-thumb"
                      />
                    ) : (
                      <div className="modal-asana-thumb" style={{ background: '#eee' }} />
                    )}
                    <div className="modal-asana-info">
                      <div className="modal-asana-name">{a.name?.name_ru}</div>
                      <div className="modal-asana-source">
                        {catalogRecordSecondaryParts(a).secondary}
                      </div>
                    </div>
                  </div>
                ))}
                {filteredAsanasForMatch.length === 0 && (
                  <p style={{ textAlign: 'center', color: '#666' }}>Асаны не найдены</p>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowMatchModal(false);
                  setMatchSubjectAsanaId(null);
                }}
              >
                Отмена
              </button>
              <button
                className="btn-primary"
                onClick={handleMatchAsana}
                disabled={!selectedMatchAsana}
              >
                Указать совпадение
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка «Соответствия» */}
      {isExpertOrAdmin && showSameAsLinksModal && sameAsLinksSubjectId && (
        <div
          className="modal-overlay asana-detail-overlay-top"
          role="presentation"
          onClick={() => {
            setShowSameAsLinksModal(false);
            setSameAsLinksSubjectId(null);
            setSameAsLinksSearchQuery('');
          }}
        >
          <div
            className="modal-content asana-sameas-links-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 className="modal-title">Соответствия</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => {
                  setShowSameAsLinksModal(false);
                  setSameAsLinksSubjectId(null);
                  setSameAsLinksSearchQuery('');
                }}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              {modalSimilarLoading && sameAsLinksForModal.length === 0 ? (
                <p className="asana-sameas-links-empty">Загрузка соответствий…</p>
              ) : sameAsLinksForModal.length > 0 ? (
                <>
                  <div className="modal-search">
                    <input
                      type="search"
                      placeholder="Поиск по названию или изданию…"
                      value={sameAsLinksSearchQuery}
                      onChange={(e) => setSameAsLinksSearchQuery(e.target.value)}
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </div>
                  {filteredSameAsLinksForModal.length > 0 ? (
                <ul className="asana-sameas-links-list">
                  {filteredSameAsLinksForModal.map((sim) => {
                    const thumbSrc = similarPreviewSrc(sim);
                    const inferredLink = sim.same_as_link_inferred === true;
                    return (
                    <li
                      key={sim.id}
                      className={`asana-sameas-links-item${inferredLink ? ' asana-sameas-links-item--inferred' : ''}`}
                    >
                      <div className="asana-sameas-links-thumb-wrap">
                        {thumbSrc ? (
                          <img
                            src={thumbSrc}
                            alt=""
                            className="asana-sameas-links-thumb"
                          />
                        ) : (
                          <span className="asana-sameas-links-thumb-empty" aria-hidden>
                            —
                          </span>
                        )}
                      </div>
                      <div className="asana-sameas-links-item-info">
                        <div className="asana-sameas-links-name">
                          {sim.name?.name_ru || '—'}
                        </div>
                        {sim.name?.name_sanskrit && (
                          <div className="asana-sameas-links-sa">
                            {sim.name.name_sanskrit}
                          </div>
                        )}
                        <div className="asana-sameas-links-source">
                          {catalogRecordSecondaryParts(sim).secondary}
                        </div>
                        {inferredLink && (
                          <p className="asana-sameas-links-inferred-badge" role="note">
                            Связь выведена OWL reasoner. Сохраните явно, чтобы записать в
                            онтологию.
                          </p>
                        )}
                      </div>
                      <div className="asana-sameas-links-item-actions">
                        <Link
                          className="btn-secondary asana-sameas-links-open"
                          to={asanaPagePath(sim)}
                          onClick={() => {
                            setShowSameAsLinksModal(false);
                            setSameAsLinksSubjectId(null);
                            setSameAsLinksSearchQuery('');
                          }}
                        >
                          Открыть
                        </Link>
                        {inferredLink ? (
                          <button
                            type="button"
                            className="btn-primary asana-sameas-links-assert"
                            onClick={() =>
                              handleAssertExplicitSameAs(sameAsLinksSubjectId, sim.id)
                            }
                          >
                            Добавить явно
                          </button>
                        ) : sim.correspondence_kind === 'same_as' ? (
                          <button
                            type="button"
                            className="btn-secondary asana-sameas-links-remove"
                            onClick={() =>
                              handleRemoveSameAsForOwner(sameAsLinksSubjectId, sim.id)
                            }
                          >
                            Удалить соответствие
                          </button>
                        ) : null}
                      </div>
                    </li>
                    );
                  })}
                </ul>
                  ) : (
                    <p className="asana-sameas-links-empty">
                      По запросу «{sameAsLinksSearchQuery.trim()}» ничего не найдено
                    </p>
                  )}
                </>
              ) : (
                <p className="asana-sameas-links-empty">Соответствий не найдено.</p>
              )}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setShowSameAsLinksModal(false);
                  setSameAsLinksSubjectId(null);
                  setSameAsLinksSearchQuery('');
                }}
              >
                Закрыть
              </button>
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
