import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { asanasAPI } from '../api/asanas';
import { useAuth } from '../contexts/AuthContext';
import { normalizeCatalogNameKey } from '../utils/catalogSearch';
import '../styles/AsanaDetail.css';

/** Единый ключ id асаны для сравнения (полный URI, #asana_uuid, asana_uuid). */
function canonicalAsanaId(raw) {
  if (raw == null || raw === '') return '';
  let s = String(raw).trim();
  const h = s.lastIndexOf('#');
  if (h !== -1) s = s.slice(h + 1);
  const sl = s.lastIndexOf('/');
  if (sl !== -1) s = s.slice(sl + 1);
  s = s.replace(/^asana_/i, '').toLowerCase();
  return s ? `asana_${s}` : '';
}

/** sameAs для конкретного объекта асаны: /similar только если это страница (pageAsana), иначе same_as_ids из каталога. */
function combinedSameAsForOwner(ownerAsana, pageAsana, allAsanas, similarAsanasFromApi) {
  if (!ownerAsana?.id) return [];
  const my = canonicalAsanaId(ownerAsana.id);
  const map = new Map();

  const put = (obj) => {
    if (!obj?.id) return;
    const k = canonicalAsanaId(obj.id);
    if (!k || k === my) return;
    if (!map.has(k)) map.set(k, obj);
  };

  const ownerIsPage =
    pageAsana && canonicalAsanaId(ownerAsana.id) === canonicalAsanaId(pageAsana.id);
  if (ownerIsPage) {
    for (const s of similarAsanasFromApi || []) put(s);
  }

  if (allAsanas?.length) {
    const byCanon = new Map();
    for (const a of allAsanas) {
      const k = canonicalAsanaId(a.id);
      if (k) byCanon.set(k, a);
    }
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
  return Array.from(map.values());
}

/** Гость: только связи, у которых русское название отличается от названия группы (страница по имени). */
function filterGuestSameAsDifferentGroupName(links, groupNameKey) {
  if (!links?.length) return [];
  const gk = groupNameKey || '';
  return links.filter((s) => {
    const sk = normalizeCatalogNameKey(s.name?.name_ru || '');
    return gk === '' || sk !== gk;
  });
}

const AsanaDetail = () => {
  const params = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const id = params.id || params['id-page'] || params.idPage;
  const [asana, setAsana] = useState(null);
  const [allAsanas, setAllAsanas] = useState([]);
  const [similarAsanas, setSimilarAsanas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddPhotoForm, setShowAddPhotoForm] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [matchSearchQuery, setMatchSearchQuery] = useState('');
  const [selectedMatchAsana, setSelectedMatchAsana] = useState(null);
  const [photoMenuOpen, setPhotoMenuOpen] = useState(null); // ID фото, для которого открыто меню
  /** Сброс кэша браузера для URL картинок в S3 после поворота (тот же путь). */
  const [photoGalleryVersion, setPhotoGalleryVersion] = useState(0);
  const [showPhotoEditorModal, setShowPhotoEditorModal] = useState(false);
  const [photoEditorContext, setPhotoEditorContext] = useState(null);
  const [editorRotationDeg, setEditorRotationDeg] = useState(0);
  const [editorSaving, setEditorSaving] = useState(false);
  const [userLightboxOpen, setUserLightboxOpen] = useState(false);
  const [userLightboxIndex, setUserLightboxIndex] = useState(0);
  const [userLightboxMenuOpen, setUserLightboxMenuOpen] = useState(false);
  /** Гость: в лайтбоксе показывать только фото объекта с этим canonical id (переход из sameAs). */
  const [lightboxOwnerScope, setLightboxOwnerScope] = useState(null);
  const lastGuestRouteIdRef = React.useRef(null);
  const { isExpertOrAdmin } = useAuth();

  useEffect(() => {
    loadAsana();
    loadAllAsanas();
  }, [id]);

  const loadAsana = async () => {
    try {
      setError(null);
      setLoading(true);
      
      if (!id) {
        console.error('No asana ID provided in URL');
        setError('ID асаны не указан в URL');
        setLoading(false);
        return;
      }
      
      let asanaId = String(id);
      if (asanaId.endsWith('-page')) {
        asanaId = asanaId.replace('-page', '');
      }
      
      console.log('Loading asana with ID from URL:', asanaId);
      
      try {
        const asana = await asanasAPI.getById(asanaId);
        if (asana) {
          console.log('Found asana via getById:', asana.id);
          setAsana(asana);
          loadSimilarAsanas(asana);
          setLoading(false);
          return;
        } else {
          console.warn('getById returned null/undefined for ID:', asanaId);
        }
      } catch (apiError) {
        console.warn('getById failed, trying getAll:', apiError);
      }
      
      const allAsanas = await asanasAPI.getAll();
      console.log('Total asanas loaded:', allAsanas.length);
      
      const normalizedUrlId = asanaId.trim();
      
      const possibleIds = [
        normalizedUrlId,
        normalizedUrlId.startsWith('asana_') ? normalizedUrlId : `asana_${normalizedUrlId}`,
        normalizedUrlId.replace(/^asana_/, ''),
        `http://www.semanticweb.org/platinum_watermelon/ontologies/Asana#${normalizedUrlId}`,
        `http://www.semanticweb.org/platinum_watermelon/ontologies/Asana#${normalizedUrlId.startsWith('asana_') ? normalizedUrlId : `asana_${normalizedUrlId}`}`
      ];
      
      let foundAsana = null;
      
      for (const a of allAsanas) {
        const fullId = a.id;
        const shortId = fullId.split('#').pop();
        
        for (const possibleId of possibleIds) {
          if (fullId === possibleId || shortId === possibleId) {
            foundAsana = a;
            break;
          }
          
          const shortIdNoPrefix = shortId.replace(/^asana_/, '');
          const possibleIdNoPrefix = possibleId.replace(/^asana_/, '').replace(/^http.*#/, '');
          if (shortIdNoPrefix && possibleIdNoPrefix && shortIdNoPrefix === possibleIdNoPrefix) {
            foundAsana = a;
            break;
          }
        }
        
        if (foundAsana) break;
      }
      
      setAsana(foundAsana);
      if (!foundAsana) {
        setError(`Асана не найдена (ID: ${normalizedUrlId})`);
      } else {
        loadSimilarAsanas(foundAsana);
        setError(null);
      }
    } catch (error) {
      console.error('Error loading asana:', error);
      setError(`Ошибка при загрузке асаны: ${error.message || 'Неизвестная ошибка'}`);
    } finally {
      setLoading(false);
    }
  };

  const loadAllAsanas = async () => {
    try {
      const data = await asanasAPI.getAll();
      setAllAsanas(data);
    } catch (error) {
      console.error('Error loading all asanas:', error);
    }
  };

  const loadSimilarAsanas = async (currentAsana) => {
    if (!currentAsana) return;
    
    try {
      const similar = await asanasAPI.getSimilarAsanas(currentAsana.id);
      setSimilarAsanas(similar || []);
    } catch (error) {
      console.error('Error loading similar asanas:', error);
      setSimilarAsanas([]);
    }
  };


  const handlePhotoSubmit = async (e) => {
    e.preventDefault();
    if (!photoFile || !asana) return;

    // Автоматически определяем источник из асаны
    let sourceId = null;
    if (asana.sources && asana.sources.length > 0) {
      sourceId = asana.sources[0].id;
    } else if (asana.source) {
      // Если source - это объект с id
      if (typeof asana.source === 'object' && asana.source.id) {
        sourceId = asana.source.id;
      } 
      // Если source - это строка (ID)
      else if (typeof asana.source === 'string') {
        sourceId = asana.source;
      }
    }

    if (!sourceId) {
      alert('У асаны нет источника. Невозможно добавить фотографию.');
      return;
    }

    try {
      await asanasAPI.addPhoto(asana.id, photoFile, sourceId);
      loadAsana();
      setShowAddPhotoForm(false);
      setPhotoFile(null);
    } catch (error) {
      alert('Ошибка при добавлении фотографии');
      console.error('Error adding photo:', error);
    }
  };

  const handleMatchAsana = async () => {
    if (!selectedMatchAsana || !asana) return;
    
    try {
      await asanasAPI.setSameAsObject(asana.id, selectedMatchAsana.id);
      setShowMatchModal(false);
      setSelectedMatchAsana(null);
      setMatchSearchQuery('');
      loadSimilarAsanas(asana);
      alert('Совпадение успешно указано!');
    } catch (error) {
      alert('Ошибка при указании совпадения');
      console.error('Error setting same as object:', error);
    }
  };

  const handleRemoveSimilar = async (similarAsanaId) => {
    if (!window.confirm('Удалить связь с этой асаной?')) return;
    
    try {
      await asanasAPI.removeSameAsObject(asana.id, similarAsanaId);
      loadSimilarAsanas(asana);
    } catch (error) {
      alert('Ошибка при удалении связи');
      console.error('Error removing same as object:', error);
    }
  };

  const handleDownloadPhoto = async (photoData, photoIndex) => {
    try {
      const photoSrc = getPhotoSrc(photoData);
      const link = document.createElement('a');
      link.href = photoSrc;
      link.download = `asana_photo_${photoIndex + 1}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      alert('Ошибка при скачивании фотографии');
      console.error('Error downloading photo:', error);
    }
  };

  const resolvePhotoIdForApi = (photo, photoIndex) => {
    if (typeof photo === 'object' && photo.id) {
      return photo.id;
    }
    return `photo_${photoIndex}`;
  };

  const normEditorRotation = (d) => ((d % 360) + 360) % 360;

  const openPhotoEditor = (photo, photoIndex) => {
    const photoId = resolvePhotoIdForApi(photo, photoIndex);
    setPhotoEditorContext({ photo, photoId, index: photoIndex });
    setEditorRotationDeg(0);
    setShowPhotoEditorModal(true);
    setPhotoMenuOpen(null);
  };

  const handlePhotoEditorCancel = () => {
    setShowPhotoEditorModal(false);
    setPhotoEditorContext(null);
    setEditorRotationDeg(0);
  };

  const handlePhotoEditorSave = async () => {
    const r = normEditorRotation(editorRotationDeg);
    if (!photoEditorContext || !asana) return;
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
      await asanasAPI.rotatePhoto(asana.id, photoEditorContext.photoId, r);
      setPhotoGalleryVersion((v) => v + 1);
      handlePhotoEditorCancel();
      await loadAsana();
    } catch (error) {
      const detail = error.response?.data?.detail;
      alert(detail || error.message || 'Ошибка при повороте фотографии');
      console.error('Error rotating photo:', error);
    } finally {
      setEditorSaving(false);
    }
  };

  const handleDeletePhoto = async (photo, photoIndex) => {
    if (!asana || !photo) return;

    const photoCount = Array.isArray(asana.photos) ? asana.photos.length : 0;
    const isLastPhoto = photoCount === 1;
    const confirmText = isLastPhoto
      ? 'У этой асаны это последнее фото. После удаления запись асаны будет удалена целиком — иначе из того же источника нельзя будет снова прикрепить фотографии. Продолжить?'
      : 'Вы уверены, что хотите удалить это фото? Это действие нельзя отменить.';

    if (!window.confirm(confirmText)) {
      return;
    }

    try {
      let photoId = null;
      if (typeof photo === 'object' && photo.id) {
        photoId = photo.id;
      } else {
        photoId = `photo_${photoIndex}`;
      }

      const data = await asanasAPI.deletePhoto(asana.id, photoId);
      setPhotoMenuOpen(null);

      if (data?.asana_deleted) {
        alert(data.message || 'Фото удалено. Запись асаны удалена — не осталось фотографий.');
        navigate('/asanas');
        return;
      }

      await loadAsana();
      alert(data?.message || 'Фотография успешно удалена');
    } catch (error) {
      alert('Ошибка при удалении фотографии');
      console.error('Error deleting photo:', error);
    }
  };

  // Закрытие меню при клике вне его
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (photoMenuOpen && !event.target.closest('.photo-container')) {
        setPhotoMenuOpen(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [photoMenuOpen]);

  const getAsanaId = (a) => {
    return a.id.split('#').pop();
  };

  const getPhotoSrc = (photoData) => {
    if (typeof photoData === 'object' && photoData.image) {
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
  };

  const galleryImageUrl = (photo) => {
    const u = typeof photo === 'object' && photo.image ? getPhotoSrc(photo.image) : getPhotoSrc(photo);
    if (!u || typeof u !== 'string' || u.startsWith('data:')) return u;
    return `${u}${u.includes('?') ? '&' : '?'}_cb=${photoGalleryVersion}`;
  };

  /** Связи sameAs для асаны страницы (эксперт / общая логика). */
  const combinedSimilarAsanas = React.useMemo(() => {
    if (!asana) return [];
    return combinedSameAsForOwner(asana, asana, allAsanas, similarAsanas);
  }, [asana, allAsanas, similarAsanas]);

  /** Для гостя — только связанные записи с другим русским названием; для эксперта — все связи (кроме текущей по id). */
  const filteredSimilarAsanas = React.useMemo(() => {
    if (!asana) return [];
    const base = combinedSimilarAsanas;
    if (!base.length) return [];
    const my = canonicalAsanaId(asana.id);
    const myName = normalizeCatalogNameKey(asana.name?.name_ru || '');
    if (isExpertOrAdmin) {
      return base.filter((s) => canonicalAsanaId(s.id) !== my);
    }
    return base.filter((s) => {
      if (canonicalAsanaId(s.id) === my) return false;
      return myName === '' || normalizeCatalogNameKey(s.name?.name_ru || '') !== myName;
    });
  }, [combinedSimilarAsanas, asana, isExpertOrAdmin]);

  /** Все слайды галереи для гостя: объединение фото всех записей с тем же русским названием. */
  const userGallerySlides = React.useMemo(() => {
    if (isExpertOrAdmin || !asana || !allAsanas.length) return [];
    const name = asana.name?.name_ru?.toLowerCase().trim();
    if (!name) return [];
    const twins = allAsanas.filter((a) => a.name?.name_ru?.toLowerCase().trim() === name);
    const slides = [];

    const metaFor = (photo, own) => {
      let srcObj = null;
      let linkId = null;
      if (typeof photo === 'object' && photo.source) {
        if (typeof photo.source === 'object' && photo.source.id) {
          linkId = photo.source.id.split('#').pop();
          srcObj =
            photo.source.author || photo.source.title
              ? photo.source
              : own.sources?.find((s) => (s.id?.split('#').pop() || s.id) === linkId) || null;
        } else if (typeof photo.source === 'string') {
          linkId = photo.source.split('#').pop();
          srcObj = own.sources?.find((s) => (s.id?.split('#').pop() || s.id) === linkId) || null;
        }
      }
      if (!srcObj && own.sources?.length === 1) {
        srcObj = own.sources[0];
        linkId = srcObj.id?.split('#').pop() || srcObj.id;
      }
      const caption = srcObj
        ? [srcObj.author, srcObj.title].filter(Boolean).join(' — ') +
          (srcObj.year != null && srcObj.year !== '' ? ` (${srcObj.year})` : '')
        : 'Источник не указан';
      return { caption, linkId };
    };

    twins.forEach((own) => {
      if (!own.photos?.length) return;
      own.photos.forEach((photo, idx) => {
        const { caption, linkId } = metaFor(photo, own);
        const img =
          typeof photo === 'object' && photo.image ? getPhotoSrc(photo.image) : getPhotoSrc(photo);
        const key =
          typeof photo === 'object' && photo.id ? String(photo.id) : `${own.id}#photo_${idx}`;
        slides.push({ key, src: img, caption, linkId, ownerId: own.id });
      });
    });
    return slides;
  }, [isExpertOrAdmin, asana, allAsanas]);

  /** Слайды внутри лайтбокса: все фото группы или только выбранный объект (sameAs-переход). */
  const userLightboxSlides = React.useMemo(() => {
    if (isExpertOrAdmin || !lightboxOwnerScope) return userGallerySlides;
    const f = userGallerySlides.filter(
      (s) => canonicalAsanaId(s.ownerId) === lightboxOwnerScope
    );
    return f.length ? f : userGallerySlides;
  }, [isExpertOrAdmin, userGallerySlides, lightboxOwnerScope]);

  /** Гость, лайтбокс: sameAs с другим названием для объекта-владельца текущего кадра. */
  const lightboxOwnerGuestSameAs = React.useMemo(() => {
    if (isExpertOrAdmin || !userLightboxOpen || !allAsanas.length || !asana) return [];
    const slide = userLightboxSlides[userLightboxIndex];
    if (!slide?.ownerId) return [];
    const ownerAsana =
      allAsanas.find((a) => a.id === slide.ownerId) ||
      allAsanas.find((a) => canonicalAsanaId(a.id) === canonicalAsanaId(slide.ownerId));
    if (!ownerAsana) return [];
    const combined = combinedSameAsForOwner(ownerAsana, asana, allAsanas, similarAsanas);
    return filterGuestSameAsDifferentGroupName(
      combined,
      normalizeCatalogNameKey(asana.name?.name_ru || '')
    );
  }, [
    isExpertOrAdmin,
    userLightboxOpen,
    userLightboxIndex,
    userLightboxSlides,
    allAsanas,
    asana,
    similarAsanas,
  ]);

  React.useEffect(() => {
    if (isExpertOrAdmin) return;
    let routeId = id != null ? String(id) : '';
    if (routeId.endsWith('-page')) routeId = routeId.replace(/-page$/i, '');
    const prev = lastGuestRouteIdRef.current;
    if (prev !== null && prev !== routeId) {
      setUserLightboxOpen(false);
      setUserLightboxIndex(0);
      setLightboxOwnerScope(null);
      setUserLightboxMenuOpen(false);
    }
    lastGuestRouteIdRef.current = routeId;

    const focus = searchParams.get('focusOwner');
    if (!focus || !userGallerySlides.length) return;
    const canon = canonicalAsanaId(focus);
    const filtered = userGallerySlides.filter(
      (s) => canonicalAsanaId(s.ownerId) === canon
    );
    if (filtered.length) {
      setLightboxOwnerScope(canon);
      setUserLightboxIndex(0);
      setUserLightboxOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete('focusOwner');
      setSearchParams(next, { replace: true });
      return;
    }
    if (searchParams.has('focusOwner')) {
      const next = new URLSearchParams(searchParams);
      next.delete('focusOwner');
      setSearchParams(next, { replace: true });
    }
  }, [id, isExpertOrAdmin, searchParams, userGallerySlides, setSearchParams]);

  React.useEffect(() => {
    if (isExpertOrAdmin || userLightboxOpen) return;
    setLightboxOwnerScope(null);
  }, [isExpertOrAdmin, userLightboxOpen]);

  React.useEffect(() => {
    if (!userLightboxOpen || isExpertOrAdmin) return;
    if (!userLightboxSlides.length) return;
    setUserLightboxIndex((i) => Math.min(i, userLightboxSlides.length - 1));
  }, [userLightboxOpen, userLightboxSlides, isExpertOrAdmin]);

  React.useEffect(() => {
    setUserLightboxMenuOpen(false);
  }, [userLightboxIndex, userLightboxOpen]);

  React.useEffect(() => {
    if (!userLightboxOpen || isExpertOrAdmin) return;
    const len = userLightboxSlides.length;
    if (len === 0) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setUserLightboxOpen(false);
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setUserLightboxIndex((i) => (i - 1 + len) % len);
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setUserLightboxIndex((i) => (i + 1) % len);
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [userLightboxOpen, userLightboxSlides, isExpertOrAdmin]);

  // Фильтрация асан для модального окна
  const filteredAsanasForMatch = React.useMemo(() => {
    if (!allAsanas || !asana) return [];
    
    return allAsanas
      .filter((a) => a.id !== asana.id)
      .filter((a) => {
        if (!matchSearchQuery) return true;
        const query = matchSearchQuery.toLowerCase();
        return (
          a.name?.name_ru?.toLowerCase().includes(query) ||
          a.name?.name_sanskrit?.toLowerCase().includes(query)
        );
      })
      .slice(0, 20);
  }, [allAsanas, asana, matchSearchQuery]);

  if (loading) {
    return <div className="container">Загрузка...</div>;
  }

  if (error) {
    return (
      <div className="container">
        <div className="error-message">{error}</div>
        <p>Попробуйте вернуться к <a href="/asanas">списку асан</a></p>
      </div>
    );
  }

  if (!asana) {
    return (
      <div className="container">
        <div className="error-message">Асана не найдена</div>
        <p>Попробуйте вернуться к <a href="/asanas">списку асан</a></p>
      </div>
    );
  }

  // Рендер для обычных пользователей: одна галерея всех фото, подписи источников, карусель, связанные записи
  if (!isExpertOrAdmin) {
    const asanaName = asana.name?.name_ru?.toLowerCase().trim();
    const asanasWithSameName = allAsanas.filter(
      (a) => a.name?.name_ru?.toLowerCase().trim() === asanaName
    );
    const firstAsana = asanasWithSameName[0] || asana;
    const lbSlide = userLightboxSlides[userLightboxIndex];

    const similarPreviewSrc = (similar) => {
      if (similar.photos?.length) {
        const p = similar.photos[0];
        return typeof p === 'object' && p.image ? getPhotoSrc(p.image) : getPhotoSrc(p);
      }
      if (similar.photo) return getPhotoSrc(similar.photo);
      return null;
    };

    const lightboxSameSourceSiblings =
      lbSlide && lbSlide.linkId
        ? userLightboxSlides.map((slide, i) => ({ slide, i })).filter(({ slide }) => slide.linkId === lbSlide.linkId)
        : [];

    const lightboxLinkedForSource =
      lbSlide && lbSlide.linkId
        ? lightboxOwnerGuestSameAs.filter((sim) =>
            (sim.sources || []).some(
              (src) => (src.id?.split('#').pop() || src.id) === lbSlide.linkId
            )
          )
        : [];

    const lightboxOtherSourceVariants = !lbSlide?.linkId
      ? lightboxOwnerGuestSameAs
      : lightboxOwnerGuestSameAs.filter(
          (s) =>
            !(s.sources || []).some((src) => {
              const sid = src.id?.split('#').pop() || src.id;
              return sid && sid === lbSlide.linkId;
            })
        );

    const showLightboxSourceStrip =
      Boolean(lbSlide?.linkId) &&
      (lightboxSameSourceSiblings.length > 1 || lightboxLinkedForSource.length > 0);

    const closeUserLightbox = () => {
      setUserLightboxMenuOpen(false);
      setUserLightboxOpen(false);
      setLightboxOwnerScope(null);
    };

    const handleDownloadUserLightboxPhoto = async () => {
      if (!lbSlide?.src) return;
      setUserLightboxMenuOpen(false);
      const raw = (firstAsana?.name?.name_ru || 'asana')
        .replace(/[<>"/\\|?*\x00-\x1f]/g, '')
        .trim()
        .replace(/\s+/g, '_')
        .slice(0, 72);
      const filename = `${raw || 'asana'}_${userLightboxIndex + 1}.jpg`;
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

    return (
      <div className="container">
        <div className="asana-detail">
          <div className="asana-header">
            <h1 className="asana-title">{firstAsana?.name?.name_ru}</h1>
          </div>

          <div className="asana-info">
            <div className="asana-details">
              <div className="detail-section">
                {firstAsana?.name?.name_sanskrit && (
                  <div className="detail-item">
                    <strong>На санскрите:</strong> {firstAsana.name.name_sanskrit}
                  </div>
                )}
                {firstAsana?.name?.transliteration && (
                  <div className="detail-item">
                    <strong>Транслитерация:</strong> {firstAsana.name.transliteration}
                  </div>
                )}
                {firstAsana?.name?.definition && (
                  <div className="detail-item">
                    <strong>Перевод:</strong> {firstAsana.name.definition}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="user-gallery-block asana-info">
            <h2 className="detail-title">Фотографии</h2>
            {userGallerySlides.length > 0 ? (
              <div className="user-photo-grid">
                {userGallerySlides.map((slide, i) => (
                  <div key={slide.key} className="user-photo-cell">
                    <button
                      type="button"
                      className="user-photo-cell-btn"
                      aria-label={`Открыть фото ${i + 1} из ${userGallerySlides.length}`}
                      onClick={() => {
                        setLightboxOwnerScope(null);
                        setUserLightboxIndex(i);
                        setUserLightboxOpen(true);
                      }}
                    >
                      <img src={slide.src} alt="" loading="lazy" />
                    </button>
                    <div className="user-photo-cell-caption">
                      {slide.linkId ? (
                        <Link
                          className="user-photo-source-caption-link"
                          to={`/sources/${slide.linkId}/asanas`}
                        >
                          {slide.caption}
                        </Link>
                      ) : (
                        slide.caption
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="user-gallery-empty">Фотографии отсутствуют</p>
            )}
          </div>
        </div>

        {userLightboxOpen && userLightboxSlides.length > 0 && lbSlide && (
          <div
            className="user-photo-lightbox"
            role="dialog"
            aria-modal="true"
            aria-label="Просмотр фотографий"
            onClick={closeUserLightbox}
          >
            <div
              className="user-photo-lightbox-inner"
              onClick={(e) => {
                e.stopPropagation();
                if (!e.target.closest('.user-lightbox-more-wrap')) {
                  setUserLightboxMenuOpen(false);
                }
              }}
            >
              <div className="user-photo-lightbox-topbar">
                <div className="user-lightbox-more-wrap">
                  <button
                    type="button"
                    className="user-lightbox-more-btn"
                    aria-label="Меню"
                    aria-expanded={userLightboxMenuOpen}
                    onClick={(e) => {
                      e.stopPropagation();
                      setUserLightboxMenuOpen((v) => !v);
                    }}
                  >
                    ⋯
                  </button>
                  {userLightboxMenuOpen && (
                    <div className="user-lightbox-more-menu" role="menu">
                      <button
                        type="button"
                        role="menuitem"
                        className="user-lightbox-more-menu-item"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadUserLightboxPhoto();
                        }}
                      >
                        Скачать фото
                      </button>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="user-photo-lightbox-close"
                  aria-label="Закрыть"
                  onClick={closeUserLightbox}
                >
                  ×
                </button>
              </div>
              <div className="user-photo-lightbox-stage">
                {userLightboxSlides.length > 1 && (
                  <>
                    <button
                      type="button"
                      className="user-photo-lightbox-nav user-photo-lightbox-nav--prev"
                      aria-label="Предыдущее фото"
                      onClick={(e) => {
                        e.stopPropagation();
                        setUserLightboxIndex(
                          (i) => (i - 1 + userLightboxSlides.length) % userLightboxSlides.length
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
                        setUserLightboxIndex((i) => (i + 1) % userLightboxSlides.length);
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

              <p className="user-photo-lightbox-caption">
                {lbSlide.linkId ? (
                  <Link
                    className="user-photo-source-caption-link user-photo-source-caption-link--on-dark"
                    to={`/sources/${lbSlide.linkId}/asanas`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {lbSlide.caption}
                  </Link>
                ) : (
                  lbSlide.caption
                )}
              </p>
              {userLightboxSlides.length > 1 && (
                <p className="user-photo-lightbox-counter">
                  {userLightboxIndex + 1} / {userLightboxSlides.length}
                </p>
              )}

              {showLightboxSourceStrip && (
                <div className="user-lightbox-source-strip" onClick={(e) => e.stopPropagation()}>
                  <h4 className="user-lightbox-source-strip-title">Это издание</h4>

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
                          aria-selected={i === userLightboxIndex}
                          className={
                            i === userLightboxIndex
                              ? 'user-lightbox-source-thumb user-lightbox-source-thumb--active'
                              : 'user-lightbox-source-thumb'
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            setUserLightboxIndex(i);
                          }}
                        >
                          <img src={slide.src} alt="" />
                        </button>
                      ))}
                    </div>
                  )}

                  {lightboxLinkedForSource.length > 0 && (
                    <>
                      <h4 className="user-lightbox-source-strip-subtitle">
                        {lightboxSameSourceSiblings.length > 1
                          ? 'Другое название в каталоге для этого издания'
                          : 'Другое название в каталоге'}
                      </h4>
                      <div className="user-lightbox-source-linked">
                        {lightboxLinkedForSource.map((sim) => {
                          const prev = similarPreviewSrc(sim);
                          return (
                            <Link
                              key={sim.id}
                              to={`/asana/${getAsanaId(sim)}-page?focusOwner=${encodeURIComponent(
                                canonicalAsanaId(sim.id)
                              )}`}
                              className="user-lightbox-linked-card"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="user-lightbox-linked-card-photo">
                                {prev ? <img src={prev} alt="" /> : <span className="user-lightbox-linked-card-empty">—</span>}
                              </div>
                              <span className="user-lightbox-linked-card-name">{sim.name?.name_ru || 'Асана'}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

              {lightboxOtherSourceVariants.length > 0 && (
                <div className="user-lightbox-other-sources-strip" onClick={(e) => e.stopPropagation()}>
                  <h4 className="user-lightbox-source-strip-title">Данная асана под другими названиями</h4>
                  <ul className="user-lightbox-other-sources-name-list">
                    {lightboxOtherSourceVariants.map((sim) => (
                      <li key={sim.id}>
                        <Link
                          to={`/asana/${getAsanaId(sim)}-page?focusOwner=${encodeURIComponent(
                            canonicalAsanaId(sim.id)
                          )}`}
                          className="user-lightbox-other-source-name-link"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {sim.name?.name_ru || 'Асана'}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Рендер для админов/экспертов
  return (
    <div className="container">
      <div className="asana-detail">
        <div className="asana-header">
          <h1 className="asana-title">{asana.name?.name_ru}</h1>
          <div className="admin-actions">
            <button
              className="btn-primary"
              onClick={() => {
                // Проверяем наличие источника перед открытием формы
                let hasSource = false;
                if (asana.sources && asana.sources.length > 0) {
                  hasSource = true;
                } else if (asana.source) {
                  if (typeof asana.source === 'object' && asana.source.id) {
                    hasSource = true;
                  } else if (typeof asana.source === 'string' && asana.source) {
                    hasSource = true;
                  }
                }
                
                if (!hasSource) {
                  alert('У асаны нет источника. Невозможно добавить фотографию.');
                  return;
                }
                setShowAddPhotoForm(!showAddPhotoForm);
              }}
            >
              Добавить фотографию
            </button>
            <button
              className="match-asana-btn"
              onClick={() => setShowMatchModal(true)}
            >
              🔗 Указать совпадение
            </button>
          </div>
        </div>

        <div className="asana-info">
          <div className="asana-details">
            <div className="detail-section">
              {asana.name?.name_sanskrit && (
                <div className="detail-item">
                  <strong>На санскрите:</strong> {asana.name.name_sanskrit}
                </div>
              )}
              {asana.name?.transliteration && (
                <div className="detail-item">
                  <strong>Транслитерация:</strong> {asana.name.transliteration}
                </div>
              )}
                {asana.name?.definition && (
                  <div className="detail-item">
                    <strong>Перевод:</strong> {asana.name.definition}
                  </div>
                )}
            </div>
            
            {asana.sources && asana.sources.length > 0 && (
              <div className="detail-section">
                <h2 className="detail-title">Источник</h2>
                {asana.sources.map((source, index) => {
                  const sourceId = source.id?.split('#').pop() || source.id;
                  return (
                    <div key={index} className="detail-item">
                      <a 
                        href={`/sources/${sourceId}/asanas`}
                        style={{ color: '#007bff', textDecoration: 'none' }}
                        onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
                        onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
                      >
                        <strong>{source.author}</strong> - {source.title}
                        {source.year && ` (${source.year})`}
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="asana-photos">
            {asana.photos && asana.photos.length > 0 ? (
              <div className="photo-gallery">
                {asana.photos.map((photo, index) => {
                  const photoSource = typeof photo === 'object' && photo.source ? photo.source : null;
                  const sourceId = photoSource ? (typeof photoSource === 'string' ? photoSource.split('#').pop() : photoSource.id?.split('#').pop() || photoSource.id) : null;
                  // Получаем photoId: если это объект с id, используем его, иначе создаем уникальный ключ
                  const photoId = typeof photo === 'object' && photo.id 
                    ? photo.id 
                    : (typeof photo === 'object' && photo.image 
                        ? `photo_${index}_${photo.image.substring(0, 20)}` 
                        : `photo_${index}`);
                  const isMenuOpen = photoMenuOpen === photoId;
                  
                  return (
                    <div key={index} className="photo-container">
                      {isExpertOrAdmin && (
                        <div className="photo-menu-button" onClick={(e) => {
                          e.stopPropagation();
                          setPhotoMenuOpen(isMenuOpen ? null : photoId);
                        }}>
                          <span>⋯</span>
                        </div>
                      )}
                      {isMenuOpen && isExpertOrAdmin && (
                        <div className="photo-menu" onClick={(e) => e.stopPropagation()}>
                          <button
                            className="photo-menu-item"
                            onClick={() => {
                              handleDownloadPhoto(photo, index);
                              setPhotoMenuOpen(null);
                            }}
                          >
                            📥 Скачать
                          </button>
                          <button
                            type="button"
                            className="photo-menu-item"
                            onClick={() => openPhotoEditor(photo, index)}
                          >
                            ✏️ Редактировать фото
                          </button>
                          <button
                            type="button"
                            className="photo-menu-item photo-menu-item-danger"
                            onClick={() => {
                              handleDeletePhoto(photo, index);
                            }}
                          >
                            🗑️ Удалить фото
                          </button>
                        </div>
                      )}
                      {typeof photo === 'object' && photo.image ? (
                        <img
                          src={galleryImageUrl(photo)}
                          alt={asana.name?.name_ru}
                          className="gallery-item"
                        />
                      ) : (
                        <img
                          src={galleryImageUrl(photo)}
                          alt={asana.name?.name_ru}
                          className="gallery-item"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p>Фотографии отсутствуют</p>
            )}
          </div>
        </div>

        {/* Блок аналогичных асан для админов/экспертов */}
        {filteredSimilarAsanas.length > 0 && (
          <div className="similar-asanas-section">
            <h3 className="similar-asanas-title">Данная асана в других источниках</h3>
            <div className="similar-asanas-grid">
              {filteredSimilarAsanas.map((similar) => (
                <div key={similar.id} className="similar-asana-card" style={{ cursor: 'default' }}>
                  <Link to={`/asana/${getAsanaId(similar)}-page`}>
                    <div className="similar-asana-photo">
                      {similar.photo ? (
                        <img src={getPhotoSrc(similar.photo)} alt={similar.name?.name_ru} />
                      ) : null}
                    </div>
                    <div className="similar-asana-info">
                      <h5 className="similar-asana-name">{similar.name?.name_ru}</h5>
                      {similar.sources?.[0] && (
                        <p className="similar-asana-source">
                          {similar.sources[0].author} - {similar.sources[0].title}
                          {similar.sources[0].year && ` (${similar.sources[0].year})`}
                        </p>
                      )}
                    </div>
                  </Link>
                  <button
                    className="similar-asana-remove"
                    onClick={() => handleRemoveSimilar(similar.id)}
                  >
                    Удалить связь
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {showAddPhotoForm && (
          <div className="add-photo-form">
            <h3 className="form-title">Добавление фотографии</h3>
            <div className="form-group" style={{ marginBottom: '1em', padding: '0.75em', background: 'var(--background-alt)', borderRadius: '8px' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9em', margin: 0 }}>
                <strong>Источник:</strong>{' '}
                {asana.sources && asana.sources.length > 0 ? (
                  <>
                    {asana.sources[0].author} - {asana.sources[0].title}
                    {asana.sources[0].year && ` (${asana.sources[0].year})`}
                  </>
                ) : asana.source ? (
                  typeof asana.source === 'object' ? (
                    <>
                      {asana.source.author} - {asana.source.title}
                      {asana.source.year && ` (${asana.source.year})`}
                    </>
                  ) : (
                    'Источник определен автоматически'
                  )
                ) : (
                  'Источник не определен'
                )}
              </p>
            </div>
            <form onSubmit={handlePhotoSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="photo">
                  Фотография *
                </label>
                <input
                  type="file"
                  id="photo"
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
                  }}
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Модальное окно выбора асаны для совпадения */}
      {showMatchModal && (
        <div className="modal-overlay" onClick={() => setShowMatchModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Указать совпадение</h3>
              <button className="modal-close" onClick={() => setShowMatchModal(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="modal-search">
                <input
                  type="text"
                  placeholder="Поиск асаны..."
                  value={matchSearchQuery}
                  onChange={(e) => setMatchSearchQuery(e.target.value)}
                />
              </div>
              <div className="modal-asanas-list">
                {filteredAsanasForMatch.map((a) => (
                  <div
                    key={a.id}
                    className={`modal-asana-item ${selectedMatchAsana?.id === a.id ? 'selected' : ''}`}
                    onClick={() => setSelectedMatchAsana(a)}
                  >
                    {a.photo ? (
                      <img
                        src={getPhotoSrc(a.photo)}
                        alt={a.name?.name_ru}
                        className="modal-asana-thumb"
                      />
                    ) : (
                      <div className="modal-asana-thumb" style={{ background: '#eee' }} />
                    )}
                    <div className="modal-asana-info">
                      <div className="modal-asana-name">{a.name?.name_ru}</div>
                      {a.sources?.[0] && (
                        <div className="modal-asana-source">
                          {a.sources[0].author}
                          {a.sources[0].year && ` (${a.sources[0].year})`}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {filteredAsanasForMatch.length === 0 && (
                  <p style={{ textAlign: 'center', color: '#666' }}>Асаны не найдены</p>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowMatchModal(false)}>
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

      {/* Редактор фото: превью + поворот, сохранение на сервер */}
      {showPhotoEditorModal && photoEditorContext && (
        <div
          className="modal-overlay"
          onClick={() => !editorSaving && handlePhotoEditorCancel()}
        >
          <div className="modal-content photo-editor-modal" onClick={(e) => e.stopPropagation()}>
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
                  src={galleryImageUrl(photoEditorContext.photo)}
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
                  onClick={() => setEditorRotationDeg((d) => normEditorRotation(d - 90))}
                >
                  ↺ −90°
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={editorSaving}
                  onClick={() => setEditorRotationDeg((d) => normEditorRotation(d + 90))}
                >
                  ↻ +90°
                </button>
                <span className="photo-editor-angle">
                  <strong>{normEditorRotation(editorRotationDeg) || 0}°</strong>
                </span>
              </div>
            </div>
            <div className="modal-footer photo-editor-footer">
              <button type="button" className="btn-secondary" disabled={editorSaving} onClick={handlePhotoEditorCancel}>
                Отмена
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={editorSaving || normEditorRotation(editorRotationDeg) === 0}
                onClick={handlePhotoEditorSave}
              >
                {editorSaving ? 'Сохранение…' : 'Сохранить поворот'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AsanaDetail;
