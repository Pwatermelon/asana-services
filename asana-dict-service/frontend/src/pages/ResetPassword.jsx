import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI } from '../api/auth';
import '../styles/Login.css';

const ResetPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authAPI.resetPasswordRequest(email);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Ошибка при запросе сброса пароля');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="container">
        <div className="auth-container">
          <h1 className="auth-title">Письмо отправлено</h1>
          <p>Проверьте вашу почту для получения кода сброса пароля.</p>
          <Link to="/reset-password-confirm" className="btn-primary">
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
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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

