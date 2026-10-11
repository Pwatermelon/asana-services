import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/client';
import '../styles/OntologyMerge.css';

const OntologyMerge = () => {
  const [baseFile, setBaseFile] = useState(null);
  const [incomingFile, setIncomingFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);
  const [tab, setTab] = useState('added');
  const [filter, setFilter] = useState('');

  const runPreview = async (e) => {
    e.preventDefault();
    setError('');
    setReport(null);
    if (!baseFile || !incomingFile) {
      setError('Выберите оба файла OWL/TTL');
      return;
    }
    setLoading(true);
    try {
      const form = new FormData();
      form.append('base', baseFile);
      form.append('incoming', incomingFile);
      const { data } = await apiClient.post('/api/admin/ontology-merge/preview', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setReport(data);
      setTab('added');
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Ошибка сравнения');
    } finally {
      setLoading(false);
    }
  };

  const filteredRows = useMemo(() => {
    if (!report) return [];
    const q = filter.trim().toLowerCase();
    let rows = [];
    if (tab === 'added') rows = report.added || [];
    else if (tab === 'removed') rows = report.removed || [];
    else if (tab === 'conflicts') {
      return (report.label_conflicts || []).filter((c) => {
        if (!q) return true;
        return `${c.iri} ${c.base_label} ${c.incoming_label}`.toLowerCase().includes(q);
      });
    } else rows = report.common_sample || [];
    if (!q) return rows;
    return rows.filter((r) => `${r.label} ${r.iri}`.toLowerCase().includes(q));
  }, [report, tab, filter]);

  return (
    <div className="container ontology-merge-page">
      <p className="ontology-merge-crumb">
        <Link to="/admin">Админ</Link> / Merge онтологий
      </p>
      <h1>Предпросмотр слияния онтологий</h1>
      <p className="ontology-merge-lead">
        Две онтологии с близкой схемой — сервис покажет, что добавится, что пропадёт и где конфликт
        меток. В каталог ничего не пишется.
      </p>

      <form className="ontology-merge-form" onSubmit={runPreview}>
        <FileDrop
          title="Базовая онтология"
          hint="Текущая / эталонная OWL"
          file={baseFile}
          onFile={setBaseFile}
        />
        <FileDrop
          title="Онтология-кандидат"
          hint="Файл для сравнения / merge"
          file={incomingFile}
          onFile={setIncomingFile}
        />
        <button type="submit" className="ontology-merge-submit" disabled={loading}>
          {loading ? 'Сравнение…' : 'Сравнить онтологии'}
        </button>
      </form>

      {error && <div className="ontology-merge-error">{error}</div>}

      {report && (
        <div className="ontology-merge-report">
          <div className="ontology-merge-summary">
            <SummaryCard label="Добавятся" value={report.summary?.added ?? 0} tone="add" />
            <SummaryCard label="Удалятся*" value={report.summary?.removed ?? 0} tone="remove" />
            <SummaryCard label="Общие" value={report.summary?.common ?? 0} tone="common" />
            <SummaryCard
              label="Конфликт меток"
              value={report.summary?.label_conflicts ?? 0}
              tone="warn"
            />
          </div>
          <p className="ontology-merge-note">
            * при полной замене base. Эвристика структуры:{' '}
            <strong>
              {report.structure_compatible_heuristic ? 'похоже совместимы' : 'возможны расхождения'}
            </strong>
            . Файлы: {report.base?.filename} ↔ {report.incoming?.filename}
          </p>

          <div className="ontology-merge-toolbar">
            <div className="ontology-merge-tabs" role="tablist">
              {[
                ['added', `Добавятся (${report.summary?.added ?? 0})`],
                ['removed', `Удалятся (${report.summary?.removed ?? 0})`],
                ['conflicts', `Конфликты (${report.summary?.label_conflicts ?? 0})`],
                ['common', `Общие (sample)`],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  className={tab === id ? 'is-active' : ''}
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              type="search"
              className="ontology-merge-filter"
              placeholder="Фильтр по метке или IRI…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>

          {tab === 'conflicts' ? (
            <ConflictsTable rows={filteredRows} />
          ) : (
            <EntityTable rows={filteredRows} tone={tab === 'removed' ? 'remove' : tab === 'added' ? 'add' : 'common'} />
          )}
        </div>
      )}
    </div>
  );
};

function FileDrop({ title, hint, file, onFile }) {
  const [over, setOver] = useState(false);
  return (
    <label
      className={`ontology-merge-drop ${over ? 'is-over' : ''} ${file ? 'has-file' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
    >
      <span className="ontology-merge-drop__title">{title}</span>
      <span className="ontology-merge-drop__hint">{file ? file.name : hint}</span>
      <span className="ontology-merge-drop__action">{file ? 'Заменить файл' : 'Выбрать или перетащить'}</span>
      <input
        type="file"
        accept=".owl,.rdf,.ttl,.xml,.n3,.nt"
        hidden
        onChange={(e) => onFile(e.target.files?.[0] || null)}
      />
    </label>
  );
}

function SummaryCard({ label, value, tone }) {
  return (
    <div className={`ontology-merge-card ontology-merge-card--${tone}`}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function EntityTable({ rows, tone }) {
  if (!rows?.length) {
    return <p className="ontology-merge-empty">Нет записей по текущему фильтру</p>;
  }
  return (
    <div className={`ontology-merge-table-wrap ontology-merge-table-wrap--${tone}`}>
      <table>
        <thead>
          <tr>
            <th>Метка</th>
            <th>IRI</th>
            <th>Типы</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.iri}>
              <td>{r.label}</td>
              <td>
                <code>{r.iri}</code>
              </td>
              <td>{(r.types || []).slice(0, 3).map((t) => t.split(/[#/]/).pop()).join(', ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConflictsTable({ rows }) {
  if (!rows?.length) {
    return <p className="ontology-merge-empty">Нет конфликтов по текущему фильтру</p>;
  }
  return (
    <div className="ontology-merge-table-wrap ontology-merge-table-wrap--warn">
      <table>
        <thead>
          <tr>
            <th>IRI</th>
            <th>Base</th>
            <th>Incoming</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.iri}>
              <td>
                <code>{c.iri}</code>
              </td>
              <td>{c.base_label}</td>
              <td>{c.incoming_label}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default OntologyMerge;
