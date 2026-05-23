import React, { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { authAPI } from '../api/auth';
import '../styles/Login.css';

const ResetPasswordConfirm = () => {
  const [searchParams] = useSearchParams();
  const [mail, setMail] = useState(searchParams.get('mail') || '');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const normalizedMail = mail.trim();
      await authAPI.verifyResetCode(normalizedMail, code);
      await authAPI.resetPasswordConfirm(normalizedMail, code, newPassword);
      navigate('/login');
    } catch (err) {
      const status = err.response?.status;
      if (status === 429) {
        setError(err.response?.data?.detail || 'Слишком много попыток. Подождите и повторите позже.');
      } else if (status === 422) {
        setError('Укажите корректный email.');
      } else {
        setError(err.response?.data?.detail || 'Неверный код или email. Запросите код заново.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="auth-container">
        <h1 className="auth-title">Подтверждение сброса пароля</h1>
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
              readOnly={Boolean(searchParams.get('mail'))}
            />
          </div>
          <div className="form-group">
            <label htmlFor="code">Код из письма</label>
            <input
              type="text"
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="new_password">Новый пароль</label>
            <input
              type="password"
              id="new_password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Сброс...' : 'Сбросить пароль'}
          </button>
        </form>
        <div className="auth-links">
          <Link to="/reset-password">Запросить код снова</Link>
          <Link to="/login">Вернуться к входу</Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordConfirm;
