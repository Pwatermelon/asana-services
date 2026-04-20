import React, { useState, useEffect, useCallback } from 'react';
import { contentAPI } from '../../api/content';
import '../../styles/Users.css';

const emptyForm = {
  name_ru: '',
  name_sanskrit: '',
  transliteration: '',
  definition: '',
};

const AsanaNamesAdmin = () => {
  const [names, setNames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadNames = useCallback(async () => {
    try {
      setLoading(true);
      const data = await contentAPI.getNames();
      setNames(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось загрузить названия');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNames();
  }, [loadNames]);

  const openCreate = () => {
    setCreating(true);
    setEditing(null);
    setForm(emptyForm);
  };

  const openEdit = (row) => {
    setEditing(row);
    setCreating(false);
    setForm({
      name_ru: row.name_ru || '',
      name_sanskrit: row.name_sanskrit || '',
      transliteration: row.transliteration || '',
      definition: row.definition || '',
    });
  };

  const closeDialog = () => {
    setEditing(null);
    setCreating(false);
    setForm(emptyForm);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name_ru.trim()) return;
    try {
      setSaving(true);
      setError(null);
      await contentAPI.createAsanaName({
        name_ru: form.name_ru.trim(),
        name_sanskrit: form.name_sanskrit?.trim() || null,
        transliteration: form.transliteration?.trim() || null,
        definition: form.definition?.trim() || null,
      });
      closeDialog();
      loadNames();
    } catch (err) {
      setError(err.response?.data?.detail || 'Ошибка при добавлении');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!editing) return;
    try {
      setSaving(true);
      setError(null);
      await contentAPI.updateAsanaName(editing.id, {
        name_ru: form.name_ru.trim(),
        name_sanskrit: form.name_sanskrit?.trim() || null,
        transliteration: form.transliteration?.trim() || null,
        definition: form.definition?.trim() || null,
      });
      closeDialog();
      loadNames();
    } catch (err) {
      setError(err.response?.data?.detail || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    if (
      !window.confirm(
        `Удалить название «${row.name_ru}»? Если оно привязано к асанам, удаление будет отклонено.`
      )
    ) {
      return;
    }
    try {
      setError(null);
      await contentAPI.deleteAsanaName(row.id);
      loadNames();
    } catch (err) {
      setError(err.response?.data?.detail || 'Ошибка удаления');
    }
  };

  if (loading) {
    return <div className="loading">Загрузка названий...</div>;
  }

  const dialogOpen = creating || editing;

  return (
    <div className="users-page admin-nested">
      <div className="users-header users-header--with-action">
        <span className="admin-toolbar-meta">Всего записей: {names.length}</span>
        <button type="button" className="btn-primary" onClick={openCreate}>
          Добавить название
        </button>
      </div>
      <p className="admin-hint">
        Добавление, изменение и удаление доступны эксперту и администратору. Массовый импорт и
        выгрузка в Excel — в разделе «Настройки». Удаление невозможно, пока название используется в
        асанах.
      </p>

      {error && (
        <div className="error-message admin-error-dismissible">
          {error}
          <button type="button" className="btn-dismiss-error" onClick={() => setError(null)}>
            ×
          </button>
        </div>
      )}

      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>Название (рус.)</th>
              <th>Санскрит</th>
              <th>Транслитерация</th>
              <th>Определение</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {names.map((row) => (
              <tr key={row.id}>
                <td>{row.name_ru}</td>
                <td>{row.name_sanskrit || '—'}</td>
                <td>{row.transliteration || '—'}</td>
                <td
                  className="cell-clamp"
                  title={row.definition && row.definition.length > 80 ? row.definition : undefined}
                >
                  {row.definition
                    ? `${row.definition.slice(0, 80)}${row.definition.length > 80 ? '…' : ''}`
                    : '—'}
                </td>
                <td>
                  <div className="table-action-group">
                    <button type="button" className="btn-edit" onClick={() => openEdit(row)}>
                      Изменить
                    </button>
                    <button type="button" className="btn-delete" onClick={() => handleDelete(row)}>
                      Удалить
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dialogOpen && (
        <div className="modal-overlay" onClick={closeDialog}>
          <div className="modal-content modal-wide" onClick={(e) => e.stopPropagation()}>
            <h2>{creating ? 'Добавить название' : 'Изменить название'}</h2>
            <form onSubmit={creating ? handleCreate : handleSave}>
              <div className="form-group">
                <label>Название (рус.) *</label>
                <input
                  type="text"
                  value={form.name_ru}
                  onChange={(e) => setForm({ ...form, name_ru: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Санскрит</label>
                <input
                  type="text"
                  value={form.name_sanskrit}
                  onChange={(e) => setForm({ ...form, name_sanskrit: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Транслитерация</label>
                <input
                  type="text"
                  value={form.transliteration}
                  onChange={(e) => setForm({ ...form, transliteration: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Определение</label>
                <textarea
                  rows={4}
                  value={form.definition}
                  onChange={(e) => setForm({ ...form, definition: e.target.value })}
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Сохранение…' : creating ? 'Добавить' : 'Сохранить'}
                </button>
                <button type="button" className="btn-secondary" onClick={closeDialog} disabled={saving}>
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AsanaNamesAdmin;
