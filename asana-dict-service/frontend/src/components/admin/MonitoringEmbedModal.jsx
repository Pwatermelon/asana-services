import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  GRAFANA_DASHBOARD_TABS,
  KIBANA_LOG_TABS,
  bootstrapMonitoringCookie,
  grafanaDashboardEmbedUrl,
} from '../../utils/monitoringEmbed';
import '../../styles/MonitoringEmbedModal.css';

export default function MonitoringEmbedModal({ open, onClose, kind }) {
  const tabs = kind === 'grafana' ? GRAFANA_DASHBOARD_TABS : KIBANA_LOG_TABS;
  const [activeTabId, setActiveTabId] = useState(tabs[0]?.id || '');
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState('');

  const title = kind === 'grafana' ? 'Grafana — мониторинг' : 'Kibana — логи';

  useEffect(() => {
    if (!open) {
      setSessionReady(false);
      setSessionError('');
      return undefined;
    }
    setActiveTabId(tabs[0]?.id || '');
    let cancelled = false;
    (async () => {
      const token = window.localStorage.getItem('access_token');
      const result = await bootstrapMonitoringCookie(token);
      if (cancelled) return;
      setSessionReady(result.ok);
      setSessionError(result.ok ? '' : result.message);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, kind]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  const iframeSrc = useMemo(() => {
    if (!sessionReady) return '';
    const tab = tabs.find((t) => t.id === activeTabId) || tabs[0];
    if (!tab) return '';
    if (kind === 'grafana') {
      return grafanaDashboardEmbedUrl(tab.uid, tab.slug);
    }
    return tab.path;
  }, [sessionReady, tabs, activeTabId, kind]);

  if (!open) return null;

  const overlay = (
    <div
      className="monitoring-embed-overlay"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="monitoring-embed-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="monitoring-embed-header">
          <h2 className="monitoring-embed-title">{title}</h2>
          <button
            type="button"
            className="monitoring-embed-close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            ×
          </button>
        </header>

        <div className="monitoring-embed-tabs" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={tab.id === activeTabId}
              className={
                tab.id === activeTabId
                  ? 'monitoring-embed-tab monitoring-embed-tab--active'
                  : 'monitoring-embed-tab'
              }
              onClick={() => setActiveTabId(tab.id)}
            >
              {tab.title}
            </button>
          ))}
        </div>

        <div className="monitoring-embed-body">
          {sessionError && (
            <p className="monitoring-embed-error">{sessionError}</p>
          )}
          {!sessionError && !sessionReady && (
            <p className="monitoring-embed-loading">Подключение к мониторингу…</p>
          )}
          {sessionReady && iframeSrc && (
            <iframe
              key={`${kind}-${activeTabId}`}
              title={`${title}: ${activeTabId}`}
              className="monitoring-embed-frame"
              src={iframeSrc}
              loading="lazy"
            />
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(overlay, document.body)
    : overlay;
}
