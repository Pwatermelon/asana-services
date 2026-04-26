import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { asanasAPI } from '../api/asanas';
import { useAuth } from '../contexts/AuthContext';
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
  const [groupedAsanas, setGroupedAsanas] = useState({});
  const [alphabet, setAlphabet] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const { isExpertOrAdmin } = useAuth();

  useEffect(() => {
    loadAsanas();
  }, []);

  const loadAsanas = async () => {
    try {
      const data = await asanasAPI.getAll();
      setAsanas(data);
      
      // Группировка по буквам
      const grouped = {};
      data.forEach((asana) => {
        const firstLetter = asana.name?.name_ru?.[0]?.toUpperCase() || '?';
        if (!grouped[firstLetter]) {
          grouped[firstLetter] = [];
        }
        grouped[firstLetter].push(asana);
      });
      
      // Сортируем асаны внутри каждой буквы по названию
      Object.keys(grouped).forEach(letter => {
        grouped[letter].sort((a, b) => {
          const nameA = (a.name?.name_ru || '').toLowerCase();
          const nameB = (b.name?.name_ru || '').toLowerCase();
          return nameA.localeCompare(nameB, 'ru');
        });
      });
      
      setGroupedAsanas(grouped);
      setAlphabet(Object.keys(grouped).sort());
    } catch (error) {
      console.error('Error loading asanas:', error);
    } finally {
      setLoading(false);
    }
  };

  // Для обычных пользователей - объединяем асаны с одинаковым названием в одну карточку
  const mergedAsanasForUsers = useMemo(() => {
    if (isExpertOrAdmin) return null;
    
    const merged = new Map();
    asanas.forEach((asana) => {
      const nameKey = normalizeCatalogNameKey(asana.name?.name_ru || '');
      if (!nameKey) return;
      if (!merged.has(nameKey)) {
        // Берем первую асану как основу, но сохраняем все ID для загрузки на странице деталей
        merged.set(nameKey, {
          ...asana,
          allAsanaIds: [asana.id] // Массив всех ID асан с этим названием
        });
      } else {
        // Добавляем ID к существующей группе
        const existing = merged.get(nameKey);
        existing.allAsanaIds.push(asana.id);
      }
    });
    
    // Преобразуем в массив и группируем по буквам
    const mergedArray = Array.from(merged.values());
    const byLetter = {};
    mergedArray.forEach((asana) => {
      const firstLetter = asana.name?.name_ru?.[0]?.toUpperCase() || '?';
      if (!byLetter[firstLetter]) {
        byLetter[firstLetter] = [];
      }
      byLetter[firstLetter].push(asana);
    });
    
    // Сортировка
    Object.keys(byLetter).forEach((letter) => {
      byLetter[letter].sort((a, b) => (a.name?.name_ru || '').localeCompare(b.name?.name_ru || '', 'ru'));
    });
    
    return byLetter;
  }, [asanas, isExpertOrAdmin]);

  const runCatalogSearch = useCallback(
    (explicitQuery) => {
      const raw = explicitQuery !== undefined && explicitQuery !== null ? String(explicitQuery) : searchQuery;
      const q = raw.trim();
      if (!q) {
        setSearchResults(null);
        return;
      }
      const matched = filterAsanasByCatalogQuery(asanas, q);
      setSearchResults(isExpertOrAdmin ? matched : dedupeAsanasByDisplayNameRu(matched));
    },
    [asanas, searchQuery, isExpertOrAdmin]
  );

  const handleDelete = async (asanaId, asanaName) => {
    if (!window.confirm(`Вы уверены, что хотите удалить асану "${asanaName}"?`)) {
      return;
    }

    try {
      await asanasAPI.delete(asanaId);
      loadAsanas();
      setSearchResults(null);
    } catch (error) {
      alert('Ошибка при удалении асаны');
      console.error('Error deleting asana:', error);
    }
  };

  if (loading) {
    return <div className="container">Загрузка...</div>;
  }

  // Для обычных пользователей - показываем объединенные карточки
  if (!isExpertOrAdmin && !searchResults) {
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

        <div className="alphabet-nav">
          {Object.keys(mergedAsanasForUsers || {}).sort().map((letter) => (
            <a key={letter} href={`#letter-${letter}`} className="alphabet-link">
              {letter}
            </a>
          ))}
        </div>

        {Object.entries(mergedAsanasForUsers || {})
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
          ))}
      </div>
    );
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
          {alphabet.map((letter) => (
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
            isExpertOrAdmin ? (
              <div className="asana-grid">
                {searchResults.map((asana) => (
                  <AsanaCard
                    key={asana.id}
                    asana={asana}
                    isExpertOrAdmin={isExpertOrAdmin}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            ) : (
              <div className="asana-lines">
                {searchResults.map((asana) => (
                  <CompactAsanaRow key={asana.id} asana={asana} />
                ))}
              </div>
            )
          ) : (
            <div className="no-asanas">
              <p>Асаны не найдены</p>
            </div>
          )}
        </div>
      ) : (
        <>
          {Object.entries(groupedAsanas)
            .sort()
            .map(([letter, letterAsanas]) => (
              <div key={letter} className="letter-section" id={`letter-${letter}`}>
                <h2 className="letter-heading">{letter}</h2>
                <div className="asana-grid">
                  {letterAsanas.map((asana) => (
                    <AsanaCard
                      key={asana.id}
                      asana={asana}
                      isExpertOrAdmin={isExpertOrAdmin}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            ))}
        </>
      )}
    </div>
  );
};

// Карточка асаны - источники показываются только для админов/экспертов
const AsanaCard = ({ asana, isExpertOrAdmin, onDelete }) => {
  const getAsanaId = (asana) => {
    const id = asana.id.split('#').pop();
    return id;
  };

  return (
    <div className="asana-card">
      {/* Фото показываем только для админов/экспертов */}
      {isExpertOrAdmin && (
        <div className="asana-image">
          {asana.photo ? (
            <img
              src={asana.photo.startsWith('http') || asana.photo.startsWith('data:') ? asana.photo : `data:image/jpeg;base64,${asana.photo}`}
              alt={asana.name?.name_ru}
            />
          ) : (
            <div className="no-image">Нет фото</div>
          )}
        </div>
      )}
      <div className="asana-content">
        <h3 className="asana-title">{asana.name?.name_ru}</h3>
        <div className="asana-details">
          {asana.name?.name_sanskrit && (
            <p className="sanskrit-name">{asana.name.name_sanskrit}</p>
          )}
          {/* Источник показываем только для админов/экспертов */}
          {isExpertOrAdmin && asana.sources && asana.sources.length > 0 && (
            <div className="asana-sources" style={{ marginTop: '0.5em', fontSize: '0.9em', color: '#666' }}>
              <strong>Источник:</strong>{' '}
              {asana.sources.map((source, index) => {
                const sourceId = source.id?.split('#').pop() || source.id;
                return (
                  <span key={index}>
                    {index > 0 && ', '}
                    <a 
                      href={`/sources/${sourceId}/asanas`}
                      style={{ color: '#007bff', textDecoration: 'none' }}
                      onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
                      onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
                    >
                      {source.author}
                      {source.year && ` (${source.year})`}
                    </a>
                  </span>
                );
              })}
            </div>
          )}
        </div>
        <div className="asana-actions">
          <Link
            to={`/asana/${getAsanaId(asana)}-page`}
            className="btn-view"
          >
            Подробнее
          </Link>
          {isExpertOrAdmin && (
            <button
              className="btn-delete"
              onClick={() => onDelete(asana.id, asana.name?.name_ru)}
            >
              Удалить
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AsanasList;
