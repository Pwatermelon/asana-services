import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { asanasAPI } from '../api/asanas';
import { sourcesAPI } from '../api/sources';
import { CompactAsanaRow } from '../components/CompactAsanaRow';
import '../styles/AsanasList.css';
import './SourceAsanas.css';

const SourceAsanas = () => {
  const { id } = useParams();
  const [source, setSource] = useState(null);
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

      const grouped = {};
      asanasData.forEach((asana) => {
        const firstLetter = asana.name?.name_ru?.[0]?.toUpperCase() || '?';
        if (!grouped[firstLetter]) {
          grouped[firstLetter] = [];
        }
        grouped[firstLetter].push(asana);
      });

      Object.keys(grouped).forEach((letter) => {
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
        <h1 className="page-title">Асаны из источника: {source.title}</h1>
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
            <div className="asana-lines">
              {letterAsanas.map((asana) => (
                <CompactAsanaRow key={asana.id} asana={asana} />
              ))}
            </div>
          </div>
        ))}
    </div>
  );
};

export default SourceAsanas;
