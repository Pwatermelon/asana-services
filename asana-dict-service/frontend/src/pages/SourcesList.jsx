import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { sourcesAPI } from '../api/sources';
import { useAuth } from '../contexts/AuthContext';
import '../styles/SourcesList.css';

const SourcesList = () => {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { isExpertOrAdmin } = useAuth();

  useEffect(() => {
    loadSources();
  }, []);

  const loadSources = async () => {
    try {
      const data = await sourcesAPI.getAll();
      data.sort((a, b) => (a.author || '').localeCompare(b.author || ''));
      setSources(data);
    } catch (error) {
      console.error('Error loading sources:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (sourceId, sourceTitle) => {
    if (!window.confirm(`Вы уверены, что хотите удалить источник "${sourceTitle}"?`)) {
      return;
    }

    try {
      await sourcesAPI.delete(sourceId);
      loadSources();
    } catch (error) {
      alert('Ошибка при удалении источника');
      console.error('Error deleting source:', error);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      loadSources();
      return;
    }

    try {
      const results = await sourcesAPI.search(searchQuery);
      setSources(results);
    } catch (error) {
      console.error('Error searching:', error);
    }
  };

  const getSourceId = (source) => {
    const id = source.id.split('#').pop();
    return id.replace('source_', '');
  };

  if (loading) {
    return <div className="container">Загрузка...</div>;
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">Источники</h1>
        <p className="page-description">
          Список источников информации об асанах.
        </p>

        <div className="search-form-container">
          <form onSubmit={handleSearch} className="search-form">
            <div className="search-input-container">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск источников..."
                className="search-input"
              />
              <button type="submit" className="search-button">
                Найти
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="sources-grid">
        {sources.map((source) => (
          <div key={source.id} className="source-card">
            <div className="source-header">
              <h3 className="source-title">{source.title}</h3>
              <div className="source-author">{source.author}</div>
            </div>
            <div className="source-content">
              {source.year && (
                <div className="source-info">
                  <strong>Год:</strong> {source.year}
                </div>
              )}
              {source.publisher && (
                <div className="source-info">
                  <strong>Издательство:</strong> {source.publisher}
                </div>
              )}
              {source.pages && (
                <div className="source-info">
                  <strong>Страниц:</strong> {source.pages}
                </div>
              )}
              {source.annotation && (
                <div className="source-info">
                  <strong>Аннотация:</strong> {source.annotation}
                </div>
              )}
            </div>
            <div className="source-actions">
              <Link
                to={`/sources/${getSourceId(source)}/asanas`}
                className="btn-view"
              >
                Просмотр асан
              </Link>
              {isExpertOrAdmin && (
                <button
                  className="btn-delete"
                  onClick={() => handleDelete(source.id, source.title)}
                >
                  Удалить
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SourcesList;

