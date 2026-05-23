import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI } from '../api/auth';
import '../styles/Login.css';

const ResetPassword = () => {
  const [mail, setMail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authAPI.resetPasswordRequest(mail.trim());
      setSuccess(true);
    } catch (err) {
      const status = err.response?.status;
      if (status === 429) {
        setError(err.response?.data?.detail || 'Слишком много попыток. Подождите и повторите позже.');
      } else if (status === 422) {
        setError('Укажите корректный email.');
      } else if (status === 503) {
        setError(err.response?.data?.detail || 'Почтовый сервер недоступен. Обратитесь к администратору.');
      } else {
        setError(err.response?.data?.detail || 'Ошибка при запросе сброса пароля');
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="container">
        <div className="auth-container auth-container-wide">
          <h1 className="auth-title">Код отправлен</h1>
          <p className="auth-success-text">
            На указанный email отправлен 6-значный код.
            <br />
            Введите его на следующем шаге — код действует ограниченное время.
          </p>
          <Link to={`/reset-password-confirm?mail=${encodeURIComponent(mail.trim())}`} className="btn-primary">
            Ввести код
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="auth-container auth-container-wide">
        <h1 className="auth-title">Сброс пароля</h1>
        <p className="auth-notice">Код придёт только на email, привязанный к учётной записи.</p>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="mail">Email</label>
            <input
              type="email"
              id="mail"
              value={mail}
              onChange={(e) => setMail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Отправка...' : 'Отправить код'}
          </button>
        </form>
        <div className="auth-links">
          <Link to="/login">Вернуться к входу</Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
