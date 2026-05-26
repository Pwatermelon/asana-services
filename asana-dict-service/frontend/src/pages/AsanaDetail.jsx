import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { asanasAPI } from '../api/asanas';
import { asanaPagePath } from '../components/CompactAsanaRow';
import UserPhotoLightbox from '../components/UserPhotoLightbox';
import { normalizeCatalogNameKey } from '../utils/catalogSearch';
import { buildSlidesFromAsanas, canonicalAsanaId } from '../utils/asanaSameAs';
import '../styles/AsanaDetail.css';

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
  const [photoGalleryVersion, setPhotoGalleryVersion] = useState(0);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const lastRouteIdRef = useRef(null);

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

      try {
        const found = await asanasAPI.getById(asanaId);
        if (found) {
          setAsana(found);
          loadSimilarAsanas(found);
          setLoading(false);
          return;
        }
      } catch (apiError) {
        console.warn('getById failed, falling back to getAll:', apiError);
      }

      const all = await asanasAPI.getAll();
      const normalized = asanaId.trim();
      const possibleIds = [
        normalized,
        normalized.startsWith('asana_') ? normalized : `asana_${normalized}`,
        normalized.replace(/^asana_/, ''),
        `http://www.semanticweb.org/platinum_watermelon/ontologies/Asana#${normalized}`,
        `http://www.semanticweb.org/platinum_watermelon/ontologies/Asana#${
          normalized.startsWith('asana_') ? normalized : `asana_${normalized}`
        }`,
      ];

      let foundAsana = null;
      for (const a of all) {
        const fullId = a.id;
        const shortId = fullId.split('#').pop();
        for (const possibleId of possibleIds) {
          if (fullId === possibleId || shortId === possibleId) {
            foundAsana = a;
            break;
          }
          const shortIdNoPrefix = shortId.replace(/^asana_/, '');
          const possibleIdNoPrefix = possibleId
            .replace(/^asana_/, '')
            .replace(/^http.*#/, '');
          if (
            shortIdNoPrefix &&
            possibleIdNoPrefix &&
            shortIdNoPrefix === possibleIdNoPrefix
          ) {
            foundAsana = a;
            break;
          }
        }
        if (foundAsana) break;
      }

      setAsana(foundAsana);
      if (!foundAsana) {
        setError(`Асана не найдена (ID: ${normalized})`);
      } else {
        loadSimilarAsanas(foundAsana);
        setError(null);
      }
    } catch (err) {
      console.error('Error loading asana:', err);
      setError(`Ошибка при загрузке асаны: ${err.message || 'Неизвестная ошибка'}`);
    } finally {
      setLoading(false);
    }
  };

  const loadAllAsanas = async () => {
    try {
      const data = await asanasAPI.getAll();
      setAllAsanas(data);
    } catch (err) {
      console.error('Error loading all asanas:', err);
    }
  };

  const loadSimilarAsanas = async (currentAsana) => {
    if (!currentAsana) return;
    try {
      const similar = await asanasAPI.getSimilarAsanas(currentAsana.id);
      setSimilarAsanas(similar || []);
    } catch (err) {
      console.error('Error loading similar asanas:', err);
      setSimilarAsanas([]);
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

  /** Слайды для миниатюр и лайтбокса — все фото группы. */
  const slides = useMemo(
    () => buildSlidesFromAsanas(groupAsanas, photoGalleryVersion),
    [groupAsanas, photoGalleryVersion]
  );

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
    if (!allAsanas.length || !asana?.name?.name_ru) {
      return { prevRep: null, nextRep: null };
    }
    const currentKey = normalizeCatalogNameKey(asana.name.name_ru);
    if (!currentKey) return { prevRep: null, nextRep: null };
    const byKey = new Map();
    for (const a of allAsanas) {
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
  }, [allAsanas, asana]);

  /** Закрывать лайтбокс при смене URL (между страницами асан). */
  useEffect(() => {
    let routeId = id != null ? String(id) : '';
    if (routeId.endsWith('-page')) routeId = routeId.replace(/-page$/i, '');
    const prev = lastRouteIdRef.current;
    if (prev !== null && prev !== routeId) {
      setLightboxOpen(false);
      setLightboxIndex(0);
    }
    lastRouteIdRef.current = routeId;
  }, [id]);

  /** Поддержка ?focusOwner=...: открыть лайтбокс на первом фото указанного владельца. */
  useEffect(() => {
    const focus = searchParams.get('focusOwner');
    if (!focus || !slides.length) return;
    const canon = canonicalAsanaId(focus);
    const idx = slides.findIndex((s) => canonicalAsanaId(s.ownerId) === canon);
    if (idx >= 0) {
      setLightboxIndex(idx);
      setLightboxOpen(true);
    }
    if (searchParams.has('focusOwner')) {
      const next = new URLSearchParams(searchParams);
      next.delete('focusOwner');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, slides, setSearchParams]);

  const handleMutation = async () => {
    setPhotoGalleryVersion((v) => v + 1);
    await Promise.all([loadAllAsanas(), loadAsana()]);
  };

  const handleAsanaDeleted = () => {
    setLightboxOpen(false);
    navigate('/asanas');
  };

  if (loading) {
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
        onClose={() => setLightboxOpen(false)}
        slides={slides}
        index={lightboxIndex}
        setIndex={setLightboxIndex}
        allAsanas={allAsanas}
        similarAsanas={similarAsanas}
        pageAsana={asana}
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
