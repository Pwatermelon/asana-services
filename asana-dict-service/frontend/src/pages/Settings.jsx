import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { settingsAPI } from '../api/settings';
import { sourcesAPI } from '../api/sources';
import SearchableSelect from '../components/SearchableSelect';
import '../styles/Settings.css';

/** Сводка по модерации и «тихим» пропускам — не путать с числом новых записей в OWL. */
function formatImportExtraStats(result) {
  if (!result || typeof result !== 'object') return '';
  const rows = typeof result.rows_processed === 'number' ? result.rows_processed : null;
  const mi = result.moderation_inserted ?? 0;
  const mm = result.moderation_merged ?? 0;
  const ms = result.moderation_skipped ?? 0;
  const me = result.moderation_save_errors ?? 0;
  const sk = result.skipped_identical_in_catalog ?? 0;
  const parts = [];
  if (rows != null && rows > 0) parts.push(`строк обработано: ${rows}`);
  const mods = [];
  if (mi) mods.push(`новых в модерации: ${mi}`);
  if (mm) mods.push(`дополнение к карточке модерации: ${mm}`);
  if (ms) mods.push(`повтор импорта (модерация без изменений): ${ms}`);
  if (me) mods.push(`сбой записи в модерацию: ${me}`);
  if (mods.length) parts.push(`модерация — ${mods.join(', ')}`);
  if (sk) parts.push(`без изменений в каталоге (уже есть те же данные): ${sk}`);
  if (!parts.length) return '';
  return ` ${parts.join('. ')}.`;
}

