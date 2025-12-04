import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { asanasAPI } from '../api/asanas';
import { sourcesAPI } from '../api/sources';
import { useAuth } from '../contexts/AuthContext';
import '../styles/AsanaDetail.css';

const AsanaDetail = () => {
  const params = useParams();
  const id = params.id || params['id-page'] || params.idPage;
  const [asana, setAsana] = useState(null);
  const [sources, setSources] = useState([]);
  const [allAsanas, setAllAsanas] = useState([]);
  const [similarAsanas, setSimilarAsanas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddPhotoForm, setShowAddPhotoForm] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [selectedSource, setSelectedSource] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [hasExistingPhoto, setHasExistingPhoto] = useState(false);
  const [matchSearchQuery, setMatchSearchQuery] = useState('');
  const [selectedMatchAsana, setSelectedMatchAsana] = useState(null);
  const { isExpertOrAdmin } = useAuth();

  useEffect(() => {
    loadAsana();
    loadAllAsanas();
  }, [id]);

  useEffect(() => {
    if (isExpertOrAdmin && showAddPhotoForm) {
      loadSources();
    }
  }, [isExpertOrAdmin, showAddPhotoForm]);

  const loadAsana = async () => {
    try {
      setError(null);
      setLoading(true);
      
      if (!id) {
        console.error('No asana ID provided in URL');
        setError('ID асаны не указан в URL');
        setLoading(false);
        return;
      }
      
      let asanaId = String(id);
      if (asanaId.endsWith('-page')) {
        asanaId = asanaId.replace('-page', '');
      }
      
      console.log('Loading asana with ID from URL:', asanaId);
      
      try {
        const asana = await asanasAPI.getById(asanaId);
        if (asana) {
          console.log('Found asana via getById:', asana.id);
          setAsana(asana);
          loadSimilarAsanas(asana);
          setLoading(false);
          return;
        } else {
          console.warn('getById returned null/undefined for ID:', asanaId);
        }
      } catch (apiError) {
        console.warn('getById failed, trying getAll:', apiError);
      }
      
      const allAsanas = await asanasAPI.getAll();
      console.log('Total asanas loaded:', allAsanas.length);
      
      const normalizedUrlId = asanaId.trim();
      
      const possibleIds = [
        normalizedUrlId,
        normalizedUrlId.startsWith('asana_') ? normalizedUrlId : `asana_${normalizedUrlId}`,
        normalizedUrlId.replace(/^asana_/, ''),
        `http://www.semanticweb.org/platinum_watermelon/ontologies/Asana#${normalizedUrlId}`,
        `http://www.semanticweb.org/platinum_watermelon/ontologies/Asana#${normalizedUrlId.startsWith('asana_') ? normalizedUrlId : `asana_${normalizedUrlId}`}`
      ];
      
      let foundAsana = null;
      
      for (const a of allAsanas) {
        const fullId = a.id;
        const shortId = fullId.split('#').pop();
        
        for (const possibleId of possibleIds) {
          if (fullId === possibleId || shortId === possibleId) {
            foundAsana = a;
            break;
          }
          
          const shortIdNoPrefix = shortId.replace(/^asana_/, '');
          const possibleIdNoPrefix = possibleId.replace(/^asana_/, '').replace(/^http.*#/, '');
          if (shortIdNoPrefix && possibleIdNoPrefix && shortIdNoPrefix === possibleIdNoPrefix) {
            foundAsana = a;
            break;
          }
        }
        
        if (foundAsana) break;
      }
      
      setAsana(foundAsana);
      if (!foundAsana) {
        setError(`Асана не найдена (ID: ${normalizedUrlId})`);
      } else {
        loadSimilarAsanas(foundAsana);
        setError(null);
      }
    } catch (error) {
      console.error('Error loading asana:', error);
      setError(`Ошибка при загрузке асаны: ${error.message || 'Неизвестная ошибка'}`);
    } finally {
      setLoading(false);
    }
  };

  const loadAllAsanas = async () => {
    try {
      const data = await asanasAPI.getAll();
      setAllAsanas(data);
    } catch (error) {
      console.error('Error loading all asanas:', error);
    }
  };

  const loadSimilarAsanas = async (currentAsana) => {
    if (!currentAsana) return;
    
    try {
      const similar = await asanasAPI.getSimilarAsanas(currentAsana.id);
      setSimilarAsanas(similar || []);
    } catch (error) {
      console.error('Error loading similar asanas:', error);
      setSimilarAsanas([]);
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

  const handleMatchAsana = async () => {
    if (!selectedMatchAsana || !asana) return;
    
    try {
      await asanasAPI.setSameAsObject(asana.id, selectedMatchAsana.id);
      setShowMatchModal(false);
      setSelectedMatchAsana(null);
      setMatchSearchQuery('');
      loadSimilarAsanas(asana);
      alert('Совпадение успешно указано!');
    } catch (error) {
      alert('Ошибка при указании совпадения');
      console.error('Error setting same as object:', error);
    }
  };

  const handleRemoveSimilar = async (similarAsanaId) => {
    if (!window.confirm('Удалить связь с этой асаной?')) return;
    
    try {
      await asanasAPI.removeSameAsObject(asana.id, similarAsanaId);
      loadSimilarAsanas(asana);
    } catch (error) {
      alert('Ошибка при удалении связи');
      console.error('Error removing same as object:', error);
    }
  };

  const getAsanaId = (a) => {
    return a.id.split('#').pop();
  };

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

  // Для обычных пользователей - загружаем аналогичные асаны для всех асан с таким же названием
  // Сохраняем мапу: asanaId -> [similarAsanas]
  const [similarAsanasMap, setSimilarAsanasMap] = React.useState(new Map());
  
  React.useEffect(() => {
    if (!isExpertOrAdmin && asana && allAsanas.length > 0) {
      const asanaName = asana.name?.name_ru?.toLowerCase().trim();
      if (asanaName) {
        const asanasWithSameName = allAsanas.filter(a => 
          a.name?.name_ru?.toLowerCase().trim() === asanaName
        );
        
        // Загружаем аналогичные асаны для каждой асаны с таким же названием
        const loadAll = async () => {
          const map = new Map();
          for (const a of asanasWithSameName) {
            try {
              const similar = await asanasAPI.getSimilarAsanas(a.id);
              if (similar && similar.length > 0) {
                map.set(a.id, similar);
              }
            } catch (error) {
              console.error(`Error loading similar for ${a.id}:`, error);
            }
          }
          setSimilarAsanasMap(map);
        };
        loadAll();
      }
    }
  }, [asana, allAsanas, isExpertOrAdmin]);

  // Для обычных пользователей - собираем все фото всех асан с таким же названием
  const allPhotosBySourceForUsers = React.useMemo(() => {
    if (isExpertOrAdmin || !asana || !allAsanas.length) return null;
    
    const asanaName = asana.name?.name_ru?.toLowerCase().trim();
    if (!asanaName) return null;
    
    // Находим все асаны с таким же названием
    const asanasWithSameName = allAsanas.filter(a => 
      a.name?.name_ru?.toLowerCase().trim() === asanaName
    );
    
    // Собираем все фото из всех этих асан
    const allPhotos = [];
    asanasWithSameName.forEach(a => {
      if (a.photos && Array.isArray(a.photos)) {
        a.photos.forEach(photo => {
          allPhotos.push(photo);
        });
      }
    });
    
    // Собираем все источники из всех асан с таким же названием
    const allSourcesMap = new Map();
    asanasWithSameName.forEach(a => {
      if (a.sources && Array.isArray(a.sources)) {
        a.sources.forEach(source => {
          const sourceId = source.id?.split('#').pop() || source.id;
          if (sourceId && !allSourcesMap.has(sourceId)) {
            allSourcesMap.set(sourceId, source);
          }
        });
      }
    });
    
    // Группируем по источникам и находим асаны для каждого источника
    const grouped = {};
    allPhotos.forEach((photo) => {
      const sourceId = typeof photo === 'object' && photo.source 
        ? (typeof photo.source === 'string' ? photo.source.split('#').pop() : photo.source.id?.split('#').pop() || photo.source.id)
        : 'unknown';
      
      if (!grouped[sourceId]) {
        // Ищем источник в карте источников
        const foundSource = allSourcesMap.get(sourceId) || 
          (typeof photo === 'object' && photo.source ? photo.source : null);
        
        // Находим асаны с таким же названием, которые имеют фото от этого источника
        const asanasForThisSource = asanasWithSameName.filter(a => {
          if (!a.photos || !Array.isArray(a.photos)) return false;
          return a.photos.some(p => {
            const pSourceId = typeof p === 'object' && p.source 
              ? (typeof p.source === 'string' ? p.source.split('#').pop() : p.source.id?.split('#').pop() || p.source.id)
              : null;
            return pSourceId === sourceId;
          });
        });
        
        // Проверяем, есть ли у какой-либо асаны с этим источником связь isSameAsObject
        // Для обычных пользователей проверяем в similarAsanasMap
        // Для админов/экспертов используем similarAsanas (только для текущей асаны)
        const hasSimilarConnection = isExpertOrAdmin
          ? asanasForThisSource.some(a => similarAsanas.some(similar => similar.id === a.id))
          : asanasForThisSource.some(a => similarAsanasMap.has(a.id));
        
        grouped[sourceId] = {
          source: foundSource,
          photos: [],
          asanas: asanasForThisSource,
          hasSimilarConnection: hasSimilarConnection
        };
      }
      grouped[sourceId].photos.push(photo);
    });
    
    return grouped;
  }, [asana, allAsanas, isExpertOrAdmin, similarAsanas, similarAsanasMap]);

  // Фильтруем аналогичные асаны для обычных пользователей - убираем те, что с таким же названием
  const filteredSimilarAsanas = React.useMemo(() => {
    if (!similarAsanas.length || !asana) return similarAsanas;
    
    if (isExpertOrAdmin) return similarAsanas;
    
    const asanaName = asana.name?.name_ru?.toLowerCase().trim();
    if (!asanaName) return similarAsanas;
    
    // Убираем асаны с таким же названием
    return similarAsanas.filter(similar => 
      similar.name?.name_ru?.toLowerCase().trim() !== asanaName
    );
  }, [similarAsanas, asana, isExpertOrAdmin]);

  // Группировка фото по источникам для обычных пользователей (старая логика для обратной совместимости)
  const photosBySource = React.useMemo(() => {
    if (!asana?.photos) return {};
    
    const grouped = {};
    asana.photos.forEach((photo) => {
      const sourceId = typeof photo === 'object' && photo.source 
        ? (typeof photo.source === 'string' ? photo.source.split('#').pop() : photo.source.id?.split('#').pop() || photo.source.id)
        : 'unknown';
      
      if (!grouped[sourceId]) {
        grouped[sourceId] = {
          source: typeof photo === 'object' ? photo.source : null,
          photos: []
        };
      }
      grouped[sourceId].photos.push(photo);
    });
    
    return grouped;
  }, [asana]);

  // Фильтрация асан для модального окна
  const filteredAsanasForMatch = React.useMemo(() => {
    if (!allAsanas || !asana) return [];
    
    return allAsanas
      .filter((a) => a.id !== asana.id)
      .filter((a) => {
        if (!matchSearchQuery) return true;
        const query = matchSearchQuery.toLowerCase();
        return (
          a.name?.name_ru?.toLowerCase().includes(query) ||
          a.name?.name_sanskrit?.toLowerCase().includes(query)
        );
      })
      .slice(0, 20);
  }, [allAsanas, asana, matchSearchQuery]);

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

  // Рендер для обычных пользователей - показываем асаны по отдельности (как у админа)
  if (!isExpertOrAdmin) {
    const asanaName = asana.name?.name_ru?.toLowerCase().trim();
    const asanasWithSameName = allAsanas.filter(a => 
      a.name?.name_ru?.toLowerCase().trim() === asanaName
    );
    
    // Берем информацию о названии из первой асаны (они все с одинаковым названием)
    const firstAsana = asanasWithSameName[0];
    
    return (
      <div className="container">
        <div className="asana-detail">
          <div className="asana-header">
            <h1 className="asana-title">{firstAsana?.name?.name_ru}</h1>
          </div>

          {/* Информация о названии показывается один раз сверху */}
          <div className="asana-info">
            <div className="asana-details">
              <div className="detail-section">
                {firstAsana?.name?.name_sanskrit && (
                  <div className="detail-item">
                    <strong>На санскрите:</strong> {firstAsana.name.name_sanskrit}
                  </div>
                )}
                {firstAsana?.name?.transliteration && (
                  <div className="detail-item">
                    <strong>Транслитерация:</strong> {firstAsana.name.transliteration}
                  </div>
                )}
                {firstAsana?.name?.definition && (
                  <div className="detail-item">
                    <strong>Перевод:</strong> {firstAsana.name.definition}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Показываем каждую асану отдельно (как у админа) */}
          {asanasWithSameName.map((currentAsana) => {
            // Загружаем аналогичные асаны для этой асаны
            const similarForThisAsana = similarAsanasMap.get(currentAsana.id) || [];
            const filteredSimilar = similarForThisAsana.filter(similar => {
              const similarName = similar.name?.name_ru?.toLowerCase().trim();
              return similarName !== asanaName;
            });
            
            return (
                <div key={currentAsana.id} style={{ marginBottom: '3em', paddingBottom: '2em', borderBottom: '2px solid #e0e0e0' }}>
                <div className="asana-info">
                  <div className="asana-details">
                    {currentAsana.sources && currentAsana.sources.length > 0 && (
                      <div className="detail-section">
                        <h2 className="detail-title">Источник</h2>
                        {currentAsana.sources.map((source, index) => {
                          const sourceId = source.id?.split('#').pop() || source.id;
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
                    {currentAsana.photos && currentAsana.photos.length > 0 ? (
                      <div className="photo-gallery">
                        {currentAsana.photos.map((photo, index) => (
                          <div key={index} className="photo-container">
                            {typeof photo === 'object' && photo.image ? (
                              <img
                                src={getPhotoSrc(photo.image)}
                                alt={currentAsana.name?.name_ru}
                                className="gallery-item"
                              />
                            ) : (
                              <img
                                src={getPhotoSrc(photo)}
                                alt={currentAsana.name?.name_ru}
                                className="gallery-item"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p>Фотографии отсутствуют</p>
                    )}
                  </div>
                </div>

                {/* Блок аналогичных асан для этой асаны (как у админа) */}
                {filteredSimilar.length > 0 && (
                  <div className="similar-asanas-section">
                    <h3 className="similar-asanas-title">
                      🔗 Данная асана в других источниках
                    </h3>
                    <div className="similar-asanas-grid">
                      {filteredSimilar.map((similar) => (
                        <Link
                          key={similar.id}
                          to={`/asana/${getAsanaId(similar)}-page`}
                          className="similar-asana-card"
                        >
                          <div className="similar-asana-photo">
                            {similar.photo ? (
                              <img src={getPhotoSrc(similar.photo)} alt={similar.name?.name_ru} />
                            ) : null}
                          </div>
                          <div className="similar-asana-info">
                            <h5 className="similar-asana-name">{similar.name?.name_ru}</h5>
                            {similar.sources?.[0] && (
                              <p className="similar-asana-source">
                                {similar.sources[0].author} - {similar.sources[0].title}
                                {similar.sources[0].year && ` (${similar.sources[0].year})`}
                              </p>
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Рендер для админов/экспертов
  return (
    <div className="container">
      <div className="asana-detail">
        <div className="asana-header">
          <h1 className="asana-title">{asana.name?.name_ru}</h1>
          <div className="admin-actions">
            <button
              className="btn-primary"
              onClick={() => setShowAddPhotoForm(!showAddPhotoForm)}
            >
              Добавить фотографию
            </button>
            <button
              className="match-asana-btn"
              onClick={() => setShowMatchModal(true)}
            >
              🔗 Указать совпадение
            </button>
          </div>
        </div>

        <div className="asana-info">
          <div className="asana-details">
            <div className="detail-section">
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
                    <strong>Перевод:</strong> {asana.name.definition}
                  </div>
                )}
            </div>
            
            {asana.sources && asana.sources.length > 0 && (
              <div className="detail-section">
                <h2 className="detail-title">Источник</h2>
                {asana.sources.map((source, index) => {
                  const sourceId = source.id?.split('#').pop() || source.id;
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
                  const photoSource = typeof photo === 'object' && photo.source ? photo.source : null;
                  const sourceId = photoSource ? (typeof photoSource === 'string' ? photoSource.split('#').pop() : photoSource.id?.split('#').pop() || photoSource.id) : null;
                  
                  return (
                    <div key={index} className="photo-container">
                      {typeof photo === 'object' && photo.image ? (
                        <img
                          src={getPhotoSrc(photo.image)}
                          alt={asana.name?.name_ru}
                          className="gallery-item"
                        />
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

        {/* Блок аналогичных асан для админов/экспертов */}
        {filteredSimilarAsanas.length > 0 && (
          <div className="similar-asanas-section">
            <h3 className="similar-asanas-title">
              🔗 Данная асана в других источниках
            </h3>
            <div className="similar-asanas-grid">
              {filteredSimilarAsanas.map((similar) => (
                <div key={similar.id} className="similar-asana-card" style={{ cursor: 'default' }}>
                  <Link to={`/asana/${getAsanaId(similar)}-page`}>
                    <div className="similar-asana-photo">
                      {similar.photo ? (
                        <img src={getPhotoSrc(similar.photo)} alt={similar.name?.name_ru} />
                      ) : null}
                    </div>
                    <div className="similar-asana-info">
                      <h5 className="similar-asana-name">{similar.name?.name_ru}</h5>
                      {similar.sources?.[0] && (
                        <p className="similar-asana-source">
                          {similar.sources[0].author} - {similar.sources[0].title}
                          {similar.sources[0].year && ` (${similar.sources[0].year})`}
                        </p>
                      )}
                    </div>
                  </Link>
                  <button
                    className="similar-asana-remove"
                    onClick={() => handleRemoveSimilar(similar.id)}
                  >
                    Удалить связь
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {showAddPhotoForm && (
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

      {/* Модальное окно выбора асаны для совпадения */}
      {showMatchModal && (
        <div className="modal-overlay" onClick={() => setShowMatchModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Указать совпадение</h3>
              <button className="modal-close" onClick={() => setShowMatchModal(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="modal-search">
                <input
                  type="text"
                  placeholder="Поиск асаны..."
                  value={matchSearchQuery}
                  onChange={(e) => setMatchSearchQuery(e.target.value)}
                />
              </div>
              <div className="modal-asanas-list">
                {filteredAsanasForMatch.map((a) => (
                  <div
                    key={a.id}
                    className={`modal-asana-item ${selectedMatchAsana?.id === a.id ? 'selected' : ''}`}
                    onClick={() => setSelectedMatchAsana(a)}
                  >
                    {a.photo ? (
                      <img
                        src={getPhotoSrc(a.photo)}
                        alt={a.name?.name_ru}
                        className="modal-asana-thumb"
                      />
                    ) : (
                      <div className="modal-asana-thumb" style={{ background: '#eee' }} />
                    )}
                    <div className="modal-asana-info">
                      <div className="modal-asana-name">{a.name?.name_ru}</div>
                      {a.sources?.[0] && (
                        <div className="modal-asana-source">
                          {a.sources[0].author}
                          {a.sources[0].year && ` (${a.sources[0].year})`}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {filteredAsanasForMatch.length === 0 && (
                  <p style={{ textAlign: 'center', color: '#666' }}>Асаны не найдены</p>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowMatchModal(false)}>
                Отмена
              </button>
              <button
                className="btn-primary"
                onClick={handleMatchAsana}
                disabled={!selectedMatchAsana}
              >
                Указать совпадение
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AsanaDetail;
