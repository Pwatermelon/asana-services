import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { asanasAPI } from '../api/asanas';
import { useAuth } from '../contexts/AuthContext';
import '../styles/AsanasList.css';

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
      
      setGroupedAsanas(grouped);
      setAlphabet(Object.keys(grouped).sort());
    } catch (error) {
      console.error('Error loading asanas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }

    try {
      const results = await asanasAPI.search(searchQuery, true);
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching:', error);
    }
  };

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

  const getAsanaId = (asana) => {
    const id = asana.id.split('#').pop();
    // Сохраняем asana_ для правильного поиска в AsanaDetail
    return id; // Не удаляем asana_, оставляем как есть
  };

  if (loading) {
    return <div className="container">Загрузка...</div>;
  }

  const displayAsanas = searchResults || Object.values(groupedAsanas).flat();

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">Каталог асан</h1>
        <p className="page-description">
          Полный каталог асан с описаниями, фотографиями и источниками.
        </p>

        <div className="search-form-container">
          <form onSubmit={handleSearch} className="search-form">
            <div className="search-input-container">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск асан..."
                className="search-input"
              />
              <button type="submit" className="search-button">
                Найти
              </button>
            </div>
          </form>
        </div>
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

const AsanaCard = ({ asana, isExpertOrAdmin, onDelete }) => {
  const getAsanaId = (asana) => {
    const id = asana.id.split('#').pop();
    // Сохраняем asana_ для правильного поиска в AsanaDetail
    return id; // Не удаляем asana_, оставляем как есть
  };

  return (
    <div className="asana-card">
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
      <div className="asana-content">
        <h3 className="asana-title">{asana.name?.name_ru}</h3>
        <div className="asana-details">
          {asana.name?.name_sanskrit && (
            <p className="sanskrit-name">{asana.name.name_sanskrit}</p>
          )}
          {asana.sources && asana.sources.length > 0 && (
            <div className="asana-sources" style={{ marginTop: '0.5em', fontSize: '0.9em', color: '#666' }}>
              <strong>Источники:</strong>{' '}
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

