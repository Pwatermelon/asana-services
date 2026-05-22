import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI } from '../api/auth';
import '../styles/Login.css';

const ResetPassword = () => {
  const [login, setLogin] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authAPI.resetPasswordRequest(login);
      setSuccess(true);
    } catch (err) {
      const status = err.response?.status;
      if (status === 429) {
        setError(err.response?.data?.detail || 'Слишком много попыток. Подождите и повторите позже.');
      } else if (status === 401) {
        setError(err.response?.data?.detail || 'Логин или email не найден.');
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
        <div className="auth-container">
          <h1 className="auth-title">Код отправлен</h1>
          <p>На email учётной записи отправлен код. Введите его на следующем шаге.</p>
          <Link to={`/reset-password-confirm?login=${encodeURIComponent(login)}`} className="btn-primary">
            Ввести код
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="auth-container">
        <h1 className="auth-title">Сброс пароля</h1>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="login">Логин или email</label>
            <input
              type="text"
              id="login"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Отправка...' : 'Отправить'}
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

