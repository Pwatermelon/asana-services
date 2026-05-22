import React, { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { authAPI } from '../api/auth';
import '../styles/Login.css';

const ResetPasswordConfirm = () => {
  const [searchParams] = useSearchParams();
  const [login, setLogin] = useState(searchParams.get('login') || '');
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
      await authAPI.verifyResetCode(login, code);
      await authAPI.resetPasswordConfirm(login, code, newPassword);
      navigate('/login');
    } catch (err) {
      const status = err.response?.status;
      if (status === 429) {
        setError(err.response?.data?.detail || 'Слишком много попыток. Подождите и повторите позже.');
      } else {
        setError(err.response?.data?.detail || 'Ошибка при сбросе пароля');
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
            <label htmlFor="login">Логин или email</label>
            <input
              type="text"
              id="login"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="code">Код подтверждения</label>
            <input
              type="text"
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
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
              required
            />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Сброс...' : 'Сбросить пароль'}
          </button>
        </form>
        <div className="auth-links">
          <Link to="/login">Вернуться к входу</Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordConfirm;

