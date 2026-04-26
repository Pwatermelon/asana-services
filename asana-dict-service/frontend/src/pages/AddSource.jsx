import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { sourcesAPI } from '../api/sources';
import '../styles/AddSource.css';

const AddSource = () => {
  const { id: editId } = useParams();
  const isEdit = Boolean(editId);
  const [formData, setFormData] = useState(emptyForm);
  const [sourceUri, setSourceUri] = useState(null);
  const [bootLoading, setBootLoading] = useState(isEdit);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isEdit) {
      setBootLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const s = await sourcesAPI.getById(editId);
        if (cancelled) return;
        if (!s) {
          setError('Источник не найден');
          setBootLoading(false);
          return;
        }
        setSourceUri(s.id);
        setFormData({
          title: s.title || '',
          author: s.author || '',
          year: s.year != null && s.year !== '' ? String(s.year) : '',
          publisher: s.publisher || '',
          pages: s.pages != null && s.pages !== '' ? String(s.pages) : '',
          annotation: s.annotation || '',
        });
      } catch (e) {
        if (!cancelled) {
          setError(e.response?.data?.detail || 'Не удалось загрузить источник');
        }
      } finally {
        if (!cancelled) setBootLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEdit, editId]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const sourceData = {
      title: formData.title,
      author: formData.author,
      year: parseInt(formData.year, 10),
      publisher: formData.publisher?.trim() || null,
      pages: formData.pages ? parseInt(formData.pages, 10) : null,
      annotation: formData.annotation?.trim() || null,
    };

    try {
      if (isEdit) {
        await sourcesAPI.update(sourceUri || editId, sourceData);
      } else {
        await sourcesAPI.add(sourceData);
      }
      setSuccess(true);
      setTimeout(() => {
        navigate('/sources');
      }, 1200);
    } catch (err) {
      setError(err.response?.data?.detail || (isEdit ? 'Ошибка при сохранении' : 'Ошибка при добавлении'));
    } finally {
      setLoading(false);
    }
  };

  if (bootLoading) {
    return (
      <div className="container">
        <div className="form-container">Загрузка…</div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="container">
        <div className="form-container">
          <div className="success-message">
            {isEdit ? 'Источник сохранён.' : 'Источник добавлен.'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">{isEdit ? 'Изменение источника' : 'Новый источник'}</h1>
      </div>

      <div className="form-container">
        <form onSubmit={handleSubmit}>
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="title" className="form-label">
              Название *
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className="form-control"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="author" className="form-label">
              Автор *
            </label>
            <input
              type="text"
              id="author"
              name="author"
              value={formData.author}
              onChange={handleChange}
              className="form-control"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="year" className="form-label">
                Год *
              </label>
              <input
                type="number"
                id="year"
                name="year"
                value={formData.year}
                onChange={handleChange}
                className="form-control"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="publisher" className="form-label">
                Издательство
              </label>
              <input
                type="text"
                id="publisher"
                name="publisher"
                value={formData.publisher}
                onChange={handleChange}
                className="form-control"
              />
            </div>
            <div className="form-group">
              <label htmlFor="pages" className="form-label">
                Страниц
              </label>
              <input
                type="number"
                id="pages"
                name="pages"
                value={formData.pages}
                onChange={handleChange}
                className="form-control"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="annotation" className="form-label">
              Аннотация
            </label>
            <textarea
              id="annotation"
              name="annotation"
              value={formData.annotation}
              onChange={handleChange}
              className="form-control"
              rows="4"
            />
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Сохранение…' : isEdit ? 'Сохранить' : 'Добавить источник'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate('/sources')}
              disabled={loading}
            >
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddSource;
