import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sourcesAPI } from '../api/sources';
import '../styles/AddSource.css';

const AddSource = () => {
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    year: '',
    publisher: '',
    pages: '',
    annotation: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

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

    try {
      const sourceData = {
        title: formData.title,
        author: formData.author,
        year: parseInt(formData.year),
        publisher: formData.publisher || null,
        pages: formData.pages ? parseInt(formData.pages) : null,
        annotation: formData.annotation || null,
      };
      await sourcesAPI.add(sourceData);
      setSuccess(true);
      setTimeout(() => {
        navigate('/sources');
      }, 2000);
    } catch (error) {
      setError(error.response?.data?.detail || 'Ошибка при добавлении источника');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="container">
        <div className="form-container">
          <div className="success-message">Источник успешно добавлен!</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">Добавление нового источника</h1>
        <p className="page-description">
          Заполните форму для добавления источника в каталог
        </p>
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
              {loading ? 'Добавление...' : 'Добавить источник'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddSource;

