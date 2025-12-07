import React, { useState, useEffect } from 'react';
import { moderationAPI } from '../api/moderation';
import { sourcesAPI } from '../api/sources';
import { contentAPI } from '../api/content';
import SearchableSelect from '../components/SearchableSelect';
import '../styles/Moderation.css';

const Moderation = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolvedFilter, setResolvedFilter] = useState(false);
  const [resolving, setResolving] = useState({});
  const [addingAsana, setAddingAsana] = useState({});
  const [showAddForm, setShowAddForm] = useState({});
  const [sources, setSources] = useState([]);
  const [names, setNames] = useState([]);
  const [addFormData, setAddFormData] = useState({});
  const [keepPhotoFromRequest, setKeepPhotoFromRequest] = useState({}); // Галочка для сохранения фото из запроса
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadItems();
    loadSources();
    loadNames();
  }, [resolvedFilter]);

  const loadSources = async () => {
    try {
      const data = await sourcesAPI.getAll();
      setSources(data);
    } catch (error) {
      console.error('Error loading sources:', error);
    }
  };

  const loadNames = async () => {
    try {
      const data = await contentAPI.getNames();
      setNames(data);
    } catch (error) {
      console.error('Error loading names:', error);
    }
  };

  const loadItems = async () => {
    setLoading(true);
    try {
      const data = await moderationAPI.getItems(resolvedFilter);
      setItems(data);
    } catch (error) {
      console.error('Error loading moderation items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (itemId) => {
    if (resolving[itemId]) return;
    
    setResolving({ ...resolving, [itemId]: true });
    try {
      await moderationAPI.resolveItem(itemId);
      await loadItems(); // Перезагружаем список
    } catch (error) {
      console.error('Error resolving item:', error);
    } finally {
      setResolving({ ...resolving, [itemId]: false });
    }
  };

  const handleAddAsana = async (itemId) => {
    if (addingAsana[itemId]) return;
    
    const formData = addFormData[itemId];
    if (!formData || !formData.name_id || !formData.source_id) {
      alert('Заполните все обязательные поля');
      return;
    }
    
    setAddingAsana({ ...addingAsana, [itemId]: true });
    try {
      await moderationAPI.addAsanaFromModeration(
        itemId,
        formData.name_id,
        formData.source_id,
        formData.photo,
        keepPhotoFromRequest[itemId] || false
      );
      await loadItems();
      setShowAddForm({ ...showAddForm, [itemId]: false });
      setAddFormData({ ...addFormData, [itemId]: {} });
      setKeepPhotoFromRequest({ ...keepPhotoFromRequest, [itemId]: false });
    } catch (error) {
      console.error('Error adding asana:', error);
      alert(error.response?.data?.detail || 'Ошибка при добавлении асаны');
    } finally {
      setAddingAsana({ ...addingAsana, [itemId]: false });
    }
  };

  const toggleAddForm = (itemId) => {
    setShowAddForm({ ...showAddForm, [itemId]: !showAddForm[itemId] });
    if (!showAddForm[itemId]) {
      // Инициализируем форму данными из записи
      const item = items.find(i => i.id === itemId);
      if (item) {
        setAddFormData({
          ...addFormData,
          [itemId]: {
            name_id: item.existing_name_id || '',
            source_id: item.source_id || '',
            photo: null
          }
        });
      }
    }
  };

  const handleExport = async () => {
    if (exporting) return;
    
    setExporting(true);
    try {
      // Всегда экспортируем только нерешённые записи
      await moderationAPI.exportItems();
    } catch (error) {
      console.error('Error exporting moderation items:', error);
      alert('Ошибка при экспорте файла');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return <div className="container">Загрузка...</div>;
  }

  return (
    <div className="container">
      <div className="moderation-container">
        <h1 className="moderation-title">Требует модерации</h1>

        <div className="moderation-filters">
          <div className="filter-group">
            <label>
              <input
                type="checkbox"
                checked={resolvedFilter}
                onChange={(e) => setResolvedFilter(e.target.checked)}
              />
              Показать решенные
            </label>
          </div>
          <div className="filter-group" style={{ marginLeft: '1em', color: '#666', fontSize: '0.9em' }}>
            Записи отсортированы по времени создания (новые сначала)
          </div>
          <div className="filter-group" style={{ marginLeft: 'auto' }}>
            <button
              className="btn-primary"
              onClick={handleExport}
              disabled={exporting || items.length === 0}
              style={{ marginLeft: '1em' }}
            >
              {exporting ? 'Экспорт...' : 'Экспорт в Excel'}
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <p className="no-items">Нет записей для модерации</p>
        ) : (
          <div className="moderation-items">
            {items.map((item) => (
              <div key={item.id} className="moderation-item">
                <div className="moderation-item-header">
                  <div style={{ display: 'flex', gap: '1em', alignItems: 'center' }}>
                    <span className="moderation-item-type">
                      {item.moderation_type === 'name_mismatch' ? 'Несовпадение названия' :
                       item.moderation_type === 'duplicate_name' ? 'Дубликат названия' :
                       item.moderation_type === 'duplicate_source' ? 'Дубликат источника' :
                       'Ошибка'}
                    </span>
                    {item.object_type && (
                      <span style={{ 
                        padding: '0.25em 0.5em', 
                        backgroundColor: '#e3f2fd', 
                        borderRadius: '4px',
                        fontSize: '0.85em',
                        fontWeight: '500'
                      }}>
                        {item.object_type === 'asana_name' ? 'Название Асаны' :
                         item.object_type === 'source' ? 'Источник' :
                         item.object_type === 'asana' ? 'Асана' :
                         item.object_type}
                      </span>
                    )}
                  </div>
                  <span className="moderation-item-row">Строка {item.row_number}</span>
                </div>
                
                <div className="moderation-item-content">
                  <div className="moderation-item-field">
                    <strong>Сообщение:</strong> {item.error_message}
                  </div>
                  
                  {item.asana_name && (
                    <div className="moderation-item-field">
                      <strong>Название асаны:</strong> {item.asana_name}
                    </div>
                  )}
                  
                  {item.moderation_type === 'name_mismatch' && (
                    <>
                      {item.suggested_name_ru && (
                        <div className="moderation-item-field">
                          <strong>Предложенное название:</strong> {item.suggested_name_ru}
                        </div>
                      )}
                      {item.existing_name_ru && (
                        <div className="moderation-item-field">
                          <strong>Существующее название:</strong> {item.existing_name_ru}
                        </div>
                      )}
                      {item.suggested_name_sanskrit && (
                        <div className="moderation-item-field">
                          <strong>Санскрит:</strong> {item.suggested_name_sanskrit}
                        </div>
                      )}
                      {item.suggested_transliteration && (
                        <div className="moderation-item-field">
                          <strong>Транслитерация:</strong> {item.suggested_transliteration}
                        </div>
                      )}
                      {item.suggested_definition && (
                        <div className="moderation-item-field">
                          <strong>Определение:</strong> {item.suggested_definition}
                        </div>
                      )}
                    </>
                  )}
                  
                  {/* Показываем поля из import_data */}
                  {item.import_data && typeof item.import_data === 'object' && (
                    <div className="moderation-item-import-data">
                      {Object.entries(item.import_data).map(([key, value]) => {
                        // Пропускаем фото - показываем отдельно
                        if (key === 'photo' || key === 'photo_url' || key === 'photo_base64') {
                          return null;
                        }
                        
                        // Пропускаем пустые значения
                        if (!value || value === '' || (Array.isArray(value) && value.length === 0)) {
                          return null;
                        }
                        
                        // Форматируем ключ для отображения
                        const displayKey = key
                          .replace(/_/g, ' ')
                          .replace(/\b\w/g, l => l.toUpperCase());
                        
                        return (
                          <div key={key} className="moderation-item-field">
                            <strong>{displayKey}:</strong>{' '}
                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                          </div>
                        );
                      })}
                      
                      {/* Показываем фото если есть */}
                      {(item.import_data.photo || item.import_data.photo_url || item.import_data.photo_base64) && (
                        <div className="moderation-item-field">
                          <strong>Фотография из запроса:</strong>
                          <div className="moderation-photo-preview" style={{ marginTop: '0.5em' }}>
                            {item.import_data.photo_url ? (
                              <img 
                                src={item.import_data.photo_url} 
                                alt="Фото из запроса"
                                style={{ maxWidth: '300px', maxHeight: '300px', borderRadius: '8px', border: '1px solid #ddd' }}
                              />
                            ) : item.import_data.photo_base64 ? (
                              <img 
                                src={`data:image/jpeg;base64,${item.import_data.photo_base64}`} 
                                alt="Фото из запроса"
                                style={{ maxWidth: '300px', maxHeight: '300px', borderRadius: '8px', border: '1px solid #ddd' }}
                              />
                            ) : item.import_data.photo ? (
                              typeof item.import_data.photo === 'string' ? (
                                item.import_data.photo.startsWith('http') || item.import_data.photo.startsWith('data:') ? (
                                  <img 
                                    src={item.import_data.photo} 
                                    alt="Фото из запроса"
                                    style={{ maxWidth: '300px', maxHeight: '300px', borderRadius: '8px', border: '1px solid #ddd' }}
                                  />
                                ) : (
                                  <img 
                                    src={`data:image/jpeg;base64,${item.import_data.photo}`} 
                                    alt="Фото из запроса"
                                    style={{ maxWidth: '300px', maxHeight: '300px', borderRadius: '8px', border: '1px solid #ddd' }}
                                  />
                                )
                              ) : null
                            ) : null}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="moderation-item-footer">
                  <span className="moderation-item-date">
                    Создано: {new Date(item.created_at).toLocaleString('ru-RU')}
                  </span>
                  {item.resolved && (
                    <span className="moderation-item-resolved">
                      Решено: {item.resolved_by} ({new Date(item.resolved_at).toLocaleString('ru-RU')})
                    </span>
                  )}
                  {!item.resolved && (
                    <>
                      <button
                        className="btn-primary"
                        onClick={() => toggleAddForm(item.id)}
                        style={{ marginRight: '0.5em' }}
                      >
                        Добавить асану
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={() => handleResolve(item.id)}
                        disabled={resolving[item.id]}
                      >
                        {resolving[item.id] ? 'Обработка...' : 'Отметить как решенное'}
                      </button>
                    </>
                  )}
                </div>
                {!item.resolved && showAddForm[item.id] && (
                  <div className="moderation-add-form" style={{ marginTop: '1em', padding: '1em', border: '1px solid #ddd', borderRadius: '8px' }}>
                    <h4>Добавить асану</h4>
                    <div style={{ marginBottom: '1em' }}>
                      <label style={{ display: 'block', marginBottom: '0.5em' }}>
                        Название асаны *
                        <SearchableSelect
                          value={addFormData[item.id]?.name_id || ''}
                          onChange={(value) => setAddFormData({
                            ...addFormData,
                            [item.id]: { ...addFormData[item.id], name_id: value }
                          })}
                          options={names}
                          placeholder="Выберите название..."
                          getOptionLabel={(name) => 
                            name.name_ru + (name.name_sanskrit ? ` (${name.name_sanskrit})` : '')
                          }
                          getOptionValue={(name) => name.id}
                          required
                          style={{ marginTop: '0.25em' }}
                        />
                      </label>
                    </div>
                    <div style={{ marginBottom: '1em' }}>
                      <label style={{ display: 'block', marginBottom: '0.5em' }}>
                        Источник *
                        <SearchableSelect
                          value={addFormData[item.id]?.source_id || ''}
                          onChange={(value) => setAddFormData({
                            ...addFormData,
                            [item.id]: { ...addFormData[item.id], source_id: value }
                          })}
                          options={sources}
                          placeholder="Выберите источник..."
                          getOptionLabel={(source) => `${source.author} - ${source.title}`}
                          getOptionValue={(source) => source.id}
                          required
                          style={{ marginTop: '0.25em' }}
                        />
                      </label>
                    </div>
                    <div style={{ marginBottom: '1em' }}>
                      <label style={{ display: 'block', marginBottom: '0.5em' }}>
                        Фото (опционально)
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setAddFormData({
                            ...addFormData,
                            [item.id]: { ...addFormData[item.id], photo: e.target.files[0] }
                          })}
                          style={{ width: '100%', padding: '0.5em', marginTop: '0.25em' }}
                        />
                      </label>
                      {item.import_data && typeof item.import_data === 'object' && item.import_data.photo && (
                        <label style={{ display: 'flex', alignItems: 'center', marginTop: '0.5em' }}>
                          <input
                            type="checkbox"
                            checked={keepPhotoFromRequest[item.id] || false}
                            onChange={(e) => setKeepPhotoFromRequest({
                              ...keepPhotoFromRequest,
                              [item.id]: e.target.checked
                            })}
                            style={{ marginRight: '0.5em' }}
                          />
                          Оставить фото как было в запросе
                        </label>
                      )}
                    </div>
                    <div>
                      <button
                        className="btn-primary"
                        onClick={() => handleAddAsana(item.id)}
                        disabled={addingAsana[item.id]}
                        style={{ marginRight: '0.5em' }}
                      >
                        {addingAsana[item.id] ? 'Добавление...' : 'Добавить'}
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={() => toggleAddForm(item.id)}
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Moderation;

