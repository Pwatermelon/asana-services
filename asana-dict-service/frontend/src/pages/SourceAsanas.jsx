import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { asanasAPI } from '../api/asanas';
import { sourcesAPI } from '../api/sources';
import UserPhotoLightbox from '../components/UserPhotoLightbox';
import {
  buildSlidesFromAsanas,
  canonicalAsanaId,
  catalogRepresentativeByNameRu,
} from '../utils/asanaSameAs';
import {
  catalogNameSuggestions,
  filterAsanasByCatalogQuery,
} from '../utils/catalogSearch';
import { usePageSeo, DEFAULT_SITE_DESCRIPTION } from '../utils/pageSeo';
import '../styles/AsanaDetail.css';
import '../styles/AsanasList.css';
import './SourceAsanas.css';

function findOwnerInList(ownerId, list) {
  return (
    list.find((a) => a.id === ownerId) ||
    list.find((a) => canonicalAsanaId(a.id) === canonicalAsanaId(ownerId)) ||
    null
  );
}

/** Поиск только по асанам текущего источника; результат — сетка миниатюр. */
function SourceAsanaSearchBar({ asanas, searchQuery, setSearchQuery, onRunSearch }) {
  const [suggestOpen, setSuggestOpen] = useState(false);
  const suggestions = useMemo(
    () => catalogNameSuggestions(asanas, searchQuery, 14),
    [asanas, searchQuery]
  );
  const showList =
    suggestOpen && searchQuery.trim().length >= 1 && suggestions.length > 0;

  return (
    <div className="search-form-container source-asanas-search">
      <form
        className="search-form"
        onSubmit={(e) => {
          e.preventDefault();
          onRunSearch();
        }}
      >
        <div
          className={`search-input-container${showList ? ' search-input-container--suggest' : ''}`}
        >
          <input
            type="search"
            enterKeyHint="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSuggestOpen(true)}
            onBlur={() => {
              window.setTimeout(() => setSuggestOpen(false), 200);
            }}
            placeholder="Поиск по асанам этого источника…"
            className="search-input"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" className="search-button">
            Найти
          </button>
          {showList && (
            <ul
              className="catalog-search-suggestions"
              role="listbox"
              aria-label="Подсказки по названию"
            >
              {suggestions.map((name) => (
                <li key={name} role="none">
                  <button
                    type="button"
                    className="catalog-search-suggestion-btn"
                    role="option"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setSearchQuery(name);
                      setSuggestOpen(false);
                      onRunSearch(name);
                    }}
                  >
                    {name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </form>
    </div>
  );
}

function PhotoThumbnailGrid({ tiles, onOpenTile }) {
  if (!tiles.length) {
    return <p className="user-gallery-empty">Ничего не найдено</p>;
  }
  return (
    <div className="user-photo-grid">
      {tiles.map((tile, i) => (
        <div key={tile.key} className="user-photo-cell">
          <button
            type="button"
            className="user-photo-cell-btn"
            aria-label={`Открыть фото ${i + 1} из ${tiles.length}: ${tile.asanaNameRu}`}
            onClick={() => onOpenTile(tile)}
          >
            <img src={tile.src} alt="" loading="lazy" />
          </button>
          <div className="user-photo-cell-caption">{tile.asanaNameRu}</div>
        </div>
      ))}
    </div>
  );
}

const SourceAsanas = () => {
  const { id } = useParams();
  const [source, setSource] = useState(null);
  const [sourceAsanas, setSourceAsanas] = useState([]);
  const [allAsanas, setAllAsanas] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchActive, setSearchActive] = useState(false);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxSlides, setLightboxSlides] = useState([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [similarAsanas, setSimilarAsanas] = useState([]);
  const [photoGalleryVersion, setPhotoGalleryVersion] = useState(0);

  usePageSeo({
    title: source ? `Асаны из источника: ${source.title}` : 'Асаны из источника',
    description: source
      ? [source.title, source.author, source.year, source.annotation].filter(Boolean).join(' · ')
      : DEFAULT_SITE_DESCRIPTION,
    path: id ? `/sources/${id}/asanas` : undefined,
  });

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const shortId = id.split('#').pop().replace('source_', '');
      const [sourceData, asanasData, allData] = await Promise.all([
        sourcesAPI.getById(id),
        asanasAPI.getBySource(shortId),
        asanasAPI.getAll().catch(() => []),
      ]);
      setSource(sourceData);
      const sorted = [...(asanasData || [])].sort((a, b) =>
        (a.name?.name_ru || '').localeCompare(b.name?.name_ru || '', 'ru', {
          sensitivity: 'base',
        })
      );
      setSourceAsanas(sorted);
      setAllAsanas(allData || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const sourceSlides = useMemo(
    () => buildSlidesFromAsanas(sourceAsanas, photoGalleryVersion),
    [sourceAsanas, photoGalleryVersion]
  );

  const allTiles = useMemo(() => {
    return sourceSlides.map((slide) => {
      const own = findOwnerInList(slide.ownerId, sourceAsanas);
      return {
        ...slide,
        asanaNameRu: (own?.name?.name_ru || '').trim() || 'Асана',
        ownerAsana: own,
      };
    });
  }, [sourceSlides, sourceAsanas]);

  const runSourceSearch = useCallback(
    (explicitQuery) => {
      const raw =
        explicitQuery !== undefined && explicitQuery !== null
          ? String(explicitQuery)
          : searchQuery;
      const q = raw.trim();
      if (!q) {
        setSearchActive(false);
        return;
      }
      setSearchQuery(raw);
      setSearchActive(true);
    },
    [searchQuery]
  );

  const searchTiles = useMemo(() => {
    if (!searchActive || !searchQuery.trim()) return [];
    const matched = filterAsanasByCatalogQuery(sourceAsanas, searchQuery);
    const matchedCanon = new Set(matched.map((a) => canonicalAsanaId(a.id)));
    return allTiles.filter((t) => matchedCanon.has(canonicalAsanaId(t.ownerId)));
  }, [searchActive, searchQuery, sourceAsanas, allTiles]);

  const tilesByLetter = useMemo(() => {
    const grouped = {};
    for (const tile of allTiles) {
      const letter = tile.asanaNameRu?.[0]?.toUpperCase() || '?';
      if (!grouped[letter]) grouped[letter] = [];
      grouped[letter].push(tile);
    }
    Object.keys(grouped).forEach((letter) => {
      grouped[letter].sort((a, b) =>
        a.asanaNameRu.localeCompare(b.asanaNameRu, 'ru', { sensitivity: 'base' })
      );
    });
    return grouped;
  }, [allTiles]);

  const alphabet = useMemo(
    () => Object.keys(tilesByLetter).sort((a, b) => a.localeCompare(b, 'ru')),
    [tilesByLetter]
  );

  /** В лайтбоксе на странице источника — только фото этого источника, не весь каталог. */
  const openLightboxForTile = useCallback(
    (tile) => {
      const idx = sourceSlides.findIndex((s) => s.key === tile.key);
      setLightboxSlides(sourceSlides);
      setLightboxIndex(idx >= 0 ? idx : 0);
      setLightboxOpen(true);
    },
    [sourceSlides]
  );

  useEffect(() => {
    if (!lightboxOpen || !lightboxSlides.length || !allAsanas.length) {
      setSimilarAsanas([]);
      return undefined;
    }
    const slide = lightboxSlides[lightboxIndex];
    if (!slide) return undefined;
    const owner = findOwnerInList(slide.ownerId, allAsanas);
    const rep = catalogRepresentativeByNameRu(allAsanas, owner?.name?.name_ru);
    if (!rep?.id) return undefined;

    let cancelled = false;
    asanasAPI
      .getSimilarAsanas(rep.id)
      .then((data) => {
        if (!cancelled) setSimilarAsanas(data || []);
      })
      .catch(() => {
        if (!cancelled) setSimilarAsanas([]);
      });
    return () => {
      cancelled = true;
    };
  }, [lightboxOpen, lightboxIndex, lightboxSlides, allAsanas]);

  const handleMutation = async () => {
    const nextVersion = photoGalleryVersion + 1;
    setPhotoGalleryVersion(nextVersion);
    const shortId = id.split('#').pop().replace('source_', '');
    const [asanasData, allData] = await Promise.all([
      asanasAPI.getBySource(shortId),
      asanasAPI.getAll().catch(() => []),
    ]);
    const sorted = [...(asanasData || [])].sort((a, b) =>
      (a.name?.name_ru || '').localeCompare(b.name?.name_ru || '', 'ru', {
        sensitivity: 'base',
      })
    );
    setSourceAsanas(sorted);
    setAllAsanas(allData || []);

    if (lightboxOpen) {
      const refreshed = buildSlidesFromAsanas(sorted, nextVersion);
      const prevKey = lightboxSlides[lightboxIndex]?.key;
      setLightboxSlides(refreshed);
      if (!refreshed.length) {
        setLightboxOpen(false);
      } else if (prevKey) {
        const idx = refreshed.findIndex((s) => s.key === prevKey);
        setLightboxIndex(idx >= 0 ? idx : 0);
      } else {
        setLightboxIndex(0);
      }
    }
  };

  const handleAsanaDeleted = async () => {
    setLightboxOpen(false);
    setPhotoGalleryVersion((v) => v + 1);
    await loadData();
  };

  const getPageAsanaForLightbox = useCallback(
    (_slide, ownerAsana) => {
      if (!ownerAsana) return null;
      return (
        catalogRepresentativeByNameRu(allAsanas, ownerAsana.name?.name_ru) || ownerAsana
      );
    },
    [allAsanas]
  );

  if (loading) {
    return <div className="container">Загрузка...</div>;
  }

  if (!source) {
    return <div className="container">Источник не найден</div>;
  }

  return (
    <div className="container source-asanas-page">
      <div className="page-header source-asanas-header">
        <h1 className="page-title">Асаны из источника: {source.title}</h1>
        <p className="page-description">
          Автор: {source.author}
          {source.year != null && source.year !== '' && ` • ${source.year}`}
          {source.publisher && ` • ${source.publisher}`}
        </p>
        {source.annotation ? (
          <p className="page-description source-asanas-annotation">{source.annotation}</p>
        ) : null}

        <SourceAsanaSearchBar
          asanas={sourceAsanas}
          searchQuery={searchQuery}
          setSearchQuery={(q) => {
            setSearchQuery(q);
            if (!String(q).trim()) setSearchActive(false);
          }}
          onRunSearch={runSourceSearch}
        />
      </div>

      {searchActive ? (
        <div className="user-gallery-block source-asanas-gallery">
          <h2 className="letter-heading">Результаты поиска: {searchQuery.trim()}</h2>
          <PhotoThumbnailGrid tiles={searchTiles} onOpenTile={openLightboxForTile} />
        </div>
      ) : allTiles.length > 0 ? (
        <>
          <div className="alphabet-nav">
            {alphabet.map((letter) => (
              <a key={letter} href={`#letter-${letter}`} className="alphabet-link">
                {letter}
              </a>
            ))}
          </div>

          {alphabet.map((letter) => (
            <div
              key={letter}
              className="letter-section source-asanas-letter-section"
              id={`letter-${letter}`}
            >
              <h2 className="letter-heading">{letter}</h2>
              <PhotoThumbnailGrid
                tiles={tilesByLetter[letter]}
                onOpenTile={openLightboxForTile}
              />
            </div>
          ))}
        </>
      ) : (
        <p className="user-gallery-empty">В этом источнике пока нет фотографий.</p>
      )}

      <UserPhotoLightbox
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        slides={lightboxSlides}
        index={lightboxIndex}
        setIndex={setLightboxIndex}
        allAsanas={allAsanas}
        similarAsanas={similarAsanas}
        pageAsana={null}
        getPageAsana={getPageAsanaForLightbox}
        editionStripVariant="asana-link"
        photoGalleryVersion={photoGalleryVersion}
        onMutation={handleMutation}
        onAsanaDeleted={handleAsanaDeleted}
        getTitleParts={(_slide, ownerAsana) => ({
          title: ownerAsana?.name?.name_ru || 'Асана',
          subtitle: null,
        })}
      />
    </div>
  );
};

export default SourceAsanas;
