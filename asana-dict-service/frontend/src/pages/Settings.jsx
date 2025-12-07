import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { settingsAPI } from '../api/settings';
import { sourcesAPI } from '../api/sources';
import SearchableSelect from '../components/SearchableSelect';
import '../styles/Settings.css';

const Settings = () => {
  const { isAdmin, isExpertOrAdmin } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importingNames, setImportingNames] = useState(false);
  const [importMode, setImportMode] = useState('asanas'); // 'asanas' or 'full'
  const [selectedSource, setSelectedSource] = useState('');
  const [sources, setSources] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [namesError, setNamesError] = useState('');
  const [namesSuccess, setNamesSuccess] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedNamesFile, setSelectedNamesFile] = useState(null);
  const [importTaskId, setImportTaskId] = useState(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState(null);
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [scannedSources, setScannedSources] = useState([]);
  const [sourceMapping, setSourceMapping] = useState({});
  const [pendingFile, setPendingFile] = useState(null);

  useEffect(() => {
    if (importMode === 'asanas' || showSourceModal) {
      loadSources();
    }
  }, [importMode, showSourceModal]);

  const loadSources = async () => {
    try {
      const data = await sourcesAPI.getAll();
      setSources(data);
      if (data.length > 0 && !selectedSource) {
        setSelectedSource(data[0].id);
      }
    } catch (error) {
      console.error('Error loading sources:', error);
    }
  };

  const handleOntologyUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setError('');
    setSuccess('');

    try {
      await settingsAPI.uploadOntology(file);
      setSuccess('Онтология успешно загружена');
      e.target.value = ''; // Reset input
    } catch (error) {
      setError(error.response?.data?.detail || 'Ошибка при загрузке онтологии');
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadOntology = async () => {
    try {
      await settingsAPI.downloadOntology();
    } catch (error) {
      setError('Ошибка при выгрузке онтологии');
      console.error('Error downloading ontology:', error);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    setSelectedFile(file || null);
    setError('');
    setSuccess('');
  };

  const handleImportFile = async () => {
    if (!selectedFile) {
      setError('Выберите файл для импорта');
      return;
    }

    if (importMode === 'asanas' && !selectedSource) {
      setError('Выберите источник для импорта асан');
      return;
    }

    // Для полного импорта сначала сканируем файл
    if (importMode === 'full') {
      try {
        setImporting(true);
        setError('');
        const scanResult = await settingsAPI.scanFullImport(selectedFile);
        const newSources = scanResult.sources || [];
        
        // Фильтруем только новые источники (которые не существуют)
        const newSourcesOnly = newSources.filter(s => !s.exists);
        
        if (newSourcesOnly.length > 0) {
          // Есть новые источники - показываем модальное окно
          // Инициализируем маппинг: по умолчанию все источники = 'new'
          const initialMapping = {};
          newSourcesOnly.forEach(source => {
            const key = `${source.title}|${source.author}|${source.year}`;
            initialMapping[key] = 'new';
          });
          
          setScannedSources(newSourcesOnly);
          setPendingFile(selectedFile);
          setSourceMapping(initialMapping);
          setShowSourceModal(true);
          setImporting(false);
          return;
        }
        // Нет новых источников - продолжаем импорт
      } catch (error) {
        setError(error.response?.data?.detail || 'Ошибка при сканировании файла');
        setImporting(false);
        return;
      }
    }

    // Продолжаем импорт
    await startImport(selectedFile);
  };

  const startImport = async (file, mapping = null) => {
    setImporting(true);
    setError('');
    setSuccess('');
    setImportProgress(0);
    setImportStatus('pending');

    try {
      let result;
      if (importMode === 'asanas') {
        result = await settingsAPI.importAsanas(file, selectedSource);
      } else {
        // Используем переданный маппинг (может содержать 'new' для создания новых источников)
        // Всегда передаем маппинг, даже если он пустой (null будет передан если маппинга нет вообще)
        result = await settingsAPI.importFull(file, mapping);
      }
      
      // Получаем task_id из ответа
      const taskId = result.task_id;
      if (taskId) {
        setImportTaskId(taskId);
        // Запускаем опрос статуса
        pollImportStatus(taskId);
      } else {
        // Если нет task_id, значит старый синхронный формат
        const errorText = result.errors_count > 0 ? ` (${result.errors_count} ошибок)` : '';
        if (importMode === 'asanas') {
          setSuccess(`Успешно импортировано ${result.imported} асан${errorText}`);
        } else {
          setSuccess(`Успешно импортировано ${result.imported_asanas} асан и ${result.imported_sources} источников${errorText}`);
        }
        setImporting(false);
        setSelectedFile(null);
        const fileInput = document.getElementById('import-file');
        if (fileInput) fileInput.value = '';
      }
    } catch (error) {
      setError(error.response?.data?.detail || 'Ошибка при импорте файла');
      setImporting(false);
    }
  };

  const handleConfirmSources = async () => {
    try {
      // Очищаем только промежуточные значения 'select' и пустые строки из маппинга
      // Значение 'new' должно остаться, так как оно означает "создать новый источник"
      const cleanMapping = {};
      Object.keys(sourceMapping).forEach(key => {
        const value = sourceMapping[key];
        // Сохраняем 'new' и валидные ID источников, удаляем только 'select' и пустые строки
        if (value && value !== 'select' && value !== '') {
          cleanMapping[key] = value;
        }
      });
      
      // Закрываем модальное окно сразу
      setShowSourceModal(false);
      
      // Сохраняем данные перед очисткой
      const fileToImport = pendingFile;
      // Всегда передаем маппинг, даже если он содержит только 'new'
      const mappingToUse = cleanMapping;
      
      // Очищаем состояние
      setPendingFile(null);
      setScannedSources([]);
      setSourceMapping({});
      
      // Запускаем импорт
      if (fileToImport) {
        await startImport(fileToImport, mappingToUse);
      } else {
        setError('Ошибка: файл не найден');
        setImporting(false);
      }
    } catch (error) {
      console.error('Error in handleConfirmSources:', error);
      setError('Ошибка при запуске импорта: ' + (error.message || 'Неизвестная ошибка'));
      setImporting(false);
    }
  };

  const handleCancelSources = () => {
    setShowSourceModal(false);
    setPendingFile(null);
    setScannedSources([]);
    setSourceMapping({});
    setImporting(false);
  };

  const pollImportStatus = async (taskId) => {
    const maxAttempts = 600; // 10 минут максимум (600 * 1 секунда)
    let attempts = 0;
    
    const checkStatus = async () => {
      try {
        const status = await settingsAPI.getImportStatus(taskId);
        setImportProgress(status.progress || 0);
        setImportStatus(status.status);
        
        if (status.status === 'completed') {
          setImporting(false);
          const result = status.result || {};
          if (importMode === 'asanas') {
            const errorText = result.errors_count > 0 ? ` (${result.errors_count} ошибок)` : '';
            setSuccess(`Успешно импортировано ${result.imported || 0} асан${errorText}`);
          } else {
            const errorText = result.errors_count > 0 ? ` (${result.errors_count} ошибок)` : '';
            setSuccess(`Успешно импортировано ${result.imported_asanas || 0} асан и ${result.imported_sources || 0} источников${errorText}`);
          }
          setSelectedFile(null);
          const fileInput = document.getElementById('import-file');
          if (fileInput) fileInput.value = '';
          setImportTaskId(null);
        } else if (status.status === 'error') {
          setImporting(false);
          setError(status.error || 'Ошибка при импорте');
          setImportTaskId(null);
        } else if (status.status === 'processing' || status.status === 'pending') {
          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(checkStatus, 1000); // Проверяем каждую секунду
          } else {
            setImporting(false);
            setError('Превышено время ожидания импорта');
            setImportTaskId(null);
          }
        }
      } catch (error) {
        setImporting(false);
        setError('Ошибка при проверке статуса импорта');
        setImportTaskId(null);
      }
    };
    
    checkStatus();
  };

  const handleNamesFileSelect = (e) => {
    const file = e.target.files[0];
    setSelectedNamesFile(file || null);
    setNamesError('');
    setNamesSuccess('');
  };

  const handleImportNames = async () => {
    if (!selectedNamesFile) {
      setNamesError('Выберите файл для импорта');
      return;
    }

    setImportingNames(true);
    setNamesError('');
    setNamesSuccess('');

    try {
      const result = await settingsAPI.importAsanaNames(selectedNamesFile);
      const errorText = result.errors_count > 0 ? ` (${result.errors_count} ошибок)` : '';
      const skippedText = result.skipped > 0 ? `, пропущено ${result.skipped}` : '';
      setNamesSuccess(`Успешно импортировано ${result.imported} названий${skippedText}${errorText}`);
      setSelectedNamesFile(null);
      // Reset file input
      const fileInput = document.getElementById('names-import-file');
      if (fileInput) fileInput.value = '';
    } catch (error) {
      setNamesError(error.response?.data?.detail || 'Ошибка при импорте названий асан');
    } finally {
      setImportingNames(false);
    }
  };

  return (
    <div className="container">
      <div className="settings-container">
        <h1 className="settings-title">Настройки</h1>

        {isAdmin && (
          <div className="settings-section">
            <h2 className="settings-section-title">Управление онтологией</h2>
            <p className="settings-description">
              Загрузите или выгрузите файл онтологии в формате OWL.
            </p>

            <div className="settings-actions">
              <div className="form-group">
                <label htmlFor="ontology-file" className="form-label">
                  Загрузить онтологию
                </label>
                <input
                  type="file"
                  id="ontology-file"
                  accept=".owl"
                  onChange={handleOntologyUpload}
                  disabled={uploading}
                />
                {uploading && <p>Загрузка...</p>}
              </div>

              <div className="form-group">
                <label className="form-label" style={{ opacity: 0, pointerEvents: 'none' }}>
                  &nbsp;
                </label>
                <button
                  onClick={handleDownloadOntology}
                  className="btn-primary"
                  style={{ width: '100%' }}
                >
                  Выгрузить онтологию
                </button>
              </div>
            </div>
          </div>
        )}

        {isExpertOrAdmin && (
          <div className="settings-section">
            <h2 className="settings-section-title">Импорт данных</h2>
            <p className="settings-description">
              Импортируйте асаны из Excel файла. Выберите режим импорта.
            </p>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <div className="form-group">
            <label className="form-label">Режим импорта</label>
            <div className="radio-group">
              <label>
                <input
                  type="radio"
                  name="importMode"
                  value="asanas"
                  checked={importMode === 'asanas'}
                  onChange={(e) => setImportMode(e.target.value)}
                />
                Только асаны (выбрать источник)
              </label>
              <label>
                <input
                  type="radio"
                  name="importMode"
                  value="full"
                  checked={importMode === 'full'}
                  onChange={(e) => setImportMode(e.target.value)}
                />
                Полный импорт (создать новый источник)
              </label>
            </div>
          </div>

          {importMode === 'asanas' && (
            <div className="form-group">
              <label htmlFor="source-select" className="form-label">
                Выберите источник
              </label>
              <SearchableSelect
                value={selectedSource}
                onChange={setSelectedSource}
                options={sources}
                placeholder="Выберите источник..."
                getOptionLabel={(source) => source.title || source.author || source.id}
                getOptionValue={(source) => source.id}
                className="form-select"
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="import-file" className="form-label">
              Выберите Excel файл
            </label>
            <input
              type="file"
              id="import-file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              disabled={importing}
            />
            {selectedFile && (
              <p className="file-selected">
                Выбран файл: {selectedFile.name}
              </p>
            )}
          </div>

                 <div className="form-group">
                   <button
                     type="button"
                     onClick={handleImportFile}
                     className="btn-primary"
                     disabled={!selectedFile || importing}
                     style={{ width: '100%' }}
                   >
                     {importing ? 'Импорт...' : 'Импортировать'}
                   </button>
                   {importing && importTaskId && (
                     <div style={{ marginTop: '1em' }}>
                       <div style={{ marginBottom: '0.5em', fontSize: '0.9em', color: 'var(--text-secondary)' }}>
                         {importStatus === 'processing' ? 'Импорт выполняется...' : 
                          importStatus === 'pending' ? 'Ожидание начала импорта...' : 
                          'Проверка статуса...'}
                       </div>
                       <div style={{ 
                         width: '100%', 
                         height: '20px', 
                         backgroundColor: 'var(--background-alt)', 
                         borderRadius: '10px',
                         overflow: 'hidden'
                       }}>
                         <div style={{ 
                           width: `${importProgress}%`, 
                           height: '100%', 
                           backgroundColor: 'var(--primary-color)',
                           transition: 'width 0.3s ease'
                         }} />
                       </div>
                       <div style={{ marginTop: '0.5em', fontSize: '0.85em', color: 'var(--text-secondary)' }}>
                         {importProgress}%
                       </div>
                     </div>
                   )}
                 </div>
          </div>
        )}

        {isExpertOrAdmin && (
          <div className="settings-section">
            <h2 className="settings-section-title">Импорт названий асан</h2>
            <p className="settings-description">
              Импортируйте названия асан из Excel файла. Ожидаются колонки:
              название (обязательно), санскрит, транслитерация, определение.
              Если название уже существует, оно будет пропущено.
            </p>

            {namesError && <div className="error-message">{namesError}</div>}
            {namesSuccess && <div className="success-message">{namesSuccess}</div>}

            <div className="form-group">
              <label htmlFor="names-import-file" className="form-label">
                Выберите Excel файл с названиями асан
              </label>
              <input
                type="file"
                id="names-import-file"
                accept=".xlsx,.xls"
                onChange={handleNamesFileSelect}
                disabled={importingNames}
              />
              {selectedNamesFile && (
                <p className="file-selected">
                  Выбран файл: {selectedNamesFile.name}
                </p>
              )}
            </div>

            <div className="form-group">
              <button
                type="button"
                onClick={handleImportNames}
                className="btn-primary"
                disabled={!selectedNamesFile || importingNames}
                style={{ width: '100%' }}
              >
                {importingNames ? 'Импорт...' : 'Импортировать названия'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Модальное окно для выбора источников */}
      {showSourceModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCancelSources();
            }
          }}
        >
          <div 
            style={{
              backgroundColor: 'white',
              padding: '2em',
              borderRadius: '10px',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
              position: 'relative',
              zIndex: 1001
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0 }}>Обнаружены новые источники</h2>
            <p style={{ color: '#666', marginBottom: '1.5em' }}>
              В файле найдены источники, которых нет в системе. Выберите действие для каждого:
            </p>
            
            {scannedSources.map((source, index) => {
              const sourceKey = `${source.title}|${source.author}|${source.year}`;
              const currentMapping = sourceMapping[sourceKey];
              const isCreatingNew = !currentMapping || currentMapping === 'new';
              const isSelectingExisting = currentMapping && currentMapping !== 'new';
              
              return (
                <div key={index} style={{
                  marginBottom: '1.5em',
                  padding: '1em',
                  border: '1px solid #ddd',
                  borderRadius: '8px'
                }}>
                  <div style={{ marginBottom: '0.5em' }}>
                    <strong>{source.title}</strong>
                    {source.author && <div>Автор: {source.author}</div>}
                    {source.year && <div>Год: {source.year}</div>}
                  </div>
                  
                  <div style={{ marginTop: '0.5em' }}>
                    <label 
                      style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5em', cursor: 'pointer' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSourceMapping({
                          ...sourceMapping,
                          [sourceKey]: 'new'
                        });
                      }}
                    >
                      <input
                        type="radio"
                        name={`source-${index}`}
                        checked={isCreatingNew}
                        onChange={() => {
                          setSourceMapping({
                            ...sourceMapping,
                            [sourceKey]: 'new'
                          });
                        }}
                        style={{ marginRight: '0.5em', cursor: 'pointer' }}
                      />
                      Создать новый источник
                    </label>
                    
                    <label 
                      style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5em', cursor: 'pointer' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isSelectingExisting) {
                          setSourceMapping({
                            ...sourceMapping,
                            [sourceKey]: 'select'
                          });
                        }
                      }}
                    >
                      <input
                        type="radio"
                        name={`source-${index}`}
                        checked={isSelectingExisting}
                        onChange={() => {
                          setSourceMapping({
                            ...sourceMapping,
                            [sourceKey]: currentMapping && currentMapping !== 'new' ? currentMapping : 'select'
                          });
                        }}
                        style={{ marginRight: '0.5em', cursor: 'pointer' }}
                      />
                      Выбрать существующий источник
                    </label>
                    
                    {isSelectingExisting && (
                      <div style={{ marginLeft: '1.5em', marginTop: '0.5em', width: 'calc(100% - 2em)' }}>
                        <SearchableSelect
                          value={currentMapping === 'select' ? '' : currentMapping}
                          onChange={(value) => {
                            setSourceMapping({
                              ...sourceMapping,
                              [sourceKey]: value
                            });
                          }}
                          options={sources}
                          placeholder="Выберите источник..."
                          getOptionLabel={(s) => `${s.author} - ${s.title}${s.year ? ` (${s.year})` : ''}`}
                          getOptionValue={(s) => s.id}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            
            <div style={{ display: 'flex', gap: '1em', marginTop: '2em', justifyContent: 'flex-end' }}>
              <button
                className="btn-secondary"
                onClick={handleCancelSources}
              >
                Отмена
              </button>
              <button
                className="btn-primary"
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!e.currentTarget.disabled) {
                    handleConfirmSources();
                  }
                }}
                disabled={scannedSources.length === 0 || scannedSources.some(source => {
                  const key = `${source.title}|${source.author}|${source.year}`;
                  const mapping = sourceMapping[key];
                  
                  // Кнопка disabled если:
                  // 1. Нет выбора (mapping пустое или undefined)
                  if (!mapping) return true;
                  
                  // 2. "Создать новый" - OK
                  if (mapping === 'new') return false;
                  
                  // 3. Выбрано "Выбрать существующий" но не выбран конкретный источник (mapping === 'select' или пустая строка)
                  if (mapping === 'select' || mapping === '') return true;
                  
                  // 4. Проверяем, что выбранный источник существует
                  const sourceExists = sources.find(s => s.id === mapping);
                  return !sourceExists;
                })}
              >
                Продолжить импорт
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
