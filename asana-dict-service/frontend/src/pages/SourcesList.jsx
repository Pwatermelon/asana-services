import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { sourcesAPI } from '../api/sources';
import { useAuth } from '../contexts/AuthContext';
import { usePageSeo } from '../utils/pageSeo';
import '../styles/SourcesList.css';

function filterSourcesLocal(sources, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return sources;
  const tokens = q.split(/[\s\-–—,.;:;]+/).filter(Boolean);
  if (!tokens.length) return sources;
  return sources.filter((s) => {
    const hay = [
      s.title,
      s.author,
      s.publisher,
      s.annotation,
      s.year != null && s.year !== '' ? String(s.year) : '',
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return tokens.every((tok) => hay.includes(tok));
  });
}

const SourcesList = () => {
  const [allSources, setAllSources] = useState([]);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchActive, setSearchActive] = useState(false);
  const { isExpertOrAdmin } = useAuth();
  const navigate = useNavigate();

  usePageSeo({
    title: 'Источники',
    description:
      'Библиография и первоисточники асан традиционных школ йоги: книги, авторы, издательства.',
    path: '/sources',
  });

  useEffect(() => {
    loadSources();
  }, []);

  const loadSources = async () => {
    try {
      const data = await sourcesAPI.getAll();
      data.sort((a, b) => (a.author || '').localeCompare(b.author || '', 'ru'));
      setAllSources(data);
      setSources(data);
      setSearchActive(false);
      setSearchQuery('');
    } catch (error) {
      console.error('Error loading sources:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSourceId = (source) => {
    const raw = source.id.split('#').pop() || source.id;
    return String(raw).replace(/^source_/, '');
  };

  const asanasPath = (source) => `/sources/${getSourceId(source)}/asanas`;

  const rowTitle = (source) => {
    const bits = [source.title, source.year != null && source.year !== '' ? String(source.year) : null, source.author]
      .filter(Boolean)
      .join(' · ');
    return bits;
  };

  const handleDelete = async (e, source) => {
    e.stopPropagation();
    if (!window.confirm(`Удалить источник «${source.title}»?`)) {
      return;
    }
    try {
      await sourcesAPI.delete(source.id);
      loadSources();
    } catch (error) {
      alert(error.response?.data?.detail || 'Ошибка при удалении источника');
      console.error('Error deleting source:', error);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) {
      setSources(allSources);
      setSearchActive(false);
      return;
    }
    setSearchActive(true);
    try {
      const results = await sourcesAPI.search(q);
      const sorted = [...(results || [])].sort((a, b) =>
        (a.author || '').localeCompare(b.author || '', 'ru')
      );
      setSources(sorted);
    } catch (error) {
      console.error('Error searching sources via API, using local filter:', error);
      const local = filterSourcesLocal(allSources, q);
      local.sort((a, b) => (a.author || '').localeCompare(b.author || '', 'ru'));
      setSources(local);
    }
  };

  if (loading) {
    return <div className="container">Загрузка...</div>;
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">Источники</h1>

        <div className="search-form-container sources-search-wrap">
          <form onSubmit={handleSearch} className="search-form">
            <div className="search-input-container">
              <input
                type="search"
                enterKeyHint="search"
                value={searchQuery}
                onChange={(e) => {
                  const v = e.target.value;
                  setSearchQuery(v);
                  if (!v.trim()) {
                    setSources(allSources);
                    setSearchActive(false);
                  }
                }}
                placeholder="Поиск по названию, автору, издательству…"
                className="search-input"
                autoComplete="off"
                spellCheck={false}
              />
              <button type="submit" className="search-button">
                Найти
              </button>
            </div>
          </form>
        </div>
      </div>

      {searchActive && (
        <p className="sources-search-hint">
          {sources.length > 0
            ? `Найдено: ${sources.length}`
            : `По запросу «${searchQuery.trim()}» ничего не найдено`}
        </p>
      )}

      <div className="sources-lines">
        {sources.length === 0 && !loading ? (
          <p className="sources-empty">Источники не найдены</p>
        ) : null}
        {sources.map((source) => (
          <div key={source.id} className="source-line">
            <div
              className="source-line-click"
              role="button"
              tabIndex={0}
              title={rowTitle(source)}
              onClick={() => navigate(asanasPath(source))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate(asanasPath(source));
                }
              }}
            >
              <span className="source-line-title">{source.title || '—'}</span>
              <span className="source-line-sep" aria-hidden>
                ·
              </span>
              <span className="source-line-year">
                {source.year != null && source.year !== '' ? source.year : '—'}
              </span>
              <span className="source-line-sep" aria-hidden>
                ·
              </span>
              <span className="source-line-author">{source.author || '—'}</span>
              {source.publisher ? (
                <>
                  <span className="source-line-sep source-line-sep--soft" aria-hidden>
                    ·
                  </span>
                  <span className="source-line-extra">{source.publisher}</span>
                </>
              ) : null}
            </div>

            {isExpertOrAdmin && (
              <div className="source-line-actions" onClick={(e) => e.stopPropagation()}>
                <Link
                  to={`/sources/${getSourceId(source)}/edit`}
                  className="btn-source-line btn-source-line--edit"
                  onClick={(e) => e.stopPropagation()}
                >
                  Изменить
                </Link>
                <button
                  type="button"
                  className="btn-source-line btn-source-line--del"
                  onClick={(e) => handleDelete(e, source)}
                >
                  Удалить
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SourcesList;
