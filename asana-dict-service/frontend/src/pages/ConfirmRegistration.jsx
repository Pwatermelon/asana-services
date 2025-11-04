import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../api/auth';
import '../styles/Login.css';

const ConfirmRegistration = () => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authAPI.confirmRegistration(code);
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.detail || 'Ошибка при подтверждении');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="auth-container">
        <h1 className="auth-title">Подтверждение регистрации</h1>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
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
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Подтверждение...' : 'Подтвердить'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ConfirmRegistration;

