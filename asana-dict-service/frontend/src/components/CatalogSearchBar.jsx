import React, { useMemo, useState } from 'react';
import { catalogNameSuggestions } from '../utils/catalogSearch';

export default function CatalogSearchBar({
  asanas,
  searchQuery,
  setSearchQuery,
  onRunSearch,
}) {
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
            placeholder="Поиск по каталогу…"
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
