import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../api/auth';
import '../styles/Profile.css';

const buildPasswordRules = (value) => ({
  length: value.length >= 12,
  upper: /[A-Z]/.test(value),
  lower: /[a-z]/.test(value),
  digit: /\d/.test(value),
  special: /[^A-Za-z0-9]/.test(value),
  noSpace: !/\s/.test(value),
});

const Profile = () => {
  const { user, refreshUser } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const [avatarMessage, setAvatarMessage] = useState('');
  const [avatarLoading, setAvatarLoading] = useState(false);
  const passwordRules = buildPasswordRules(newPassword);
  const allRulesOk = Object.values(passwordRules).every(Boolean);
  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordMessage('');
    if (!allRulesOk) {
      setPasswordError('Пароль не соответствует требованиям безопасности.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Новый пароль и подтверждение не совпадают.');
      return;
    }
    try {
      await authAPI.changeMyPassword(currentPassword, newPassword);
      setPasswordMessage('Пароль успешно изменен.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      setPasswordError(error.response?.data?.detail || 'Не удалось изменить пароль.');
    }
  };

  const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setAvatarLoading(true);
    setAvatarError('');
    setAvatarMessage('');
    try {
      await authAPI.updateMyAvatar(file);
      await refreshUser();
      setAvatarMessage('Аватар обновлен.');
    } catch (error) {
      setAvatarError(error.response?.data?.detail || 'Не удалось загрузить аватар.');
    } finally {
      setAvatarLoading(false);
      event.target.value = '';
    }
  };

  const handleAvatarDelete = async () => {
    setAvatarLoading(true);
    setAvatarError('');
    setAvatarMessage('');
    try {
      await authAPI.deleteMyAvatar();
      await refreshUser();
      setAvatarMessage('Аватар удален.');
    } catch (error) {
      setAvatarError(error.response?.data?.detail || 'Не удалось удалить аватар.');
    } finally {
      setAvatarLoading(false);
    }
  };

  const initials = (user?.login || '?').charAt(0).toUpperCase();

  return (
    <div className="container profile-page">
      <h1 className="profile-title">Профиль</h1>

      <section className="profile-card">
        <h2>Личные данные</h2>
        <div className="profile-header">
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt="Аватар" className="profile-avatar-image" />
          ) : (
            <div className="profile-avatar-fallback">{initials}</div>
          )}
          <div className="profile-user-meta">
            <div><b>Логин:</b> {user?.login || '-'}</div>
            <div><b>Email:</b> {user?.mail || '-'}</div>
          </div>
        </div>

        {avatarError && <div className="error-message">{avatarError}</div>}
        {avatarMessage && <div className="success-message">{avatarMessage}</div>}

        <div className="profile-actions">
          <label className="btn-secondary profile-upload-btn">
            {avatarLoading ? 'Загрузка...' : 'Загрузить аватар'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleAvatarUpload}
              hidden
              disabled={avatarLoading}
            />
          </label>
          {user?.avatar_url && (
            <button
              type="button"
              className="btn-delete"
              onClick={handleAvatarDelete}
              disabled={avatarLoading}
            >
              Удалить аватар
            </button>
          )}
        </div>
      </section>

      <section className="profile-card">
        <h2>Смена пароля</h2>
        {passwordError && <div className="error-message">{passwordError}</div>}
        {passwordMessage && <div className="success-message">{passwordMessage}</div>}
        <form onSubmit={handleChangePassword} className="profile-form">
          <div className="form-group">
            <label htmlFor="current-password">Текущий пароль</label>
            <input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="new-password">Новый пароль</label>
            <input
              id="new-password"
              type="password"
              className={newPassword.length > 0 ? (allRulesOk ? 'valid-input' : 'invalid-input') : ''}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <ul className="password-rules-list">
            <li className={passwordRules.length ? 'rule-ok' : 'rule-bad'}>{passwordRules.length ? '✓' : '○'} минимум 12 символов</li>
            <li className={passwordRules.upper ? 'rule-ok' : 'rule-bad'}>{passwordRules.upper ? '✓' : '○'} минимум одна заглавная буква</li>
            <li className={passwordRules.lower ? 'rule-ok' : 'rule-bad'}>{passwordRules.lower ? '✓' : '○'} минимум одна строчная буква</li>
            <li className={passwordRules.digit ? 'rule-ok' : 'rule-bad'}>{passwordRules.digit ? '✓' : '○'} минимум одна цифра</li>
            <li className={passwordRules.special ? 'rule-ok' : 'rule-bad'}>{passwordRules.special ? '✓' : '○'} минимум один спецсимвол</li>
            <li className={passwordRules.noSpace ? 'rule-ok' : 'rule-bad'}>{passwordRules.noSpace ? '✓' : '○'} без пробелов</li>
          </ul>
          <div className="form-group">
            <label htmlFor="confirm-password">Подтвердите новый пароль</label>
            <input
              id="confirm-password"
              type="password"
              className={confirmPassword.length > 0 ? (passwordsMatch ? 'valid-input' : 'invalid-input') : ''}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            {confirmPassword.length > 0 && (
              <div className={passwordsMatch ? 'match-ok' : 'match-bad'}>
                {passwordsMatch ? '✓ Пароли совпадают' : 'Пароли не совпадают'}
              </div>
            )}
          </div>
          <button type="submit" className="btn-primary" disabled={!allRulesOk || !passwordsMatch}>
            Сменить пароль
          </button>
        </form>
      </section>
    </div>
  );
};

export default Profile;
