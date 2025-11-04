import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { asanasAPI } from '../api/asanas';
import { sourcesAPI } from '../api/sources';
import { useAuth } from '../contexts/AuthContext';
import '../styles/AsanaDetail.css';

const AsanaDetail = () => {
  const { id } = useParams();
  const [asana, setAsana] = useState(null);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddPhotoForm, setShowAddPhotoForm] = useState(false);
  const [selectedSource, setSelectedSource] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [hasExistingPhoto, setHasExistingPhoto] = useState(false);
  const { isExpertOrAdmin } = useAuth();

  useEffect(() => {
    loadAsana();
  }, [id]);

  useEffect(() => {
    if (isExpertOrAdmin && showAddPhotoForm) {
      loadSources();
    }
  }, [isExpertOrAdmin, showAddPhotoForm]);

  const loadAsana = async () => {
    try {
      const asanaId = id.replace('-page', '');
      // Формируем полный URI - asanaId уже содержит asana_ или просто UUID
      const fullUri = `http://www.semanticweb.org/platinum_watermelon/ontologies/Asana#${asanaId.startsWith('asana_') ? asanaId : `asana_${asanaId}`}`;
      const allAsanas = await asanasAPI.getAll();
      
      // Ищем по полному URI
      let foundAsana = allAsanas.find(a => a.id === fullUri);
      
      // Если не найдено, пробуем найти по короткому ID
      if (!foundAsana) {
        const shortId = fullUri.split('#').pop();
        foundAsana = allAsanas.find(a => {
          const aShortId = a.id.split('#').pop();
          return aShortId === shortId;
        });
      }
      
      setAsana(foundAsana);
      if (!foundAsana) {
        console.error('Asana not found. Searched URI:', fullUri);
        console.error('Searched short ID:', fullUri.split('#').pop());
        console.error('Sample asana IDs:', allAsanas.slice(0, 5).map(a => ({ full: a.id, short: a.id.split('#').pop() })));
      }
    } catch (error) {
      console.error('Error loading asana:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSources = async () => {
    try {
      const data = await sourcesAPI.getAll();
      setSources(data);
    } catch (error) {
      console.error('Error loading sources:', error);
    }
  };

  const handleSourceChange = async (e) => {
    const sourceId = e.target.value;
    setSelectedSource(sourceId);
    
    if (sourceId && asana) {
      try {
        const check = await asanasAPI.checkPhoto(asana.id, sourceId);
        setHasExistingPhoto(check.hasPhoto);
      } catch (error) {
        console.error('Error checking photo:', error);
      }
    }
  };

  const handlePhotoSubmit = async (e) => {
    e.preventDefault();
    if (!photoFile || !selectedSource) return;

    try {
      await asanasAPI.addPhoto(asana.id, photoFile, selectedSource);
      loadAsana();
      setShowAddPhotoForm(false);
      setSelectedSource('');
      setPhotoFile(null);
      setHasExistingPhoto(false);
    } catch (error) {
      alert('Ошибка при добавлении фотографии');
      console.error('Error adding photo:', error);
    }
  };

  if (loading) {
    return <div className="container">Загрузка...</div>;
  }

  if (!asana) {
    return <div className="container">Асана не найдена</div>;
  }

  return (
    <div className="container">
      <div className="asana-detail">
        <div className="asana-header">
          <h1 className="asana-title">{asana.name?.name_ru}</h1>
          {isExpertOrAdmin && (
            <div className="admin-actions">
              <button
                className="btn-primary"
                onClick={() => setShowAddPhotoForm(!showAddPhotoForm)}
              >
                Добавить фотографию
              </button>
            </div>
          )}
        </div>

        <div className="asana-info">
          <div className="asana-details">
            <div className="detail-section">
              <h2 className="detail-title">Названия</h2>
              <div className="detail-item">
                <strong>На русском:</strong> {asana.name?.name_ru}
              </div>
              {asana.name?.name_sanskrit && (
                <div className="detail-item">
                  <strong>На санскрите:</strong> {asana.name.name_sanskrit}
                </div>
              )}
              {asana.name?.transliteration && (
                <div className="detail-item">
                  <strong>Транслитерация:</strong> {asana.name.transliteration}
                </div>
              )}
              {asana.name?.definition && (
                <div className="detail-item">
                  <strong>Пояснение:</strong> {asana.name.definition}
                </div>
              )}
            </div>
          </div>

          <div className="asana-photos">
            {asana.photos && asana.photos.length > 0 ? (
              <div className="photo-gallery">
                {asana.photos.map((photo, index) => {
                  const getPhotoSrc = (photoData) => {
                    if (typeof photoData === 'object' && photoData.image) {
                      return photoData.image.startsWith('http') || photoData.image.startsWith('data:') 
                        ? photoData.image 
                        : `data:image/jpeg;base64,${photoData.image}`;
                    }
                    if (typeof photoData === 'string') {
                      return photoData.startsWith('http') || photoData.startsWith('data:') 
                        ? photoData 
                        : `data:image/jpeg;base64,${photoData}`;
                    }
                    return photoData;
                  };
                  
                  return (
                    <div key={index} className="photo-container">
                      {typeof photo === 'object' && photo.image ? (
                        <>
                          <img
                            src={getPhotoSrc(photo.image)}
                            alt={asana.name?.name_ru}
                            className="gallery-item"
                          />
                          {photo.source && (
                            <div className="photo-source">
                              {typeof photo.source === 'object' ? (
                                <a href={`/sources/${photo.source.id.split('#').pop()}`}>
                                  {photo.source.author} - {photo.source.title}
                                </a>
                              ) : (
                                <a href={`/sources/${photo.source.split('#').pop()}`}>
                                  Источник {photo.source.split('#').pop()}
                                </a>
                              )}
                            </div>
                          )}
                        </>
                      ) : (
                        <img
                          src={getPhotoSrc(photo)}
                          alt={asana.name?.name_ru}
                          className="gallery-item"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p>Фотографии отсутствуют</p>
            )}
          </div>
        </div>

        {isExpertOrAdmin && showAddPhotoForm && (
          <div className="add-photo-form">
            <h3 className="form-title">Добавление фотографии</h3>
            <form onSubmit={handlePhotoSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="source">
                  Источник *
                </label>
                <select
                  id="source"
                  value={selectedSource}
                  onChange={handleSourceChange}
                  className="form-select"
                  required
                >
                  <option value="">Выберите источник</option>
                  {sources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.author} - {source.title}
                    </option>
                  ))}
                </select>
              </div>

              {hasExistingPhoto && (
                <div className="warning-message">
                  В выбранном источнике уже есть фото этой асаны. Хотите добавить другое фото?
                </div>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="photo">
                  Фотография *
                </label>
                <input
                  type="file"
                  id="photo"
                  accept="image/*"
                  onChange={(e) => setPhotoFile(e.target.files[0])}
                  required
                />
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-primary">
                  Добавить
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowAddPhotoForm(false);
                    setSelectedSource('');
                    setPhotoFile(null);
                  }}
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default AsanaDetail;

