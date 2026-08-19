import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { asanasAPI } from '../api/asanas';
import { asanaPagePath, asanaPagePathSafe } from '../components/CompactAsanaRow';
import UserPhotoLightbox from '../components/UserPhotoLightbox';
import { normalizeCatalogNameKey } from '../utils/catalogSearch';
import {
  buildSlidesFromAsanas,
  canonicalAsanaId,
  mergeSameAsCluster,
} from '../utils/asanaSameAs';
import { canonicalPhotoId, resolvePhotoId } from '../utils/photoSameAs';
import {
  clearFocusPhoto,
  findSlideIndexByPhoto,
  resolveFocusPhotoHint,
} from '../utils/catalogFocus';
import CatalogPageNav from '../components/CatalogPageNav';
import { usePageSeo, DEFAULT_SITE_DESCRIPTION } from '../utils/pageSeo';
import '../styles/AsanasList.css';
import '../styles/AsanaDetail.css';

const AsanaDetail = () => {
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const id = params.id || params['id-page'] || params.idPage;

  const [asana, setAsana] = useState(null);
  const [allAsanas, setAllAsanas] = useState([]);
  const [similarAsanas, setSimilarAsanas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [photoGalleryVersion, setPhotoGalleryVersion] = useState(0);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const [catalogForNav, setCatalogForNav] = useState([]);

  const lastRouteIdRef = useRef(null);
  const lightboxAnchorPhotoRef = useRef(null);
  const activeLightboxPhotoRef = useRef(null);
  const stableLightboxSlidesRef = useRef([]);
  const mutationBusyRef = useRef(false);
  const focusPhotoAttemptRef = useRef(0);
  const focusEnrichBusyRef = useRef(false);
  const lightboxOpenRef = useRef(false);

  useEffect(() => {
    lightboxOpenRef.current = lightboxOpen;
  }, [lightboxOpen]);

  useEffect(() => {
    asanasAPI.getCatalog().then(setCatalogForNav).catch(() => setCatalogForNav([]));
  }, []);

  useEffect(() => {
    if (!searchParams.get('focusPhoto') && !location.state?.focusPhoto) {
      clearFocusPhoto();
    }
  }, [id, searchParams, location.state]);

  useEffect(() => {
    let cancelled = false;
    const focusHint = resolveFocusPhotoHint(searchParams, location.state);
    const softLoad =
      lightboxOpenRef.current ||
      Boolean(focusHint?.photoCanon || searchParams.get('focusOwner'));

    (async () => {
      try {
        setError(null);
        if (!softLoad) {
          setLoading(true);
          setAllAsanas([]);
          setSimilarAsanas([]);
        }

        let data = await fetchPageData();
        if (cancelled || !data) return;

        if (focusHint?.photoCanon && focusHint.ownerId) {
          const enriched = await enrichAllAsanasForOwner(data, focusHint.ownerId);
          if (enriched) data = enriched;
        }

        setAsana(data.asana);
        setAllAsanas(data.allAsanas);
        setSimilarAsanas(data.similarAsanas);
        focusPhotoAttemptRef.current += 1;
      } catch (err) {
        if (!cancelled) {
          console.error('Error loading asana page:', err);
          setError(`Ошибка при загрузке асаны: ${err.message || 'Неизвестная ошибка'}`);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  async function enrichAllAsanasForOwner(data, ownerId) {
    if (!ownerId || !data?.asana) return data;
    const ownerCanon = canonicalAsanaId(ownerId);
    const already = data.allAsanas.some((a) => canonicalAsanaId(a.id) === ownerCanon);
    if (already) return data;

    try {
      const owner = await asanasAPI.getById(ownerId);
      if (!owner?.id) return data;
      const nameRu = owner.name?.name_ru;
      const siblings = nameRu
        ? await asanasAPI.getByNameRu(nameRu).catch(() => [owner])
        : [owner];
      const merged = new Map();
      for (const a of [...data.allAsanas, ...(siblings || []), owner]) {
        if (!a?.id) continue;
        const k = canonicalAsanaId(a.id);
        if (!k) continue;
        merged.set(k, merged.has(k) ? { ...merged.get(k), ...a, id: a.id } : a);
      }
      return { ...data, allAsanas: [...merged.values()] };
    } catch {
      return data;
    }
  }

  const fetchPageData = async () => {
    if (!id) {
      setError('ID асаны не указан в URL');
      setAsana(null);
      return null;
    }

    let asanaId = String(id);
    if (asanaId.endsWith('-page')) {
      asanaId = asanaId.replace('-page', '');
    }

    const found = await asanasAPI.getById(asanaId);
    if (!found) {
      setError(`Асана не найдена (ID: ${asanaId.trim()})`);
      setAsana(null);
      return null;
    }

    const nameRu = found.name?.name_ru;
    const [siblings, similar] = await Promise.all([
      nameRu ? asanasAPI.getByNameRu(nameRu) : Promise.resolve([found]),
      asanasAPI.getSimilarAsanas(found.id).catch(() => []),
    ]);
    const siblingList = Array.isArray(siblings) && siblings.length ? siblings : [found];
    const similarList = similar || [];
    const merged = new Map();
    for (const a of [...siblingList, ...similarList, found]) {
      if (!a?.id) continue;
      const k = canonicalAsanaId(a.id);
      if (!k) continue;
      merged.set(k, merged.has(k) ? { ...merged.get(k), ...a, id: a.id } : a);
    }

    return {
      asana: found,
      allAsanas: [...merged.values()],
      similarAsanas: similarList,
    };
  };

  const loadPage = async () => {
    try {
      setError(null);
      setLoading(true);
      setAllAsanas([]);
      setSimilarAsanas([]);

      const data = await fetchPageData();
      if (!data) return;

      setAsana(data.asana);
      setAllAsanas(data.allAsanas);
      setSimilarAsanas(data.similarAsanas);
    } catch (err) {
      console.error('Error loading asana page:', err);
      setError(`Ошибка при загрузке асаны: ${err.message || 'Неизвестная ошибка'}`);
    } finally {
      setLoading(false);
    }
  };

  /** Группа: все каталожные записи с тем же русским названием — отображаются единой галереей. */
  const groupAsanas = useMemo(() => {
    if (!asana || !allAsanas.length) return [];
    const name = asana.name?.name_ru?.toLowerCase().trim();
    if (!name) return [asana];
    return allAsanas.filter((a) => a.name?.name_ru?.toLowerCase().trim() === name);
  }, [asana, allAsanas]);

  const firstAsana = groupAsanas[0] || asana;

  const seoTitle = firstAsana?.name?.name_ru || 'Асана';
  const seoDescription = useMemo(() => {
    const parts = [
      firstAsana?.name?.name_ru,
      firstAsana?.name?.name_sanskrit && `(${firstAsana.name.name_sanskrit})`,
      firstAsana?.name?.definition,
    ].filter(Boolean);
    return parts.length ? parts.join(' — ') : DEFAULT_SITE_DESCRIPTION;
  }, [firstAsana]);

  usePageSeo({
    title: seoTitle,
    description: seoDescription,
    path: asanaPagePathSafe(firstAsana || asana) || undefined,
    type: 'article',
  });

  /** Слайды для миниатюр и лайтбокса — все фото группы (+ фото владельца из focusPhoto, если ещё не в группе). */
  const slides = useMemo(() => {
    const base = buildSlidesFromAsanas(groupAsanas, photoGalleryVersion);
    const focusHint = resolveFocusPhotoHint(searchParams, null);
    if (!focusHint?.photoCanon || findSlideIndexByPhoto(base, focusHint.photoCanon) >= 0) {
      return base;
    }
    if (!focusHint.ownerId || !allAsanas.length) return base;
    const ownerCanon = canonicalAsanaId(focusHint.ownerId);
    const owner = allAsanas.find((a) => canonicalAsanaId(a.id) === ownerCanon);
    if (!owner?.photos?.length) return base;
    const extra = buildSlidesFromAsanas([owner], photoGalleryVersion);
    const merged = [...base];
    for (const slide of extra) {
      const pid = canonicalPhotoId(
        resolvePhotoId(slide.photo, slide.photoIndexInOwner)
      );
      if (pid && findSlideIndexByPhoto(merged, pid) < 0) merged.push(slide);
    }
    return merged;
  }, [groupAsanas, allAsanas, photoGalleryVersion, searchParams]);

  /** Пока лайтбокс открыт — не отдавать пустой массив слайдов. */
  const lightboxSlides = useMemo(() => {
    if (!lightboxOpen) {
      if (slides.length > 0) stableLightboxSlidesRef.current = slides;
      return slides;
    }
    if (slides.length > 0) {
      stableLightboxSlidesRef.current = slides;
      return slides;
    }
    if (stableLightboxSlidesRef.current.length > 0) {
      return stableLightboxSlidesRef.current;
    }
    return slides;
  }, [slides, lightboxOpen]);

  /** Карточки-миниатюры (parallel to slides, добавляем дополнительную инфу). */
  const tiles = useMemo(() => {
    return slides.map((slide) => {
      const own =
        groupAsanas.find((a) => a.id === slide.ownerId) ||
        groupAsanas.find(
          (a) => canonicalAsanaId(a.id) === canonicalAsanaId(slide.ownerId)
        );
      return { ...slide, ownerAsana: own || null };
    });
  }, [slides, groupAsanas]);

  /** Соседние группы каталога по русскому названию: предыдущая / следующая по алфавиту. */
  const catalogGroupNeighbors = useMemo(() => {
    if (!catalogForNav.length || !asana?.name?.name_ru) {
      return { prevRep: null, nextRep: null };
    }
    const currentKey = normalizeCatalogNameKey(asana.name.name_ru);
    if (!currentKey) return { prevRep: null, nextRep: null };
    const byKey = new Map();
    for (const a of catalogForNav) {
      const nk = normalizeCatalogNameKey(a.name?.name_ru || '');
      if (!nk || byKey.has(nk)) continue;
      byKey.set(nk, a);
    }
    const reps = [...byKey.values()].sort((x, y) =>
      (x.name?.name_ru || '').localeCompare(y.name?.name_ru || '', 'ru', {
        sensitivity: 'base',
      })
    );
    const idx = reps.findIndex(
      (r) => normalizeCatalogNameKey(r.name?.name_ru || '') === currentKey
    );
    if (idx < 0) return { prevRep: null, nextRep: null };
    return {
      prevRep: idx > 0 ? reps[idx - 1] : null,
      nextRep: idx < reps.length - 1 ? reps[idx + 1] : null,
    };
  }, [catalogForNav, asana]);

  /** Закрывать лайтбокс при смене URL, кроме перехода с ?focusPhoto / ?focusOwner. */
  useEffect(() => {
    let routeId = id != null ? String(id) : '';
    if (routeId.endsWith('-page')) routeId = routeId.replace(/-page$/i, '');
    const prev = lastRouteIdRef.current;
    const openingWithFocus =
      searchParams.has('focusPhoto') || searchParams.has('focusOwner');
    if (prev !== null && prev !== routeId && !openingWithFocus) {
      setLightboxOpen(false);
      setLightboxIndex(0);
    }
    lastRouteIdRef.current = routeId;
  }, [id, searchParams]);

  /** ?focusPhoto / ?focusOwner — открыть лайтбокс после загрузки слайдов. */
  useEffect(() => {
    const focusHint = resolveFocusPhotoHint(searchParams, location.state);
    if (!focusHint?.photoCanon) {
      const focusOwnerOnly = searchParams.get('focusOwner');
      if (!focusOwnerOnly || loading || !slides.length) return;
      const canon = canonicalAsanaId(focusOwnerOnly);
      const idx = slides.findIndex((s) => canonicalAsanaId(s.ownerId) === canon);
      if (idx >= 0) {
        setLightboxIndex(idx);
        setLightboxOpen(true);
      }
      const next = new URLSearchParams(searchParams);
      next.delete('focusOwner');
      setSearchParams(next, { replace: true });
      return;
    }

    if (loading || !slides.length) return;

    const idx = findSlideIndexByPhoto(slides, focusHint.photoCanon);
    if (idx >= 0) {
      setLightboxIndex(idx);
      setLightboxOpen(true);
      clearFocusPhoto();
      if (searchParams.has('focusPhoto') || searchParams.has('focusOwner')) {
        const next = new URLSearchParams(searchParams);
        next.delete('focusPhoto');
        next.delete('focusOwner');
        setSearchParams(next, { replace: true });
      }
      if (location.state?.focusPhoto) {
        navigate(
          { pathname: location.pathname, search: location.search },
          { replace: true, state: {} }
        );
      }
      return;
    }

    if (focusHint.ownerId && !focusEnrichBusyRef.current && asana) {
      focusEnrichBusyRef.current = true;
      enrichAllAsanasForOwner(
        { asana, allAsanas, similarAsanas },
        focusHint.ownerId
      )
        .then((enriched) => {
          if (enriched?.allAsanas) setAllAsanas(enriched.allAsanas);
        })
        .finally(() => {
          focusEnrichBusyRef.current = false;
        });
    }
  }, [id, searchParams, slides, loading, setSearchParams, location.state, location.pathname, location.search, asana, allAsanas, similarAsanas, navigate]);

  /** Запомнить id текущего кадра лайтбокса. */
  useEffect(() => {
    if (!lightboxOpen) {
      activeLightboxPhotoRef.current = null;
      return;
    }
    const slide = lightboxSlides[lightboxIndex];
    if (!slide) return;
    activeLightboxPhotoRef.current = canonicalPhotoId(
      resolvePhotoId(slide.photo, slide.photoIndexInOwner)
    );
  }, [lightboxOpen, lightboxIndex, lightboxSlides]);

  /** При смене слайдов держать тот же кадр по id фото. */
  useEffect(() => {
    const photoId = activeLightboxPhotoRef.current;
    if (!lightboxOpen || !photoId || !slides.length) return;
    const idx = findSlideIndexByPhoto(slides, photoId);
    if (idx >= 0 && idx !== lightboxIndex) setLightboxIndex(idx);
  }, [slides, lightboxOpen, lightboxIndex]);

  /** После мутации с визуальными изменениями — якорь по id фото. */
  useEffect(() => {
    const anchor = lightboxAnchorPhotoRef.current;
    if (!anchor || !lightboxOpen || !slides.length) return;
    const idx = findSlideIndexByPhoto(slides, anchor);
    if (idx >= 0) setLightboxIndex(idx);
    lightboxAnchorPhotoRef.current = null;
  }, [slides, lightboxOpen, photoGalleryVersion]);

  const mergePhotoImagesFromPrevious = (nextAsanas, prevAsanas) => {
    const prevPhotos = new Map();
    for (const a of prevAsanas || []) {
      for (const p of a.photos || []) {
        const k = canonicalPhotoId(resolvePhotoId(p));
        if (k && p?.image) prevPhotos.set(k, p);
      }
    }
    return (nextAsanas || []).map((a) => {
      if (!a?.photos?.length) return a;
      const photos = a.photos.map((p, idx) => {
        const k = canonicalPhotoId(resolvePhotoId(p, idx));
        if (!k || p?.image) return p;
        const prev = prevPhotos.get(k);
        return prev ? { ...prev, ...p, image: prev.image } : p;
      });
      return { ...a, photos };
    });
  };

  const handleMutation = async (opts = {}) => {
    const bumpGallery =
      typeof opts === 'object' && opts !== null ? opts.bumpGallery !== false : true;

    if (!bumpGallery) {
      const enrichIds = Array.isArray(opts?.enrichAsanaIds)
        ? opts.enrichAsanaIds.filter(Boolean)
        : [];
      if (enrichIds.length && !mutationBusyRef.current) {
        mutationBusyRef.current = true;
        try {
          const merged = [...allAsanas];
          const known = new Set(merged.map((a) => canonicalAsanaId(a.id)));
          for (const aid of enrichIds) {
            const canon = canonicalAsanaId(aid);
            if (!canon || known.has(canon)) continue;
            const extra = await asanasAPI.getById(aid).catch(() => null);
            if (extra?.id) {
              merged.push(extra);
              known.add(canon);
            }
          }
          setAllAsanas(mergePhotoImagesFromPrevious(merged, allAsanas));
        } catch (err) {
          console.error('Error enriching linked asanas:', err);
        } finally {
          mutationBusyRef.current = false;
        }
      }
      return;
    }

    if (mutationBusyRef.current) return;
    mutationBusyRef.current = true;

    const anchorSlide = lightboxSlides[lightboxIndex] || slides[lightboxIndex];
    if (lightboxOpen && anchorSlide) {
      const photoId = canonicalPhotoId(
        resolvePhotoId(anchorSlide.photo, anchorSlide.photoIndexInOwner)
      );
      lightboxAnchorPhotoRef.current = photoId;
      activeLightboxPhotoRef.current = photoId;
    }

    try {
      let data = await fetchPageData();
      if (!data) return;

      const anchorPhoto = lightboxAnchorPhotoRef.current;
      if (anchorPhoto) {
        const linked = await asanasAPI.getSimilarPhotos(anchorPhoto).catch(() => []);
        for (const row of linked || []) {
          const aid = row.asana_id;
          if (!aid) continue;
          const canon = canonicalAsanaId(aid);
          if (data.allAsanas.some((a) => canonicalAsanaId(a.id) === canon)) continue;
          const extra = await asanasAPI.getById(aid).catch(() => null);
          if (extra?.id) data.allAsanas.push(extra);
        }
      }

      data.allAsanas = mergePhotoImagesFromPrevious(data.allAsanas, allAsanas);

      if (bumpGallery) {
        setPhotoGalleryVersion((v) => v + 1);
      }
      setAsana(data.asana);
      setAllAsanas(data.allAsanas);
      setSimilarAsanas(data.similarAsanas);

      const name = data.asana.name?.name_ru?.toLowerCase().trim();
      const group = name
        ? data.allAsanas.filter((a) => a.name?.name_ru?.toLowerCase().trim() === name)
        : [data.asana];
      const refreshed = buildSlidesFromAsanas(
        group,
        bumpGallery ? photoGalleryVersion + 1 : photoGalleryVersion
      );
      if (lightboxOpen && !refreshed.length) {
        setLightboxOpen(false);
        stableLightboxSlidesRef.current = [];
        document.body.style.overflow = '';
      }
    } catch (err) {
      console.error('Error refreshing asana page:', err);
    } finally {
      mutationBusyRef.current = false;
    }
  };

  const handleAsanaDeleted = () => {
    setLightboxOpen(false);
    navigate('/asanas');
  };

  if (loading && !asana) {
    return <div className="container">Загрузка...</div>;
  }

  if (error) {
    return (
      <div className="container">
        <div className="error-message">{error}</div>
        <p>
          Попробуйте вернуться к <a href="/asanas">списку асан</a>
        </p>
      </div>
    );
  }

  if (!asana) {
    return (
      <div className="container">
        <div className="error-message">Асана не найдена</div>
        <p>
          Попробуйте вернуться к <a href="/asanas">списку асан</a>
        </p>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="catalog-toolbar">
        <CatalogPageNav />
      </div>
      <div className="asana-detail">
        <div className="asana-header">
          <div className="asana-header-inner">
            <div className="asana-catalog-step-slot asana-catalog-step-slot--prev">
              {catalogGroupNeighbors.prevRep ? (
                <button
                  type="button"
                  className="asana-catalog-step-btn"
                  aria-label={`Предыдущая асана: ${
                    catalogGroupNeighbors.prevRep.name?.name_ru || ''
                  }`}
                  onClick={() => navigate(asanaPagePath(catalogGroupNeighbors.prevRep))}
                >
                  ← Назад
                </button>
              ) : null}
            </div>
            <h1 className="asana-title asana-title--header-center">
              {firstAsana?.name?.name_ru}
            </h1>
            <div className="asana-catalog-step-slot asana-catalog-step-slot--next">
              {catalogGroupNeighbors.nextRep ? (
                <button
                  type="button"
                  className="asana-catalog-step-btn"
                  aria-label={`Следующая асана: ${
                    catalogGroupNeighbors.nextRep.name?.name_ru || ''
                  }`}
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
          {tiles.length > 0 ? (
            <div className="user-photo-grid">
              {tiles.map((tile, i) => (
                <div key={tile.key} className="user-photo-cell">
                  <button
                    type="button"
                    className="user-photo-cell-btn"
                    aria-label={`Открыть фото ${i + 1} из ${tiles.length}`}
                    onClick={() => {
                      setLightboxIndex(i);
                      setLightboxOpen(true);
                    }}
                  >
                    <img src={tile.src} alt="" loading="lazy" />
                  </button>
                  <div className="user-photo-cell-caption">{tile.caption}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="user-gallery-empty">Фотографии отсутствуют</p>
          )}
        </div>
      </div>

      <UserPhotoLightbox
        open={lightboxOpen}
        onClose={() => {
          setLightboxOpen(false);
          stableLightboxSlidesRef.current = [];
        }}
        slides={lightboxSlides}
        index={lightboxIndex}
        setIndex={setLightboxIndex}
        allAsanas={allAsanas}
        similarAsanas={similarAsanas}
        pageAsana={firstAsana || asana}
        getPageAsana={() => firstAsana || asana}
        photoGalleryVersion={photoGalleryVersion}
        onMutation={handleMutation}
        onAsanaDeleted={handleAsanaDeleted}
        getTitleParts={(slide, ownerAsana) => {
          const groupNameKey = normalizeCatalogNameKey(firstAsana?.name?.name_ru || '');
          const ownerKey = normalizeCatalogNameKey(ownerAsana?.name?.name_ru || '');
          const subtitle =
            ownerAsana && ownerKey && ownerKey !== groupNameKey
              ? ownerAsana.name?.name_ru
              : null;
          return {
            title: firstAsana?.name?.name_ru || 'Асана',
            subtitle,
          };
        }}
        renderEditionCaption={(slide) => {
          if (!slide.linkId) return slide.caption;
          return (
            <Link
              className="user-photo-source-caption-link user-photo-source-caption-link--on-dark"
              to={`/sources/${slide.linkId}/asanas`}
              onClick={(e) => e.stopPropagation()}
            >
              {slide.caption}
            </Link>
          );
        }}
      />
    </div>
  );
};

export default AsanaDetail;