const Settings = () => {
  const { isAdmin, isExpertOrAdmin } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importingNames, setImportingNames] = useState(false);
  const [exportingNames, setExportingNames] = useState(false);
  const [importMode, setImportMode] = useState('asanas'); // 'asanas' or 'full'
  const [selectedSource, setSelectedSource] = useState('');
  const [sources, setSources] = useState([]);
  /** Сообщения только для блока «Управление онтологией» (загрузка/выгрузка OWL) */
  const [ontologyError, setOntologyError] = useState('');
  const [ontologySuccess, setOntologySuccess] = useState('');
  /** Сообщения только для блока «Импорт сведений об асанах» (Excel) */
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [namesError, setNamesError] = useState('');
  const [namesSuccess, setNamesSuccess] = useState('');
  /** Пропущенные при импорте: { row: номер строки Excel, name: название } */
  const [lastSkippedItems, setLastSkippedItems] = useState([]);
  /** Строки с ошибками импорта асан (полный/только асаны) — из ответа задачи */
  const [importErrors, setImportErrors] = useState([]);
  const [importErrorsMeta, setImportErrorsMeta] = useState({
    total: 0,
    truncated: false,
  });
  /** Ошибки при импорте названий из Excel */
  const [namesImportErrors, setNamesImportErrors] = useState([]);
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
    setOntologyError('');
    setOntologySuccess('');

    try {
      await settingsAPI.uploadOntology(file);
      setOntologySuccess('Онтология успешно загружена');
      e.target.value = ''; // Reset input
    } catch (error) {
      setOntologyError(error.response?.data?.detail || 'Ошибка при загрузке онтологии');
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadOntology = async () => {
    setOntologyError('');
    setOntologySuccess('');
    try {
      await settingsAPI.downloadOntology();
    } catch (error) {
      setOntologyError('Ошибка при выгрузке онтологии');
      console.error('Error downloading ontology:', error);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    setSelectedFile(file || null);
    setError('');
    setSuccess('');
    setImportErrors([]);
    setImportErrorsMeta({ total: 0, truncated: false });
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

  const applyImportResultToState = (result) => {
    if (!result || typeof result !== 'object') return;
    const errs = Array.isArray(result.errors) ? result.errors : [];
    const total =
      typeof result.errors_total === 'number' ? result.errors_total : errs.length;
    setImportErrors(errs);
    setImportErrorsMeta({
      total,
      truncated: Boolean(result.errors_truncated),
    });
  };

  const startImport = async (file, mapping = null) => {
    setImporting(true);
    setError('');
    setSuccess('');
    setImportErrors([]);
    setImportErrorsMeta({ total: 0, truncated: false });
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
        applyImportResultToState(result);
        const errorText = result.errors_count > 0 ? ` (${result.errors_count} ошибок)` : '';
        const extra = formatImportExtraStats(result);
        if (importMode === 'asanas') {
          const base = `Успешно импортировано ${result.imported} асан${errorText}`;
          setSuccess(extra ? `${base}.${extra}` : base);
        } else {
          const base = `Успешно импортировано ${result.imported_asanas} асан и ${result.imported_sources} источников${errorText}`;
          setSuccess(extra ? `${base}.${extra}` : base);
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
    const maxWaitMs = 30 * 60 * 1000; // до 30 минут ожидания
    const pollMs = 200; // быстрый прод успевает пройти 10–99% между опросами; 1 с давало «4% → 100%»
    const startedAt = Date.now();

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    /** Повтор при 404/502/503/504: другая реплика, краткий сбой Redis или шлюза. */
    const getImportStatusWithRetry = async (id) => {
      const maxRetries = 6;
      let lastErr;
      for (let r = 0; r < maxRetries; r++) {
        try {
          return await settingsAPI.getImportStatus(id);
        } catch (err) {
          lastErr = err;
          const st = err.response?.status;
          const msg = typeof err.message === 'string' ? err.message : '';
          const isTimeout =
            err.code === 'ECONNABORTED' ||
            err.code === 'ETIMEDOUT' ||
            msg.toLowerCase().includes('timeout');
          const noResponse = !err.response && err.request;
          const retryable =
            st === 404 ||
            st === 502 ||
            st === 503 ||
            st === 504 ||
            isTimeout ||
            noResponse;
          if (!retryable || r === maxRetries - 1) throw err;
          await sleep(600 * (r + 1));
        }
      }
      throw lastErr;
    };

    const formatStatusPollError = (error) => {
      const st = error.response?.status;
      const detail = error.response?.data?.detail;
      if (typeof detail === 'string' && detail.trim()) {
        return st ? `${detail} (HTTP ${st})` : detail;
      }
      if (error.message) return error.message;
      return 'Ошибка при проверке статуса импорта';
    };

    const checkStatus = async () => {
      try {
        const status = await getImportStatusWithRetry(taskId);
        const rawP = status.progress;
        const p = typeof rawP === 'number' ? rawP : parseFloat(rawP);
        setImportProgress(Number.isFinite(p) ? p : 0);
        setImportStatus(status.status);
        
        if (status.status === 'completed') {
          setImporting(false);
          setImportProgress(100);
          const result = status.result || {};
          applyImportResultToState(result);
          const extra = formatImportExtraStats(result);
          if (importMode === 'asanas') {
            const errorText = result.errors_count > 0 ? ` (${result.errors_count} ошибок)` : '';
            const base = `Успешно импортировано ${result.imported || 0} асан${errorText}`;
            setSuccess(extra ? `${base}.${extra}` : base);
          } else {
            const errorText = result.errors_count > 0 ? ` (${result.errors_count} ошибок)` : '';
            const base = `Успешно импортировано ${result.imported_asanas || 0} асан и ${result.imported_sources || 0} источников${errorText}`;
            setSuccess(extra ? `${base}.${extra}` : base);
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
          if (Date.now() - startedAt < maxWaitMs) {
            setTimeout(checkStatus, pollMs);
          } else {
            setImporting(false);
            setError('Превышено время ожидания импорта');
            setImportTaskId(null);
          }
        }
      } catch (error) {
        setImporting(false);
        setError(formatStatusPollError(error));
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
    setNamesImportErrors([]);
  };

  const handleImportNames = async () => {
    if (!selectedNamesFile) {
      setNamesError('Выберите файл для импорта');
      return;
    }

    setImportingNames(true);
    setNamesError('');
    setNamesSuccess('');
    setLastSkippedItems([]);
    setNamesImportErrors([]);

    try {
      const result = await settingsAPI.importAsanaNames(selectedNamesFile);
      const errorText = result.errors_count > 0 ? ` (${result.errors_count} ошибок)` : '';
      const skippedText = result.skipped > 0 ? `, пропущено ${result.skipped}` : '';
      setNamesSuccess(`Успешно импортировано ${result.imported} названий${skippedText}${errorText}`);
      setLastSkippedItems(Array.isArray(result.skipped_items) ? result.skipped_items : []);
      setNamesImportErrors(Array.isArray(result.errors) ? result.errors : []);
      setSelectedNamesFile(null);
      // Reset file input
      const fileInput = document.getElementById('names-import-file');
      if (fileInput) fileInput.value = '';
    } catch (error) {
      setLastSkippedItems([]);
      setNamesImportErrors([]);
      setNamesError(error.response?.data?.detail || 'Ошибка при импорте названий асан');
    } finally {
      setImportingNames(false);
    }
  };

  const handleExportNames = async () => {
    setNamesError('');
    setNamesSuccess('');
    try {
      setExportingNames(true);
      await settingsAPI.exportAsanaNames();
      setNamesSuccess('Файл с названиями скачан.');
    } catch (error) {
      setNamesError(error.response?.data?.detail || 'Ошибка при выгрузке названий');
    } finally {
      setExportingNames(false);
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
              Файл онтологии в формате OWL: отдельно загрузка с компьютера на сервер и отдельно скачивание текущей версии с сервера.
            </p>

            <div className="ontology-actions">
              <div className="ontology-action-card">
                <h3 className="ontology-action-title">Загрузить на сервер</h3>
                <p className="ontology-action-hint">
                  Выберите локальный файл .owl — он будет записан вместо текущей онтологии.
                </p>
                <div className="form-group ontology-file-row">
                  <label htmlFor="ontology-file" className="form-label">
                    Файл OWL
                  </label>
                  <input
                    type="file"
                    id="ontology-file"
                    accept=".owl"
                    onChange={handleOntologyUpload}
                    disabled={uploading}
                  />
                  {uploading && <p className="ontology-status">Загрузка…</p>}
                </div>
              </div>

              <div className="ontology-action-card ontology-action-card--download">
                <h3 className="ontology-action-title">Скачать с сервера</h3>
                <p className="ontology-action-hint">
                  Сохранить актуальную онтологию из базы в файл на ваш компьютер.
                </p>
                <button
                  type="button"
                  onClick={handleDownloadOntology}
                  className="btn-secondary ontology-download-btn"
                >
                  Скачать онтологию (.owl)
                </button>
              </div>
            </div>
            {ontologyError && <div className="error-message">{ontologyError}</div>}
            {ontologySuccess && <div className="success-message">{ontologySuccess}</div>}
          </div>
        )}

        {isExpertOrAdmin && (
          <div className="settings-section">
            <h2 className="settings-section-title">Импорт сведений об асанах</h2>
            <p className="settings-description">
              Импортируйте асаны из Excel файла. Выберите режим импорта.
            </p>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}
          {importErrorsMeta.total > 0 && (
            <div className="import-errors-box">
              <div className="import-errors-toolbar">
                <strong>
                  Не импортировано (ошибки по строкам): {importErrorsMeta.total}
                  {importErrorsMeta.truncated &&
                    ` — в списке ниже первые ${importErrors.length} из ${importErrorsMeta.total}`}
                </strong>
                <button
                  type="button"
                  className="btn-secondary import-errors-copy"
                  onClick={() => {
                    const text = importErrors.join('\n');
                    navigator.clipboard.writeText(text).catch(() => {});
                  }}
                >
                  Копировать список
                </button>
              </div>
              <p className="import-errors-hint">
                Частые причины: название не совпало со справочником (нужно 100% совпадение) — такие
                строки также попадают в «Требует модерации».
              </p>
              <ul className="import-errors-list">
                {importErrors.map((line, i) => (
                  <li key={`${i}-${line.slice(0, 48)}`}>{line}</li>
                ))}
              </ul>
            </div>
          )}

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
            <h2 className="settings-section-title">Импорт и выгрузка названий асан</h2>
            <p className="settings-description">
              Импорт и экспорт используют один формат Excel: колонки «название» (обязательно),
              «санскрит», «транслитерация», «определение». При импорте уже существующие названия
              пропускаются. Выгрузка формирует файл из текущей базы (онтологии).
            </p>

            <div className="form-group">
              <button
                type="button"
                onClick={handleExportNames}
                className="btn-secondary"
                disabled={exportingNames}
                style={{ width: '100%' }}
              >
                {exportingNames ? 'Выгрузка…' : 'Скачать названия из базы (Excel)'}
              </button>
            </div>

            {namesError && <div className="error-message">{namesError}</div>}
            {namesSuccess && <div className="success-message">{namesSuccess}</div>}
            {namesImportErrors.length > 0 && (
              <div className="import-errors-box">
                <div className="import-errors-toolbar">
                  <strong>Ошибки при импорте названий ({namesImportErrors.length})</strong>
                  <button
                    type="button"
                    className="btn-secondary import-errors-copy"
                    onClick={() => {
                      navigator.clipboard.writeText(namesImportErrors.join('\n')).catch(() => {});
                    }}
                  >
                    Копировать список
                  </button>
                </div>
                <ul className="import-errors-list">
                  {namesImportErrors.map((line, i) => (
                    <li key={`ne-${i}-${line.slice(0, 48)}`}>{line}</li>
                  ))}
                </ul>
              </div>
            )}
            {lastSkippedItems.length > 0 && (
              <div className="names-skipped-box">
                <strong>Пропущенные строки (название уже было в базе):</strong>
                <ul className="names-skipped-list">
                  {lastSkippedItems.map((item, i) => (
                    <li key={`${item.row}-${item.name}-${i}`}>
                      <span className="names-skipped-row">Строка {item.row}</span>
                      {' — '}
                      {item.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}

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
