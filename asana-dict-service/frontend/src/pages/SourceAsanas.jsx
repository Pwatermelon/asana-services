import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { asanasAPI } from '../api/asanas';
import { sourcesAPI } from '../api/sources';
import { useAuth } from '../contexts/AuthContext';
import { CompactAsanaRow } from '../components/CompactAsanaRow';
import '../styles/AsanasList.css';
import './SourceAsanas.css';

const SourceAsanas = () => {
  const { id } = useParams();
  const { isExpertOrAdmin } = useAuth();
  const [source, setSource] = useState(null);
  const [asanas, setAsanas] = useState([]);
  const [groupedAsanas, setGroupedAsanas] = useState({});
  const [alphabet, setAlphabet] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const shortId = id.split('#').pop().replace('source_', '');
      const sourceData = await sourcesAPI.getById(id);
      setSource(sourceData);

      const asanasData = await asanasAPI.getBySource(shortId);
      setAsanas(asanasData);

      // Группировка по буквам
      const grouped = {};
      asanasData.forEach((asana) => {
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
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="container">Загрузка...</div>;
  }

  if (!source) {
    return <div className="container">Источник не найден</div>;
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">
          Асаны из источника: {source.title}
        </h1>
        <p className="page-description">
          Автор: {source.author}
          {source.year != null && source.year !== '' && ` • ${source.year}`}
          {source.publisher && ` • ${source.publisher}`}
        </p>
        {source.annotation ? (
          <p className="page-description source-asanas-annotation">{source.annotation}</p>
        ) : null}
      </div>

      <div className="alphabet-nav">
        {alphabet.map((letter) => (
          <a key={letter} href={`#letter-${letter}`} className="alphabet-link">
            {letter}
          </a>
        ))}
      </div>

      {Object.entries(groupedAsanas)
        .sort()
        .map(([letter, letterAsanas]) => (
          <div key={letter} className="letter-section" id={`letter-${letter}`}>
            <h2 className="letter-heading">{letter}</h2>
            {isExpertOrAdmin ? (
              <div className="asana-grid">
                {letterAsanas.map((asana) => {
                  const rawId = asana.id.split('#').pop();
                  return (
                    <div key={asana.id} className="asana-card">
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
                        </div>
                        <div className="asana-actions">
                          <Link to={`/asana/${rawId}-page`} className="btn-view">
                            Подробнее
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="asana-lines">
                {letterAsanas.map((asana) => (
                  <CompactAsanaRow key={asana.id} asana={asana} />
                ))}
              </div>
            )}
          </div>
        ))}
    </div>
  );
};

export default SourceAsanas;

