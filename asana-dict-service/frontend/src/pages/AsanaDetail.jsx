import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { asanasAPI } from '../api/asanas';
import { sourcesAPI } from '../api/sources';
import { useAuth } from '../contexts/AuthContext';
import '../styles/AsanaDetail.css';

const AsanaDetail = () => {
  const params = useParams();
  // Получаем id из параметров (может быть 'id' или 'id-page' в зависимости от роута)
  const id = params.id || params['id-page'] || params.idPage;
  const [asana, setAsana] = useState(null);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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
      setError(null); // Сбрасываем ошибку при новой загрузке
      setLoading(true);
      
      // Проверяем, что id существует
      if (!id) {
        console.error('No asana ID provided in URL');
        setError('ID асаны не указан в URL');
        setLoading(false);
        return;
      }
      
      // Убираем суффикс -page если есть
      let asanaId = String(id);
      if (asanaId.endsWith('-page')) {
        asanaId = asanaId.replace('-page', '');
      }
      
      console.log('Loading asana with ID from URL:', asanaId);
      
      // Пробуем использовать API getById
      try {
        const asana = await asanasAPI.getById(asanaId);
        if (asana) {
          console.log('Found asana via getById:', asana.id);
          setAsana(asana);
          setLoading(false);
          return;
        } else {
          console.warn('getById returned null/undefined for ID:', asanaId);
        }
      } catch (apiError) {
        console.warn('getById failed, trying getAll:', apiError);
        console.warn('Error details:', {
          message: apiError.message,
          response: apiError.response?.data,
          status: apiError.response?.status
        });
      }
      
      // Fallback: получаем все асаны и ищем локально
      const allAsanas = await asanasAPI.getAll();
      console.log('Total asanas loaded:', allAsanas.length);
      
      // Нормализуем ID из URL
      const normalizedUrlId = asanaId.trim();
      
      // Формируем возможные варианты ID для поиска
      const possibleIds = [
        normalizedUrlId, // Точное совпадение
        normalizedUrlId.startsWith('asana_') ? normalizedUrlId : `asana_${normalizedUrlId}`, // С префиксом
        normalizedUrlId.replace(/^asana_/, ''), // Без префикса
        `http://www.semanticweb.org/platinum_watermelon/ontologies/Asana#${normalizedUrlId}`,
        `http://www.semanticweb.org/platinum_watermelon/ontologies/Asana#${normalizedUrlId.startsWith('asana_') ? normalizedUrlId : `asana_${normalizedUrlId}`}`
      ];
      
      console.log('Searching with possible IDs:', possibleIds);
      
      // Ищем асану
      let foundAsana = null;
      
      for (const asana of allAsanas) {
        const fullId = asana.id;
        const shortId = fullId.split('#').pop();
        
        // Проверяем все возможные варианты
        for (const possibleId of possibleIds) {
          if (fullId === possibleId || shortId === possibleId) {
            foundAsana = asana;
            break;
          }
          
          // Также проверяем без префикса
          const shortIdNoPrefix = shortId.replace(/^asana_/, '');
          const possibleIdNoPrefix = possibleId.replace(/^asana_/, '').replace(/^http.*#/, '');
          if (shortIdNoPrefix && possibleIdNoPrefix && shortIdNoPrefix === possibleIdNoPrefix) {
            foundAsana = asana;
            break;
          }
        }
        
        if (foundAsana) break;
      }
      
      setAsana(foundAsana);
      if (!foundAsana) {
        console.error('Asana not found. Searched ID:', normalizedUrlId);
        console.error('Possible IDs tried:', possibleIds);
        console.error('First 10 asana IDs for comparison:', allAsanas.slice(0, 10).map(a => ({
          full: a.id,
          short: a.id.split('#').pop(),
          shortNoPrefix: a.id.split('#').pop().replace(/^asana_/, '')
        })));
        setError(`Асана не найдена (ID: ${normalizedUrlId})`);
      } else {
        console.log('Found asana:', foundAsana.id);
        setError(null); // Очищаем ошибку при успехе
      }
    } catch (error) {
      console.error('Error loading asana:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        response: error.response?.data
      });
      setError(`Ошибка при загрузке асаны: ${error.message || 'Неизвестная ошибка'}`);
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

  if (error) {
    return (
      <div className="container">
        <div className="error-message">{error}</div>
        <p>Попробуйте вернуться к <a href="/asanas">списку асан</a></p>
      </div>
    );
  }

  if (!asana) {
    return (
      <div className="container">
        <div className="error-message">Асана не найдена</div>
        <p>Попробуйте вернуться к <a href="/asanas">списку асан</a></p>
      </div>
    );
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
            
            {asana.sources && asana.sources.length > 0 && (
              <div className="detail-section">
                <h2 className="detail-title">Источники</h2>
                {asana.sources.map((source, index) => {
                  const sourceId = source.id?.split('#').pop() || source.id;
                  const shortSourceId = sourceId.replace('source_', '');
                  return (
                    <div key={index} className="detail-item">
                      <a 
                        href={`/sources/${sourceId}/asanas`}
                        style={{ color: '#007bff', textDecoration: 'none' }}
                        onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
                        onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
                      >
                        <strong>{source.author}</strong> - {source.title}
                        {source.year && ` (${source.year})`}
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
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
                  
                  const photoSource = typeof photo === 'object' && photo.source ? photo.source : null;
                  const sourceId = photoSource ? (typeof photoSource === 'string' ? photoSource.split('#').pop() : photoSource.id?.split('#').pop() || photoSource.id) : null;
                  
                  return (
                    <div key={index} className="photo-container">
                      {typeof photo === 'object' && photo.image ? (
                        <>
                          <img
                            src={getPhotoSrc(photo.image)}
                            alt={asana.name?.name_ru}
                            className="gallery-item"
                          />
                          {photoSource && (
                            <div className="photo-source">
                              <a href={`/sources/${sourceId}/asanas`} style={{ color: '#007bff', textDecoration: 'none' }}>
                                {typeof photoSource === 'object' && photoSource.author ? (
                                  `${photoSource.author} - ${photoSource.title}`
                                ) : (
                                  `Источник ${sourceId?.replace('source_', '') || sourceId}`
                                )}
                              </a>
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

