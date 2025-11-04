import React, { useState, useEffect } from 'react';
import { contentAPI } from '../api/content';
import { useAuth } from '../contexts/AuthContext';
import '../styles/AboutProject.css';

const ExpertInstructions = () => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { isAdmin } = useAuth();

  useEffect(() => {
    loadContent();
  }, []);

  const loadContent = async () => {
    try {
      const data = await contentAPI.getExpertInstructions();
      setContent(data.content || '');
      setEditContent(data.content || '');
    } catch (error) {
      console.error('Error loading content:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setEditContent(content);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditContent(content);
    setError('');
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');

    try {
      await contentAPI.updateExpertInstructions(editContent);
      setContent(editContent);
      setIsEditing(false);
    } catch (error) {
      setError(error.response?.data?.detail || 'Ошибка при сохранении');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="container">Загрузка...</div>;
  }

  return (
    <div className="container">
      <div className="about-container">
        <h1 className="about-title">Инструкции для экспертов</h1>
        {isAdmin && !isEditing && (
          <button onClick={handleEdit} className="btn-primary">
            Редактировать
          </button>
        )}
        {isEditing ? (
          <div className="edit-form">
            {error && <div className="error-message">{error}</div>}
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="edit-textarea"
            />
            <div className="edit-actions">
              <button
                onClick={handleSave}
                className="btn-primary"
                disabled={saving}
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button onClick={handleCancel} className="btn-secondary">
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <div className="about-content" dangerouslySetInnerHTML={{ __html: content }} />
        )}
      </div>
    </div>
  );
};

export default ExpertInstructions;

