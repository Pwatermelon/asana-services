import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { asanasAPI } from '../api/asanas';
import { useAuth } from '../contexts/AuthContext';
import { normalizeCatalogNameKey } from '../utils/catalogSearch';
import { asanaPagePath } from '../components/CompactAsanaRow';
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

  const byCanon = new Map();
  if (allAsanas?.length) {
    for (const a of allAsanas) {
      const k = canonicalAsanaId(a.id);
      if (k) byCanon.set(k, a);
    }
  }

  /** Всегда подмешивать полную запись из каталога, иначе /similar без sources даёт несколько одинаковых строк «Халасана». */
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

/** Гость: только связи, у которых русское название отличается от названия группы (страница по имени). */
function filterGuestSameAsDifferentGroupName(links, groupNameKey) {
  if (!links?.length) return [];
  const gk = groupNameKey || '';
  return links.filter((s) => {
    const sk = normalizeCatalogNameKey(s.name?.name_ru || '');
    return gk === '' || sk !== gk;
  });
}

function captionFromSourceDoc(s) {
  if (!s) return '';
  return (
    [s.author, s.title].filter(Boolean).join(' — ') +
    (s.year != null && s.year !== '' ? ` (${s.year})` : '')
  );
}

/** Первое непустое «автор — название (год)» среди источников записи или у фото. */
function pickEditionCaptionFromRecord(sim) {
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

function catalogIdFallbackLabel(sim) {
  const raw =
    typeof sim?.id === 'string' ? sim.id.split('#').pop() || String(sim.id) : '';
  const short = raw.replace(/^asana_/i, '').replace(/^[^:]+:\s*\/?\/?#?\/?/i, '') || raw;
  if (short && short !== 'undefined') return `Каталожная запись · ${short}`;
  return 'источник не указан';
}

/** Вторая строка в списке «под другими названиями»: всегда различает записи даже при одном русском названии. */
function catalogRecordSecondaryParts(sim) {
  const edition = pickEditionCaptionFromRecord(sim);
  const secondary = edition || catalogIdFallbackLabel(sim);
  return { secondary, muted: !edition };
}

/** Одна строка: одно русское название — справа все различающиеся издания (несколько записей каталога с тем же имени). */
function groupLightboxOtherNamesByDisplayRu(variants) {
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
  /** Объект, для которого открыто «Указать соответствие» (владелец кадра в лайтбоксе или страница). */
  const [matchSubjectAsanaId, setMatchSubjectAsanaId] = useState(null);
  /** Добавление фото к конкретной сущности и источнику (из панели «Это издание»). */
  const [addPhotoTarget, setAddPhotoTarget] = useState(null);
  /** Модалка: соответствия (sameAs) для выбранной сущности-владельца кадра. */
  const [showSameAsLinksModal, setShowSameAsLinksModal] = useState(false);
  const [sameAsLinksSubjectId, setSameAsLinksSubjectId] = useState(null);
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

    let sourceId = null;
    let targetAsanaId = asana.id;

    if (addPhotoTarget?.ownerId && addPhotoTarget?.sourceId) {
      targetAsanaId = addPhotoTarget.ownerId;
      sourceId = addPhotoTarget.sourceId;
    } else {
      if (asana.sources && asana.sources.length > 0) {
        sourceId = asana.sources[0].id;
      } else if (asana.source) {
        if (typeof asana.source === 'object' && asana.source.id) {
          sourceId = asana.source.id;
        } else if (typeof asana.source === 'string') {
          sourceId = asana.source;
        }
      }
    }

    if (!sourceId) {
      alert('У асаны нет источника. Невозможно добавить фотографию.');
      return;
    }

    try {
      await asanasAPI.addPhoto(targetAsanaId, photoFile, sourceId);
      loadAsana();
      loadAllAsanas();
      setShowAddPhotoForm(false);
      setPhotoFile(null);
      setAddPhotoTarget(null);
    } catch (error) {
      alert('Ошибка при добавлении фотографии');
      console.error('Error adding photo:', error);
    }
  };

  const handleMatchAsana = async () => {
    if (!selectedMatchAsana || !asana) return;
    const subjectId = matchSubjectAsanaId || asana.id;

    try {
      await asanasAPI.setSameAsObject(subjectId, selectedMatchAsana.id);
      setShowMatchModal(false);
      setSelectedMatchAsana(null);
      setMatchSearchQuery('');
      setMatchSubjectAsanaId(null);
      if (canonicalAsanaId(subjectId) === canonicalAsanaId(asana.id)) {
        loadSimilarAsanas(asana);
      }
      await loadAllAsanas();
      await loadAsana();
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
      if (asana && canonicalAsanaId(subjectOwnerId) === canonicalAsanaId(asana.id)) {
        loadSimilarAsanas(asana);
      }
      await loadAllAsanas();
      await loadAsana();
    } catch (error) {
      alert('Ошибка при удалении соответствия');
      console.error('Error removing same as object:', error);
    }
  };

  const resolvePhotoIdForApi = (photo, photoIndex) => {
    if (typeof photo === 'object' && photo.id) {
      return photo.id;
    }
    return `photo_${photoIndex}`;
  };

  const normEditorRotation = (d) => ((d % 360) + 360) % 360;

  const openPhotoEditor = (photo, photoIndex, ownerAsanaId = null) => {
    const photoId = resolvePhotoIdForApi(photo, photoIndex);
    setPhotoEditorContext({
      photo,
      photoId,
      index: photoIndex,
      ownerAsanaId: ownerAsanaId || asana?.id,
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
      const ownerIdForRotate = photoEditorContext.ownerAsanaId || asana.id;
      await asanasAPI.rotatePhoto(ownerIdForRotate, photoEditorContext.photoId, r);
      setPhotoGalleryVersion((v) => v + 1);
      handlePhotoEditorCancel();
      await loadAllAsanas();
      await loadAsana();
    } catch (error) {
      const detail = error.response?.data?.detail;
      alert(detail || error.message || 'Ошибка при повороте фотографии');
      console.error('Error rotating photo:', error);
    } finally {
      setEditorSaving(false);
    }
  };

  const handleDeletePhoto = async (photo, photoIndex, ownerAsanaId = null) => {
    if (!photo) return;
    const ownerFull =
      ownerAsanaId && allAsanas.length
        ? allAsanas.find((a) => a.id === ownerAsanaId) ||
          allAsanas.find((a) => canonicalAsanaId(a.id) === canonicalAsanaId(ownerAsanaId))
        : asana;
    if (!ownerFull) return;

    const photoCount = Array.isArray(ownerFull.photos) ? ownerFull.photos.length : 0;
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

      const data = await asanasAPI.deletePhoto(ownerFull.id, photoId);

      if (data?.asana_deleted) {
        alert(data.message || 'Фото удалено. Запись асаны удалена — не осталось фотографий.');
        if (canonicalAsanaId(ownerFull.id) === canonicalAsanaId(asana?.id)) {
          navigate('/asanas');
        } else {
          await loadAllAsanas();
          await loadAsana();
        }
        return;
      }

      await loadAllAsanas();
      await loadAsana();
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
      setUserLightboxOpen(false);
      setUserLightboxMenuOpen(false);
      setLightboxOwnerScope(null);
      await loadAllAsanas();
      if (canonicalAsanaId(own.id) === canonicalAsanaId(asana?.id)) {
        navigate('/asanas');
        return;
      }
      await loadAsana();
    } catch (err) {
      alert('Не удалось удалить запись');
      console.error(err);
    }
  };

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

  /** HTTP(S) URL картинки с cache-bust: путь в S3 тот же — нужен меняющийся query. Всегда добавляем photoGalleryVersion: после поворота счётчик растёт сразу, даже если в ответе API ещё старый photo_hash. */
  const galleryImageUrl = (photo) => {
    if (photo == null) return '';
    const sep = (url) => (url.includes('?') ? '&' : '?');
    const withBust = (url, hashPart) => {
      const h = hashPart ? String(hashPart) : '';
      const v = String(photoGalleryVersion);
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
  };

  /** Записи с установленным sameAs относительно выбранной сущности (модалка «Соответствия»). */
  const sameAsLinksForModal = React.useMemo(() => {
    if (!showSameAsLinksModal || !sameAsLinksSubjectId || !allAsanas.length || !asana) return [];
    const owner =
      allAsanas.find((a) => a.id === sameAsLinksSubjectId) ||
      allAsanas.find((a) => canonicalAsanaId(a.id) === canonicalAsanaId(sameAsLinksSubjectId));
    if (!owner) return [];
    return combinedSameAsForOwner(owner, asana, allAsanas, similarAsanas);
  }, [
    showSameAsLinksModal,
    sameAsLinksSubjectId,
    allAsanas,
    asana,
    similarAsanas,
  ]);

  /** Слайды галереи: все фото записей с тем же русским названием (гость и эксперт). */
  const userGallerySlides = React.useMemo(() => {
    if (!asana || !allAsanas.length) return [];
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
        const img = galleryImageUrl(photo);
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
    });
    return slides;
  }, [asana, allAsanas, photoGalleryVersion]);

  /** Слайды внутри лайтбокса: все фото группы или только выбранный объект (sameAs-переход). */
  const userLightboxSlides = React.useMemo(() => {
    if (!lightboxOwnerScope) return userGallerySlides;
    const f = userGallerySlides.filter(
      (s) => canonicalAsanaId(s.ownerId) === lightboxOwnerScope
    );
    return f.length ? f : userGallerySlides;
  }, [userGallerySlides, lightboxOwnerScope]);

  /** Лайтбокс: sameAs от владельца кадра; в списке «другие названия» — только записи с другим русским названием группы. */
  const lightboxOwnerSameAsVisible = React.useMemo(() => {
    if (!userLightboxOpen || !allAsanas.length || !asana) return [];
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
    userLightboxOpen,
    userLightboxIndex,
    userLightboxSlides,
    allAsanas,
    asana,
    similarAsanas,
  ]);

  /** Фото связанных sameAs записей с тем же русским названием, из других источников (не текущий linkId). */
  const lightboxSameNameLinkedPhotos = React.useMemo(() => {
    if (!userLightboxOpen || !allAsanas.length || !asana) return [];
    const slide = userLightboxSlides[userLightboxIndex];
    if (!slide?.ownerId) return [];
    const ownerAsana =
      allAsanas.find((a) => a.id === slide.ownerId) ||
      allAsanas.find((a) => canonicalAsanaId(a.id) === canonicalAsanaId(slide.ownerId));
    if (!ownerAsana) return [];
    const nameLower = asana.name?.name_ru?.toLowerCase().trim();
    if (!nameLower) return [];
    const lid = slide.linkId;
    const linked = combinedSameAsForOwner(ownerAsana, asana, allAsanas, similarAsanas);
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
    const out = [];
    for (const other of linked) {
      if (canonicalAsanaId(other.id) === canonicalAsanaId(ownerAsana.id)) continue;
      if (other.name?.name_ru?.toLowerCase().trim() !== nameLower) continue;
      if (!other.photos?.length) continue;
      other.photos.forEach((photo, idx) => {
        const { caption, linkId: pLid } = metaFor(photo, other);
        if (lid && pLid === lid) return;
        const img = galleryImageUrl(photo);
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
    userLightboxOpen,
    userLightboxIndex,
    userLightboxSlides,
    allAsanas,
    asana,
    similarAsanas,
    photoGalleryVersion,
  ]);

  React.useEffect(() => {
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
  }, [id, searchParams, userGallerySlides, setSearchParams]);

  React.useEffect(() => {
    if (userLightboxOpen) return;
    setLightboxOwnerScope(null);
  }, [userLightboxOpen]);

  React.useEffect(() => {
    if (!userLightboxOpen) return;
    if (!userLightboxSlides.length) return;
    setUserLightboxIndex((i) => Math.min(i, userLightboxSlides.length - 1));
  }, [userLightboxOpen, userLightboxSlides]);

  React.useEffect(() => {
    setUserLightboxMenuOpen(false);
  }, [userLightboxIndex, userLightboxOpen]);

  React.useEffect(() => {
    if (!userLightboxOpen) return;
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
  }, [userLightboxOpen, userLightboxSlides]);

  // Фильтрация асан для модального окна
  const filteredAsanasForMatch = React.useMemo(() => {
    if (!allAsanas || !asana) return [];
    
    const excludeId = matchSubjectAsanaId || asana.id;
    return allAsanas
      .filter((a) => canonicalAsanaId(a.id) !== canonicalAsanaId(excludeId))
      .filter((a) => {
        if (!matchSearchQuery) return true;
        const query = matchSearchQuery.toLowerCase();
        return (
          a.name?.name_ru?.toLowerCase().includes(query) ||
          a.name?.name_sanskrit?.toLowerCase().includes(query)
        );
      })
      .slice(0, 20);
  }, [allAsanas, asana, matchSearchQuery, matchSubjectAsanaId]);

  /** Соседние группы каталога по русскому названию (как в списке асан): предыдущая / следующая по алфавиту. */
  const catalogGroupNeighbors = React.useMemo(() => {
    if (!allAsanas.length || !asana?.name?.name_ru) return { prevRep: null, nextRep: null };
    const currentKey = normalizeCatalogNameKey(asana.name.name_ru);
    if (!currentKey) return { prevRep: null, nextRep: null };
    const byKey = new Map();
    for (const a of allAsanas) {
      const nk = normalizeCatalogNameKey(a.name?.name_ru || '');
      if (!nk || byKey.has(nk)) continue;
      byKey.set(nk, a);
    }
    const reps = [...byKey.values()].sort((x, y) =>
      (x.name?.name_ru || '').localeCompare(y.name?.name_ru || '', 'ru', { sensitivity: 'base' })
    );
    const idx = reps.findIndex((r) => normalizeCatalogNameKey(r.name?.name_ru || '') === currentKey);
    if (idx < 0) return { prevRep: null, nextRep: null };
    return {
      prevRep: idx > 0 ? reps[idx - 1] : null,
      nextRep: idx < reps.length - 1 ? reps[idx + 1] : null,
    };
  }, [allAsanas, asana]);

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

  const asanaName = asana.name?.name_ru?.toLowerCase().trim();
    const asanasWithSameName = allAsanas.filter(
      (a) => a.name?.name_ru?.toLowerCase().trim() === asanaName
    );
    const firstAsana = asanasWithSameName[0] || asana;
    const lbSlide = userLightboxSlides[userLightboxIndex];
    const lbSlideOwnerFull =
      lbSlide &&
      (allAsanas.find((a) => a.id === lbSlide.ownerId) ||
        allAsanas.find(
          (a) => canonicalAsanaId(a.id) === canonicalAsanaId(lbSlide.ownerId)
        ));
    const lightboxNameSubtitle =
      lbSlideOwnerFull &&
      normalizeCatalogNameKey(lbSlideOwnerFull.name?.name_ru || '') !==
        normalizeCatalogNameKey(firstAsana?.name?.name_ru || '')
        ? lbSlideOwnerFull.name?.name_ru
        : null;

    const similarPreviewSrc = (similar) => {
      if (similar.photos?.length) {
        const p = similar.photos[0];
        return typeof p === 'object' ? galleryImageUrl(p) : galleryImageUrl({ image: p });
      }
      if (similar.photo) {
        const ph = similar.photo;
        return typeof ph === 'object' && ph.image ? galleryImageUrl(ph) : galleryImageUrl({ image: ph });
      }
      return null;
    };

    const lightboxSameSourceSiblings =
      lbSlide && lbSlide.linkId
        ? userLightboxSlides.map((slide, i) => ({ slide, i })).filter(({ slide }) => slide.linkId === lbSlide.linkId)
        : [];

    const lightboxLinkedForSource =
      lbSlide && lbSlide.linkId
        ? lightboxOwnerSameAsVisible.filter((sim) =>
            (sim.sources || []).some(
              (src) => (src.id?.split('#').pop() || src.id) === lbSlide.linkId
            )
          )
        : [];

    const lightboxOtherSourceVariants = !lbSlide?.linkId
      ? lightboxOwnerSameAsVisible
      : lightboxOwnerSameAsVisible.filter(
          (s) =>
            !(s.sources || []).some((src) => {
              const sid = src.id?.split('#').pop() || src.id;
              return sid && sid === lbSlide.linkId;
            })
        );

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
            <div className="asana-header-inner">
              <div className="asana-catalog-step-slot asana-catalog-step-slot--prev">
                {catalogGroupNeighbors.prevRep ? (
                  <button
                    type="button"
                    className="asana-catalog-step-btn"
                    aria-label={`Предыдущая асана: ${catalogGroupNeighbors.prevRep.name?.name_ru || ''}`}
                    onClick={() => navigate(asanaPagePath(catalogGroupNeighbors.prevRep))}
                  >
                    ← Назад
                  </button>
                ) : null}
              </div>
              <h1 className="asana-title asana-title--header-center">{firstAsana?.name?.name_ru}</h1>
              <div className="asana-catalog-step-slot asana-catalog-step-slot--next">
                {catalogGroupNeighbors.nextRep ? (
                  <button
                    type="button"
                    className="asana-catalog-step-btn"
                    aria-label={`Следующая асана: ${catalogGroupNeighbors.nextRep.name?.name_ru || ''}`}
                    onClick={() => navigate(asanaPagePath(catalogGroupNeighbors.nextRep))}
                  >
                    Вперёд →
                  </button>
                ) : null}
              </div>
            </div>
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
                <div
                  className="user-photo-lightbox-topbar-side user-photo-lightbox-topbar-side--left"
                  aria-hidden="true"
                />
                <div className="user-photo-lightbox-topbar-center">
                  <div className="user-photo-lightbox-catalog-title">
                    {firstAsana?.name?.name_ru || 'Асана'}
                  </div>
                  {lightboxNameSubtitle ? (
                    <div className="user-photo-lightbox-catalog-subtitle">{lightboxNameSubtitle}</div>
                  ) : null}
                </div>
                <div className="user-photo-lightbox-topbar-side user-photo-lightbox-topbar-side--right">
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
                      {isExpertOrAdmin && lbSlide.photo && (
                        <>
                          <button
                            type="button"
                            role="menuitem"
                            className="user-lightbox-more-menu-item"
                            onClick={(e) => {
                              e.stopPropagation();
                              setUserLightboxMenuOpen(false);
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
                              setUserLightboxMenuOpen(false);
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
                  onClick={closeUserLightbox}
                >
                  ×
                </button>
                </div>
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

              {userLightboxSlides.length > 1 && (
                <p className="user-photo-lightbox-counter">
                  {userLightboxIndex + 1} / {userLightboxSlides.length}
                </p>
              )}

              <div className="user-lightbox-source-strip" onClick={(e) => e.stopPropagation()}>
                <h4 className="user-lightbox-source-strip-title">Это издание</h4>
                {lbSlide.caption ? (
                  <p className="user-lightbox-edition-caption">
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
                ) : null}
                {isExpertOrAdmin && lbSlide?.ownerId && (
                    <div className="user-lightbox-expert-edition-actions">
                      <button
                        type="button"
                        className="btn-secondary user-lightbox-expert-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          const own =
                            allAsanas.find((a) => a.id === lbSlide.ownerId) ||
                            allAsanas.find(
                              (a) =>
                                canonicalAsanaId(a.id) === canonicalAsanaId(lbSlide.ownerId)
                            );
                          if (!own) return;
                          setMatchSubjectAsanaId(own.id);
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
                          const own =
                            allAsanas.find((a) => a.id === lbSlide.ownerId) ||
                            allAsanas.find(
                              (a) =>
                                canonicalAsanaId(a.id) === canonicalAsanaId(lbSlide.ownerId)
                            );
                          if (!own) return;
                          setSameAsLinksSubjectId(own.id);
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
                          const own =
                            allAsanas.find((a) => a.id === lbSlide.ownerId) ||
                            allAsanas.find(
                              (a) =>
                                canonicalAsanaId(a.id) === canonicalAsanaId(lbSlide.ownerId)
                            );
                          if (!own) return;
                          let sourceId = null;
                          if (lbSlide.linkId && own.sources?.length) {
                            const s = own.sources.find(
                              (x) => (x.id?.split('#').pop() || x.id) === lbSlide.linkId
                            );
                            if (s) sourceId = s.id;
                          }
                          if (!sourceId && own.sources?.length === 1) {
                            sourceId = own.sources[0].id;
                          }
                          if (!sourceId) {
                            alert('Не удалось определить источник для добавления фото.');
                            return;
                          }
                          setAddPhotoTarget({ ownerId: own.id, sourceId });
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
                          const { secondary, muted } = catalogRecordSecondaryParts(sim);
                          const subCls = muted
                            ? 'user-lightbox-linked-card-source user-lightbox-linked-card-source--muted'
                            : 'user-lightbox-linked-card-source';
                          return (
                            <Link
                              key={sim.id}
                              to={asanaPagePath(sim)}
                              className="user-lightbox-linked-card"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="user-lightbox-linked-card-photo">
                                {prev ? <img src={prev} alt="" /> : <span className="user-lightbox-linked-card-empty">—</span>}
                              </div>
                              <span className="user-lightbox-linked-card-name">{sim.name?.name_ru || 'Асана'}</span>
                              <span className={subCls}>{secondary}</span>
                            </Link>
                          );
                        })}
                      </div>
                    </>
                  )}
              </div>

              {lightboxSameNameLinkedPhotos.length > 0 && (
                <div className="user-lightbox-same-name-linked-strip" onClick={(e) => e.stopPropagation()}>
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
                          const idx = userGallerySlides.findIndex((s) => s.key === ph.key);
                          if (idx >= 0) {
                            setLightboxOwnerScope(null);
                            setUserLightboxIndex(idx);
                          }
                        }}
                      >
                        <img src={ph.src} alt="" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {lightboxOtherSourceVariants.length > 0 && (
                <div className="user-lightbox-other-sources-strip" onClick={(e) => e.stopPropagation()}>
                  <h4 className="user-lightbox-source-strip-title">Данная асана под другими названиями</h4>
                  <ul className="user-lightbox-other-sources-name-list">
                    {groupLightboxOtherNamesByDisplayRu(lightboxOtherSourceVariants).map((g) => (
                      <li key={g.key} className="user-lightbox-other-source-row">
                        <Link
                          to={asanaPagePath(g.linkTarget)}
                          className="user-lightbox-other-source-row-link"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="user-lightbox-other-source-row-inner">
                            <div className="user-lightbox-other-source-name-cell">
                              <span className="user-lightbox-other-source-row-title-text">{g.nameRu}</span>
                            </div>
                            <div className="user-lightbox-other-source-editions-col" aria-label="Издания">
                              {g.editionLines.map((line, idx) => (
                                <span
                                  key={`${g.key}-ed-${idx}`}
                                  className={
                                    line.muted
                                      ? 'user-lightbox-other-source-edition user-lightbox-other-source-edition--muted'
                                      : 'user-lightbox-other-source-edition'
                                  }
                                >
                                  {line.secondary}
                                </span>
                              ))}
                            </div>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
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
            <div className="add-photo-form add-photo-form--modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="form-title">Добавление фотографии</h3>
            <div className="form-group" style={{ marginBottom: '1em', padding: '0.75em', background: 'var(--background-alt)', borderRadius: '8px' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9em', margin: 0 }}>
                <strong>Источник:</strong>{' '}
                {addPhotoTarget?.sourceId && allAsanas.length ? (
                  (() => {
                    const o =
                      allAsanas.find((a) => a.id === addPhotoTarget.ownerId) ||
                      allAsanas.find(
                        (a) => canonicalAsanaId(a.id) === canonicalAsanaId(addPhotoTarget.ownerId)
                      );
                    const sid = addPhotoTarget.sourceId.split('#').pop() || addPhotoTarget.sourceId;
                    const src = o?.sources?.find((s) => (s.id?.split('#').pop() || s.id) === sid);
                    return src
                      ? `${src.author} — ${src.title}${src.year != null && src.year !== '' ? ` (${src.year})` : ''}`
                      : addPhotoTarget.sourceId;
                  })()
                ) : asana.sources && asana.sources.length > 0 ? (
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

      {/* Модальное окно выбора асаны для совпадения */}
      {showMatchModal && (
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

      {showSameAsLinksModal && sameAsLinksSubjectId && (
        <div
          className="modal-overlay asana-detail-overlay-top"
          role="presentation"
          onClick={() => {
            setShowSameAsLinksModal(false);
            setSameAsLinksSubjectId(null);
          }}
        >
          <div className="modal-content asana-sameas-links-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Соответствия</h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => {
                  setShowSameAsLinksModal(false);
                  setSameAsLinksSubjectId(null);
                }}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              {sameAsLinksForModal.length > 0 ? (
                <ul className="asana-sameas-links-list">
                  {sameAsLinksForModal.map((sim) => (
                    <li key={sim.id} className="asana-sameas-links-item">
                      <div className="asana-sameas-links-item-info">
                        <div className="asana-sameas-links-name">{sim.name?.name_ru || '—'}</div>
                        {sim.name?.name_sanskrit && (
                          <div className="asana-sameas-links-sa">{sim.name.name_sanskrit}</div>
                        )}
                        <div className="asana-sameas-links-source">
                          {catalogRecordSecondaryParts(sim).secondary}
                        </div>
                      </div>
                      <div className="asana-sameas-links-item-actions">
                        <Link
                          className="btn-secondary asana-sameas-links-open"
                          to={asanaPagePath(sim)}
                          onClick={() => {
                            setShowSameAsLinksModal(false);
                            setSameAsLinksSubjectId(null);
                          }}
                        >
                          Открыть
                        </Link>
                        <button
                          type="button"
                          className="btn-secondary asana-sameas-links-remove"
                          onClick={() =>
                            handleRemoveSameAsForOwner(sameAsLinksSubjectId, sim.id)
                          }
                        >
                          Удалить соответствие
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
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
                }}
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Редактор фото: превью + поворот, сохранение на сервер */}
      {showPhotoEditorModal && photoEditorContext && (
        <div
          className="modal-overlay asana-detail-overlay-top"
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
