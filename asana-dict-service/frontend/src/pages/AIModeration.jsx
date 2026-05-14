import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { aiAPI } from '../api/ai';
import '../styles/AIModeration.css';

const REASON_LABELS = {
  phash_exact: 'Одинаковое фото (с точностью до поворота)',
  yoga_class: 'Совпадение позы по классификатору YOLO',
};

const formatDate = (s) => {
  if (!s) return '';
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    return d.toLocaleString('ru-RU');
  } catch {
    return s;
  }
};

const shortAsanaId = (uri) => {
  if (!uri) return '';
  const id = uri.includes('#') ? uri.split('#').pop() : uri;
  return id?.replace(/^asana_/, '') || '';
};

const formatSource = (source) => {
  if (!source) return '';
  const parts = [];
  if (source.title) parts.push(`«${source.title}»`);
  if (source.author) parts.push(source.author);
  if (source.year) parts.push(String(source.year));
  return parts.join(', ');
};

const AsanaCard = ({ asana, photoUrl, source, otherSideAlt }) => {
  const link = asana?.id ? `/asana/${shortAsanaId(asana.id)}` : null;
  const nameRu = asana?.name_ru || 'Без названия';
  const nameSk = asana?.name_sanskrit;
  const fallback = !photoUrl;
  const sourceLabel = formatSource(source);
  return (
    <div className="ai-card">
      <div className={`ai-card-photo ${fallback ? 'ai-card-photo--empty' : ''}`}>
        {photoUrl ? (
          <img src={photoUrl} alt={nameRu || otherSideAlt} loading="lazy" />
        ) : (
          <span>Нет фото</span>
        )}
      </div>
      <div className="ai-card-meta">
        <div className="ai-card-name">
          {link ? (
            <Link to={link} target="_blank" rel="noreferrer">
              {nameRu}
            </Link>
          ) : (
            nameRu
          )}
        </div>
        {nameSk && <div className="ai-card-sanskrit">{nameSk}</div>}
        {sourceLabel ? (
          <div className="ai-card-source" title={sourceLabel}>
            <span className="ai-card-source-label">Источник:</span> {sourceLabel}
          </div>
        ) : (
          <div className="ai-card-source ai-card-source--missing">
            Источник не указан
          </div>
        )}
      </div>
    </div>
  );
};

