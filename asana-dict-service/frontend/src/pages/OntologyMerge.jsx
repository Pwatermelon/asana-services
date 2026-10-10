import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/client';
import '../styles/OntologyMerge.css';

const OntologyMerge = () => {
  const [baseFile, setBaseFile] = useState(null);
  const [incomingFile, setIncomingFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);

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
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Ошибка сравнения');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container ontology-merge-page">
      <p className="ontology-merge-crumb">
        <Link to="/admin">Админ</Link> / Merge онтологий
      </p>
      <h1>Предпросмотр слияния онтологий</h1>
      <p className="ontology-merge-lead">
        Загрузите две онтологии с совместимой схемой (TBox), но разными сущностями. Сервис покажет,
        что добавится, что исчезнет и где конфликт меток. В каталог асан ничего не пишется — это
        инструмент для НИР.
      </p>

      <form className="ontology-merge-form" onSubmit={runPreview}>
        <label>
          <span>Базовая онтология</span>
          <input
            type="file"
            accept=".owl,.rdf,.ttl,.xml,.n3,.nt"
            onChange={(e) => setBaseFile(e.target.files?.[0] || null)}
          />
        </label>
        <label>
          <span>Онтология-кандидат</span>
          <input
            type="file"
            accept=".owl,.rdf,.ttl,.xml,.n3,.nt"
            onChange={(e) => setIncomingFile(e.target.files?.[0] || null)}
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? 'Сравнение…' : 'Сравнить'}
        </button>
      </form>

      {error && <div className="ontology-merge-error">{error}</div>}

      {report && (
        <div className="ontology-merge-report">
          <div className="ontology-merge-summary">
            <div>
              <strong>Добавятся</strong>
              <b>{report.summary?.added ?? 0}</b>
            </div>
            <div>
              <strong>Удалятся*</strong>
              <b>{report.summary?.removed ?? 0}</b>
            </div>
            <div>
              <strong>Общие</strong>
              <b>{report.summary?.common ?? 0}</b>
            </div>
            <div>
              <strong>Конфликт меток</strong>
              <b>{report.summary?.label_conflicts ?? 0}</b>
            </div>
          </div>
          <p className="ontology-merge-note">
            * «Удалятся» — при полной замене base на incoming. При union-merge обычно сохраняются.
            Эвристика совместимости структуры:{' '}
            {report.structure_compatible_heuristic ? 'похоже совместимы' : 'возможны расхождения TBox'}.
          </p>

          <EntityTable title="Добавляемые сущности" rows={report.added} tone="add" />
          <EntityTable title="Отсутствующие в кандидате" rows={report.removed} tone="remove" />
          {report.label_conflicts?.length > 0 && (
            <section className="ontology-merge-block">
              <h2>Конфликты меток</h2>
              <ul>
                {report.label_conflicts.map((c) => (
                  <li key={c.iri}>
                    <code>{c.iri}</code>
                    <br />
                    base: {c.base_label} → incoming: {c.incoming_label}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
};

function EntityTable({ title, rows, tone }) {
  if (!rows?.length) {
    return (
      <section className="ontology-merge-block">
        <h2>{title}</h2>
        <p className="ontology-merge-empty">Нет записей</p>
      </section>
    );
  }
  return (
    <section className={`ontology-merge-block ontology-merge-block--${tone}`}>
      <h2>
        {title} <span>({rows.length}{rows.length >= 200 ? '+' : ''})</span>
      </h2>
      <div className="ontology-merge-table-wrap">
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
    </section>
  );
}

export default OntologyMerge;
