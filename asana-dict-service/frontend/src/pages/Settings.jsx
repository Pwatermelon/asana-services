import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { settingsAPI } from '../api/settings';
import { sourcesAPI } from '../api/sources';
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

  useEffect(() => {
    if (importMode === 'asanas') {
      loadSources();
    }
  }, [importMode]);

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

    setImporting(true);
    setError('');
    setSuccess('');
    setImportProgress(0);
    setImportStatus('pending');

    try {
      let result;
      if (importMode === 'asanas') {
        result = await settingsAPI.importAsanas(selectedFile, selectedSource);
      } else {
        result = await settingsAPI.importFull(selectedFile);
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
              <select
                id="source-select"
                className="form-select"
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value)}
              >
                <option value="">Выберите источник...</option>
                {sources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.title || source.author || source.id}
                  </option>
                ))}
              </select>
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
    </div>
  );
};

export default Settings;