const AIModeration = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resolvedFilter, setResolvedFilter] = useState(false);
  const [reasonFilter, setReasonFilter] = useState('all');
  const [sortBy, setSortBy] = useState('score');
  const [sortDir, setSortDir] = useState('desc');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [actionPending, setActionPending] = useState({});
  const [clearing, setClearing] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await aiAPI.getProposals({
        resolved: resolvedFilter,
        sort: sortBy,
        sortDir,
        limit: 500,
      });
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('AI proposals load error:', e);
      setError(e?.response?.data?.detail || 'Не удалось загрузить предложения');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [resolvedFilter, sortBy, sortDir]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const filteredItems = useMemo(() => {
    if (reasonFilter === 'all') return items;
    return items.filter((i) => i.reason === reasonFilter);
  }, [items, reasonFilter]);

  const handleScan = async () => {
    if (scanning) return;
    setScanning(true);
    setScanResult(null);
    setError('');
    try {
      const res = await aiAPI.startScan();
      setScanResult(res?.stats || null);
      await loadItems();
      window.dispatchEvent(new CustomEvent('ai-moderation-updated'));
    } catch (e) {
      console.error('AI scan error:', e);
      setError(e?.response?.data?.detail || 'Ошибка запуска сканирования');
    } finally {
      setScanning(false);
    }
  };

  const handleConfirm = async (id) => {
    if (actionPending[id]) return;
    setActionPending((p) => ({ ...p, [id]: 'confirming' }));
    try {
      await aiAPI.confirm(id);
      setItems((cur) => cur.filter((x) => x.id !== id));
      window.dispatchEvent(new CustomEvent('ai-moderation-updated'));
    } catch (e) {
      console.error('AI confirm error:', e);
      alert(e?.response?.data?.detail || 'Не удалось подтвердить связь');
    } finally {
      setActionPending((p) => {
        const next = { ...p };
        delete next[id];
        return next;
      });
    }
  };

  const handleReject = async (id) => {
    if (actionPending[id]) return;
    setActionPending((p) => ({ ...p, [id]: 'rejecting' }));
    try {
      await aiAPI.reject(id);
      setItems((cur) => cur.filter((x) => x.id !== id));
      window.dispatchEvent(new CustomEvent('ai-moderation-updated'));
    } catch (e) {
      console.error('AI reject error:', e);
      alert(e?.response?.data?.detail || 'Не удалось отклонить предложение');
    } finally {
      setActionPending((p) => {
        const next = { ...p };
        delete next[id];
        return next;
      });
    }
  };

  const handleConfirmClearModeration = async () => {
    if (clearing) return;
    setClearing(true);
    try {
      await aiAPI.clear(false);
      setShowClearModal(false);
      await loadItems();
      window.dispatchEvent(new CustomEvent('ai-moderation-updated'));
    } catch (e) {
      console.error('AI clear error:', e);
      alert(e?.response?.data?.detail || 'Не удалось очистить модерацию');
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="container">
      <div className="ai-mod-container">
        <h1 className="ai-mod-title">ИИ — модерация связей</h1>
        <p className="ai-mod-lead">
          ИИ ищет в каталоге одинаковые фото и одинаковые позы у асан из разных источников и
          предлагает связать их через <code>isSameAs</code>. Подтвердите или отклоните
          каждую пару.
        </p>

        <div className="ai-mod-toolbar">
          <div className="ai-mod-toolbar-group">
            <label className="ai-mod-checkbox">
              <input
                type="checkbox"
                checked={resolvedFilter}
                onChange={(e) => setResolvedFilter(e.target.checked)}
              />
              Показать решённые
            </label>
            <label className="ai-mod-field">
              <span>Тип совпадения:</span>
              <select
                value={reasonFilter}
                onChange={(e) => setReasonFilter(e.target.value)}
                className="ai-mod-select"
              >
                <option value="all">Любой</option>
                <option value="phash_exact">Одинаковое фото</option>
                <option value="yoga_class">Та же поза (YOLO)</option>
              </select>
            </label>
            <div className="ai-mod-field">
              <span>Сортировка:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="ai-mod-select"
                aria-label="Поле сортировки"
              >
                <option value="score">По score</option>
                <option value="created_at">По дате добавления</option>
              </select>
              <select
                value={sortDir}
                onChange={(e) => setSortDir(e.target.value)}
                className="ai-mod-select"
                aria-label="Направление сортировки"
              >
                <option value="desc">
                  {sortBy === 'score' ? 'Сначала лучшие' : 'Сначала новые'}
                </option>
                <option value="asc">
                  {sortBy === 'score' ? 'Сначала худшие' : 'Сначала старые'}
                </option>
              </select>
            </div>
          </div>
          <div className="ai-mod-toolbar-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowClearModal(true)}
              disabled={clearing || scanning}
            >
              Очистить модерацию
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleScan}
              disabled={scanning}
            >
              {scanning ? 'Сканирование…' : 'Запустить сканирование'}
            </button>
          </div>
        </div>

        {showClearModal && (
          <div
            className="modal-overlay moderation-clear-overlay"
            role="presentation"
            onClick={() => !clearing && setShowClearModal(false)}
          >
            <div
              className="modal-content moderation-clear-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="ai-moderation-clear-title"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="ai-moderation-clear-title">Очистить модерацию?</h2>
              <p className="moderation-clear-warning">
                Будут <strong>безвозвратно удалены все предложения ИИ</strong>: и ожидающие,
                и уже подтверждённые/отклонённые. Существующие связи <code>isSameAs</code>
                {' '}останутся на месте — удаляется только история модерации. Отменить это
                действие будет невозможно.
              </p>
              <div className="form-actions moderation-clear-actions">
                <button
                  type="button"
                  className="btn-delete"
                  onClick={handleConfirmClearModeration}
                  disabled={clearing}
                >
                  {clearing ? 'Удаление…' : 'Да, удалить всё'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowClearModal(false)}
                  disabled={clearing}
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        )}

        {scanResult && (
          <div className="ai-mod-scan-result">
            <strong>Сканирование завершено.</strong>{' '}
            Найдено фото: {scanResult.photos_total ?? '—'}, обработано:{' '}
            {scanResult.photos_processed ?? '—'}, сбоев загрузки:{' '}
            {scanResult.photos_failed ?? 0}. Предложений от нейросети:{' '}
            {scanResult.proposals_returned ?? 0}, добавлено в очередь модерации:{' '}
            <strong>{scanResult.proposals_inserted ?? 0}</strong>. Пропущено уже
            существующих связей: {scanResult.skipped_existing_link ?? 0}, дубликатов
            предложений: {scanResult.skipped_duplicate ?? 0}.
          </div>
        )}

        {error && <div className="ai-mod-error">{error}</div>}

        {loading ? (
          <div className="ai-mod-empty">Загрузка…</div>
        ) : filteredItems.length === 0 ? (
          <div className="ai-mod-empty">
            {resolvedFilter
              ? 'Решённых предложений нет.'
              : 'Очередь модерации пуста. Запустите сканирование, чтобы ИИ нашёл новые связи.'}
          </div>
        ) : (
          <ul className="ai-mod-list">
            {filteredItems.map((item) => {
              const busy = actionPending[item.id];
              return (
                <li key={item.id} className={`ai-mod-item ai-mod-item--${item.status}`}>
                  <div className="ai-mod-item-header">
                    <span className={`ai-mod-badge ai-mod-badge--${item.reason}`}>
                      {REASON_LABELS[item.reason] || item.reason}
                    </span>
                    <span className="ai-mod-score">
                      score: <strong>{(item.score ?? 0).toFixed(2)}</strong>
                    </span>
                    <span className="ai-mod-date">{formatDate(item.created_at)}</span>
                  </div>

                  <div className="ai-mod-pair">
                    <AsanaCard
                      asana={item.asana_a}
                      photoUrl={item.photo_a_url}
                      source={item.source_a}
                      otherSideAlt="A"
                    />
                    <div className="ai-mod-arrow" aria-hidden>
                      ↔
                    </div>
                    <AsanaCard
                      asana={item.asana_b}
                      photoUrl={item.photo_b_url}
                      source={item.source_b}
                      otherSideAlt="B"
                    />
                  </div>

                  {item.detail && (
                    <div className="ai-mod-detail">
                      <code>{item.detail}</code>
                    </div>
                  )}

                  {item.status === 'pending' ? (
                    <div className="ai-mod-actions">
                      <button
                        type="button"
                        className="btn-success ai-mod-btn"
                        onClick={() => handleConfirm(item.id)}
                        disabled={!!busy}
                      >
                        {busy === 'confirming' ? 'Подтверждение…' : 'Подтвердить'}
                      </button>
                      <button
                        type="button"
                        className="btn-delete ai-mod-btn"
                        onClick={() => handleReject(item.id)}
                        disabled={!!busy}
                      >
                        {busy === 'rejecting' ? 'Отклонение…' : 'Отклонить'}
                      </button>
                    </div>
                  ) : (
                    <div className="ai-mod-actions ai-mod-actions--resolved">
                      <span>
                        {item.status === 'confirmed' ? 'Связь установлена' : 'Отклонено'}{' '}
                        {item.reviewed_by ? `пользователем ${item.reviewed_by}` : ''}{' '}
                        {item.reviewed_at ? `(${formatDate(item.reviewed_at)})` : ''}
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AIModeration;
