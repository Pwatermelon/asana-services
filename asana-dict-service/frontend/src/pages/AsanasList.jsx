import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { asanasAPI } from '../api/asanas';
import CatalogPageNav from '../components/CatalogPageNav';
import {
  dedupeAsanasByDisplayNameRu,
  filterAsanasByCatalogQuery,
  normalizeCatalogNameKey,
} from '../utils/catalogSearch';
import { CompactAsanaRow } from '../components/CompactAsanaRow';
import { scrollToCatalogLetter } from '../utils/catalogFocus';
import '../styles/AsanasList.css';

const AsanasList = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [asanas, setAsanas] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAsanas();
  }, []);

  useEffect(() => {
    const q = searchParams.get('search');
    if (!q || !asanas.length) return;
    setSearchQuery(q);
    const matched = filterAsanasByCatalogQuery(asanas, q);
    setSearchResults(dedupeAsanasByDisplayNameRu(matched));
  }, [searchParams, asanas]);

  /** Прокрутка к букве после перехода с другой страницы (/asanas#letter-…) */
  useEffect(() => {
    if (loading || searchResults) return;
    const hash = location.hash;
    if (!hash || hash.length < 2) return;
    const id = decodeURIComponent(hash.slice(1));
    const scrollToLetter = () => scrollToCatalogLetter(id);
    scrollToLetter();
    const t = window.setTimeout(scrollToLetter, 180);
    return () => window.clearTimeout(t);
  }, [loading, searchResults, location.hash]);

  const loadAsanas = async () => {
    try {
      const data = await asanasAPI.getCatalog();
      setAsanas(data);
    } catch (error) {
      console.error('Error loading asanas:', error);
    } finally {
      setLoading(false);
    }
  };

  /** Одна строка каталога на русское название (все роли). */
  const mergedAsanasByRuName = useMemo(() => {
    const merged = new Map();
    asanas.forEach((asana) => {
      const nameKey = normalizeCatalogNameKey(asana.name?.name_ru || '');
      if (!nameKey) return;
      if (!merged.has(nameKey)) {
        merged.set(nameKey, {
          ...asana,
          allAsanaIds: [asana.id],
        });
      } else {
        merged.get(nameKey).allAsanaIds.push(asana.id);
      }
    });

    const mergedArray = Array.from(merged.values());
    const byLetter = {};
    mergedArray.forEach((asana) => {
      const firstLetter = asana.name?.name_ru?.[0]?.toUpperCase() || '?';
      if (!byLetter[firstLetter]) {
        byLetter[firstLetter] = [];
      }
      byLetter[firstLetter].push(asana);
    });

    Object.keys(byLetter).forEach((letter) => {
      byLetter[letter].sort((a, b) =>
        (a.name?.name_ru || '').localeCompare(b.name?.name_ru || '', 'ru')
      );
    });

    return byLetter;
  }, [asanas]);

  const catalogLetters = useMemo(
    () => Object.keys(mergedAsanasByRuName).sort((a, b) => a.localeCompare(b, 'ru')),
    [mergedAsanasByRuName]
  );

  const runCatalogSearch = useCallback(
    (explicitQuery) => {
      const raw =
        explicitQuery !== undefined && explicitQuery !== null
          ? String(explicitQuery)
          : searchQuery;
      const q = raw.trim();
      if (!q) {
        setSearchResults(null);
        return;
      }
      const matched = filterAsanasByCatalogQuery(asanas, q);
      setSearchResults(dedupeAsanasByDisplayNameRu(matched));
    },
    [asanas, searchQuery]
  );

  if (loading) {
    return <div className="container">Загрузка...</div>;
  }

  return (
    <div className="container">
      <header className="catalog-page-head">
        <h1 className="page-title page-title--catalog">Каталог асан</h1>
      </header>

      <div className="catalog-toolbar catalog-toolbar--sticky">
        <CatalogPageNav
          mode="inline"
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onSearch={runCatalogSearch}
          letters={catalogLetters}
          showAlphabet={!searchResults}
        />
      </div>

      {searchResults ? (
        <div className="letter-section">
          <h2 className="letter-heading">Результаты поиска: {searchQuery}</h2>
          {searchResults.length > 0 ? (
            <div className="asana-lines">
              {searchResults.map((asana) => (
                <CompactAsanaRow key={asana.id} asana={asana} />
              ))}
            </div>
          ) : (
            <div className="no-asanas">
              <p>Асаны не найдены</p>
            </div>
          )}
        </div>
      ) : (
        Object.entries(mergedAsanasByRuName)
          .sort(([a], [b]) => a.localeCompare(b, 'ru'))
          .map(([letter, letterAsanas]) => (
            <div key={letter} className="letter-section" id={`letter-${letter}`}>
              <h2 className="letter-heading">{letter}</h2>
              <div className="asana-lines">
                {letterAsanas.map((asana) => (
                  <CompactAsanaRow key={asana.id} asana={asana} />
                ))}
              </div>
            </div>
          ))
      )}
    </div>
  );
};

export default AsanasList;
