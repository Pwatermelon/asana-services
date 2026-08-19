import React, { useState } from 'react';
import { useNavigate, Link, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePageSeo } from '../utils/pageSeo';
import '../styles/Login.css';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const resetSuccessMessage = location.state?.message;
  const [searchParams] = useSearchParams();
  const nextPath = searchParams.get('next');

  usePageSeo({
    title: 'Вход',
    path: '/login',
    noindex: true,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(username, password, rememberMe);
      if (result.success) {
        if (nextPath && nextPath.startsWith('/')) {
          if (nextPath.startsWith('/grafana') || nextPath.startsWith('/kibana')) {
            const token = localStorage.getItem('access_token');
            if (token) {
              const params = new URLSearchParams({ access_token: token, next: nextPath });
              window.location.href = `/api/auth/monitoring-session?${params.toString()}`;
              return;
            }
          }
          window.location.href = nextPath;
          return;
        }
        navigate('/asanas');
      } else {
        setError(result.error || 'Неверный email/логин или пароль');
      }
    } catch (err) {
      setError('Ошибка при входе в систему');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="auth-container">
        <h1 className="auth-title">Вход в систему</h1>
        {nextPath && (
          <p className="auth-hint">После входа вы будете перенаправлены в запрошенный раздел.</p>
        )}
        {resetSuccessMessage && (
          <div className="success-message" role="status">
            {resetSuccessMessage}
          </div>
        )}
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Email или логин</label>
            <input
              type="text"
              id="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Пароль</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="remember-me">
            <label>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              Запомнить меня
            </label>
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>
        <div className="auth-links">
          <Link to="/reset-password">Забыли пароль?</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
