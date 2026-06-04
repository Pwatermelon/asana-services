import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { asanasAPI } from '../api/asanas';
import {
  catalogNameSuggestions,
  dedupeAsanasByDisplayNameRu,
  filterAsanasByCatalogQuery,
  normalizeCatalogNameKey,
} from '../utils/catalogSearch';
import { CompactAsanaRow } from '../components/CompactAsanaRow';
import '../styles/AsanasList.css';

/** Поиск по каталогу: подсказки из загруженных асан, поиск по целым словам. */
function CatalogSearchBar({ asanas, searchQuery, setSearchQuery, onRunSearch }) {
  const [suggestOpen, setSuggestOpen] = useState(false);
  const suggestions = useMemo(
    () => catalogNameSuggestions(asanas, searchQuery, 14),
    [asanas, searchQuery]
  );
  const showList =
    suggestOpen && searchQuery.trim().length >= 1 && suggestions.length > 0;

  return (
    <div className="search-form-container">
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
            placeholder="Поиск…"
            className="search-input"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" className="search-button">
            Найти
          </button>
          {showList && (
            <ul className="catalog-search-suggestions" role="listbox" aria-label="Подсказки по названию">
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

const AsanasList = () => {
  const [asanas, setAsanas] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAsanas();
  }, []);

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

  const runCatalogSearch = useCallback(
    (explicitQuery) => {
      const raw = explicitQuery !== undefined && explicitQuery !== null ? String(explicitQuery) : searchQuery;
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
      <div className="page-header">
        <h1 className="page-title">Каталог асан</h1>

        <CatalogSearchBar
          asanas={asanas}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onRunSearch={runCatalogSearch}
        />
      </div>

      {!searchResults && (
        <div className="alphabet-nav">
          {Object.keys(mergedAsanasByRuName)
            .sort()
            .map((letter) => (
              <a key={letter} href={`#letter-${letter}`} className="alphabet-link">
                {letter}
              </a>
            ))}
        </div>
      )}

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
          .sort()
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
