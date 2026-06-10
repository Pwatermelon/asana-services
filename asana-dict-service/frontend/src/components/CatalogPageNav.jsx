import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { asanasAPI } from '../api/asanas';
import CatalogSearchBar from './CatalogSearchBar';
import { scrollToCatalogLetter } from '../utils/catalogFocus';
import '../styles/AsanasList.css';

/**
 * Поиск + алфавит каталога.
 * mode=inline — на главной (/asanas), поиск и якоря на той же странице.
 * mode=navigate — на странице асаны, переход на /asanas с query или якорем.
 */
export default function CatalogPageNav({
  mode = 'navigate',
  searchQuery: controlledQuery,
  setSearchQuery: setControlledQuery,
  onSearch,
  letters: lettersProp,
  showAlphabet = true,
}) {
  const navigate = useNavigate();
  const [asanas, setAsanas] = useState([]);
  const [internalQuery, setInternalQuery] = useState('');

  const isInline = mode === 'inline';
  const searchQuery = isInline ? controlledQuery : internalQuery;
  const setSearchQuery = isInline ? setControlledQuery : setInternalQuery;

  useEffect(() => {
    asanasAPI.getCatalog().then(setAsanas).catch(() => setAsanas([]));
  }, []);

  const lettersFromCatalog = useMemo(() => {
    const set = new Set();
    for (const a of asanas) {
      const ch = a.name?.name_ru?.[0]?.toUpperCase();
      if (ch) set.add(ch);
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'ru'));
  }, [asanas]);

  const letters = lettersProp?.length ? lettersProp : lettersFromCatalog;

  const goSearch = (q) => {
    const query = (q ?? searchQuery).trim();
    if (!query) return;
    if (isInline) {
      onSearch?.(query);
      return;
    }
    navigate(`/asanas?search=${encodeURIComponent(query)}`);
  };

  return (
    <>
      <CatalogSearchBar
        asanas={asanas}
        searchQuery={searchQuery ?? ''}
        setSearchQuery={setSearchQuery}
        onRunSearch={goSearch}
      />
      {showAlphabet && letters.length > 0 && (
        <div className="alphabet-nav">
          {letters.map((letter) =>
            isInline ? (
              <a
                key={letter}
                href={`#letter-${letter}`}
                className="alphabet-link"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToCatalogLetter(`letter-${letter}`);
                  window.history.replaceState(null, '', `#letter-${letter}`);
                }}
              >
                {letter}
              </a>
            ) : (
              <Link
                key={letter}
                to={`/asanas#letter-${letter}`}
                className="alphabet-link"
              >
                {letter}
              </Link>
            )
          )}
        </div>
      )}
    </>
  );
}
