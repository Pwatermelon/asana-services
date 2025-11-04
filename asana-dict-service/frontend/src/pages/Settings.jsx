import React, { useState } from 'react';
import { contentAPI } from '../api/content';
import '../styles/Settings.css';

const Settings = () => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('ontology_file', file);

      const response = await fetch('/upload-ontology', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: formData,
      });

      if (response.ok) {
        setSuccess('Онтология успешно загружена');
      } else {
        const data = await response.json();
        setError(data.detail || 'Ошибка при загрузке онтологии');
      }
    } catch (error) {
      setError('Ошибка при загрузке онтологии');
      console.error('Error uploading ontology:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="container">
      <div className="settings-container">
        <h1 className="settings-title">Настройки</h1>

        <div className="settings-section">
          <h2 className="settings-section-title">Загрузка онтологии</h2>
          <p className="settings-description">
            Загрузите файл онтологии в формате OWL для обновления базы данных.
          </p>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <div className="form-group">
            <label htmlFor="ontology-file" className="form-label">
              Выберите файл онтологии
            </label>
            <input
              type="file"
              id="ontology-file"
              accept=".owl"
              onChange={handleFileUpload}
              disabled={uploading}
            />
            {uploading && <p>Загрузка...</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;

