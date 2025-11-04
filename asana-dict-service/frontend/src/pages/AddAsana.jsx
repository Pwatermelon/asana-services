import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { asanasAPI } from '../api/asanas';
import { sourcesAPI } from '../api/sources';
import { contentAPI } from '../api/content';
import '../styles/AddAsana.css';

const AddAsana = () => {
  const [nameOption, setNameOption] = useState('existing');
  const [selectedName, setSelectedName] = useState('');
  const [newName, setNewName] = useState({
    name_ru: '',
    name_sanskrit: '',
    transliteration: '',
    definition: '',
  });
  const [sourceOption, setSourceOption] = useState('existing');
  const [selectedSource, setSelectedSource] = useState('');
  const [newSource, setNewSource] = useState({
    title: '',
    author: '',
    year: '',
    publisher: '',
    pages: '',
    annotation: '',
  });
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [names, setNames] = useState([]);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [namesData, sourcesData] = await Promise.all([
        contentAPI.getNames(),
        sourcesAPI.getAll(),
      ]);
      setNames(namesData);
      setSources(sourcesData);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const formData = new FormData();
      
      formData.append('selected_name', nameOption === 'existing' ? selectedName : '');
      formData.append('selected_source', sourceOption === 'existing' ? selectedSource : '');
      
      if (nameOption === 'new') {
        formData.append('new_name_ru', newName.name_ru);
        if (newName.name_sanskrit) formData.append('new_name_sanskrit', newName.name_sanskrit);
        if (newName.transliteration) formData.append('transliteration', newName.transliteration);
        if (newName.definition) formData.append('definition', newName.definition);
      }

      if (sourceOption === 'new') {
        formData.append('new_source_title', newSource.title);
        formData.append('new_source_author', newSource.author);
        if (newSource.year) formData.append('new_source_year', newSource.year);
        if (newSource.publisher) formData.append('new_source_publisher', newSource.publisher);
        if (newSource.pages) formData.append('new_source_pages', newSource.pages);
        if (newSource.annotation) formData.append('new_source_annotation', newSource.annotation);
      }

      if (photo) {
        formData.append('photo', photo);
      }

      await asanasAPI.add(formData);
      setSuccess(true);
      setTimeout(() => {
        navigate('/asanas');
      }, 2000);
    } catch (error) {
      setError(error.response?.data?.detail || 'Ошибка при добавлении асаны');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="container">
        <div className="form-container">
          <div className="success-message">Асана успешно добавлена!</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">Добавление новой асаны</h1>
        <p className="page-description">
          Заполните форму для добавления асаны в каталог
        </p>
      </div>

      <div className="form-container">
        <form onSubmit={handleSubmit} encType="multipart/form-data">
          {error && <div className="error-message">{error}</div>}

          <div className="form-section">
            <h2 className="form-section-title">Название асаны</h2>
            <div className="radio-group">
              <div className="radio-option">
                <input
                  type="radio"
                  id="existing-name"
                  name="name-option"
                  value="existing"
                  checked={nameOption === 'existing'}
                  onChange={(e) => setNameOption(e.target.value)}
                />
                <label htmlFor="existing-name">Выбрать существующее название</label>
              </div>
              <div className="radio-option">
                <input
                  type="radio"
                  id="new-name"
                  name="name-option"
                  value="new"
                  checked={nameOption === 'new'}
                  onChange={(e) => setNameOption(e.target.value)}
                />
                <label htmlFor="new-name">Добавить новое название</label>
              </div>
            </div>

            {nameOption === 'existing' ? (
              <div className="form-group">
                <label htmlFor="selected_name" className="form-label">
                  Выберите название:
                </label>
                <select
                  id="selected_name"
                  value={selectedName}
                  onChange={(e) => setSelectedName(e.target.value)}
                  className="form-select"
                  required
                >
                  <option value="">-- Выберите название --</option>
                  {names.map((name) => (
                    <option key={name.id} value={name.id}>
                      {name.name_ru}
                      {name.name_sanskrit && ` (${name.name_sanskrit})`}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <>
                <div className="form-group">
                  <label htmlFor="new_name_ru" className="form-label">
                    Название на русском *
                  </label>
                  <input
                    type="text"
                    id="new_name_ru"
                    value={newName.name_ru}
                    onChange={(e) =>
                      setNewName({ ...newName, name_ru: e.target.value })
                    }
                    className="form-control"
                    required
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="new_name_sanskrit" className="form-label">
                      Название на санскрите
                    </label>
                    <input
                      type="text"
                      id="new_name_sanskrit"
                      value={newName.name_sanskrit}
                      onChange={(e) =>
                        setNewName({ ...newName, name_sanskrit: e.target.value })
                      }
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="transliteration" className="form-label">
                      Транслитерация
                    </label>
                    <input
                      type="text"
                      id="transliteration"
                      value={newName.transliteration}
                      onChange={(e) =>
                        setNewName({ ...newName, transliteration: e.target.value })
                      }
                      className="form-control"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="definition" className="form-label">
                    Пояснение
                  </label>
                  <textarea
                    id="definition"
                    value={newName.definition}
                    onChange={(e) =>
                      setNewName({ ...newName, definition: e.target.value })
                    }
                    className="form-control"
                  />
                </div>
              </>
            )}
          </div>

          <div className="form-section">
            <h2 className="form-section-title">Источник</h2>
            <div className="radio-group">
              <div className="radio-option">
                <input
                  type="radio"
                  id="existing-source"
                  name="source-option"
                  value="existing"
                  checked={sourceOption === 'existing'}
                  onChange={(e) => setSourceOption(e.target.value)}
                />
                <label htmlFor="existing-source">Выбрать существующий источник</label>
              </div>
              <div className="radio-option">
                <input
                  type="radio"
                  id="new-source"
                  name="source-option"
                  value="new"
                  checked={sourceOption === 'new'}
                  onChange={(e) => setSourceOption(e.target.value)}
                />
                <label htmlFor="new-source">Добавить новый источник</label>
              </div>
            </div>

            {sourceOption === 'existing' ? (
              <div className="form-group">
                <label htmlFor="selected_source" className="form-label">
                  Выберите источник:
                </label>
                <select
                  id="selected_source"
                  value={selectedSource}
                  onChange={(e) => setSelectedSource(e.target.value)}
                  className="form-select"
                  required
                >
                  <option value="">-- Выберите источник --</option>
                  {sources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.author} - {source.title}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="new_source_title" className="form-label">
                      Название *
                    </label>
                    <input
                      type="text"
                      id="new_source_title"
                      value={newSource.title}
                      onChange={(e) =>
                        setNewSource({ ...newSource, title: e.target.value })
                      }
                      className="form-control"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="new_source_author" className="form-label">
                      Автор *
                    </label>
                    <input
                      type="text"
                      id="new_source_author"
                      value={newSource.author}
                      onChange={(e) =>
                        setNewSource({ ...newSource, author: e.target.value })
                      }
                      className="form-control"
                      required
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="new_source_year" className="form-label">
                      Год *
                    </label>
                    <input
                      type="number"
                      id="new_source_year"
                      value={newSource.year}
                      onChange={(e) =>
                        setNewSource({ ...newSource, year: e.target.value })
                      }
                      className="form-control"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="new_source_publisher" className="form-label">
                      Издательство
                    </label>
                    <input
                      type="text"
                      id="new_source_publisher"
                      value={newSource.publisher}
                      onChange={(e) =>
                        setNewSource({ ...newSource, publisher: e.target.value })
                      }
                      className="form-control"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="new_source_pages" className="form-label">
                      Страниц
                    </label>
                    <input
                      type="number"
                      id="new_source_pages"
                      value={newSource.pages}
                      onChange={(e) =>
                        setNewSource({ ...newSource, pages: e.target.value })
                      }
                      className="form-control"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="new_source_annotation" className="form-label">
                    Аннотация
                  </label>
                  <textarea
                    id="new_source_annotation"
                    value={newSource.annotation}
                    onChange={(e) =>
                      setNewSource({ ...newSource, annotation: e.target.value })
                    }
                    className="form-control"
                  />
                </div>
              </>
            )}
          </div>

          <div className="form-section">
            <h2 className="form-section-title">Фотография</h2>
            <div className="form-group">
              <label htmlFor="photo" className="form-label">
                Фотография асаны *
              </label>
              <input
                type="file"
                id="photo"
                accept="image/*"
                onChange={handlePhotoChange}
                required
              />
              <div className="file-preview">
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" />
                ) : (
                  <span className="file-preview-text">Выберите файл</span>
                )}
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Добавление...' : 'Добавить асану'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddAsana;

