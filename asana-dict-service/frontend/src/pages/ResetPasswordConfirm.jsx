import React, { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { authAPI } from '../api/auth';
import OtpCodeInput, { CODE_LENGTH } from '../components/OtpCodeInput';
import PasswordRequirements from '../components/PasswordRequirements';
import { allPasswordRulesOk } from '../utils/passwordRules';
import '../styles/Login.css';
import '../styles/PasswordForm.css';

const ResetPasswordConfirm = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [mail, setMail] = useState(searchParams.get('mail') || '');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const mailLocked = Boolean(searchParams.get('mail'));
  const rulesOk = allPasswordRulesOk(newPassword);
  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setError('');
    if (code.length !== CODE_LENGTH) {
      setError(`Введите ${CODE_LENGTH}-значный код из письма.`);
      return;
    }
    setLoading(true);
    try {
      await authAPI.verifyResetCode(mail.trim(), code);
      setStep(2);
    } catch (err) {
      const status = err.response?.status;
      if (status === 429) {
        setError(err.response?.data?.detail || 'Слишком много попыток. Подождите и повторите позже.');
      } else {
        setError(err.response?.data?.detail || 'Неверный код или email. Запросите код заново.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSetPassword = async (e) => {
    e.preventDefault();
    setError('');
    if (!rulesOk) {
      setError('Пароль не соответствует требованиям безопасности.');
      return;
    }
    if (!passwordsMatch) {
      setError('Новый пароль и подтверждение не совпадают.');
      return;
    }
    setLoading(true);
    try {
      await authAPI.resetPasswordConfirm(mail.trim(), code, newPassword);
      navigate('/login', { state: { message: 'Пароль изменён. Войдите с новым паролем.' } });
    } catch (err) {
      const status = err.response?.status;
      if (status === 429) {
        setError(err.response?.data?.detail || 'Слишком много попыток. Подождите и повторите позже.');
      } else {
        setError(err.response?.data?.detail || 'Не удалось сменить пароль. Запросите код заново.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="auth-container auth-container-wide">
        <h1 className="auth-title">Сброс пароля</h1>

        <div className="reset-steps" aria-label="Шаги восстановления">
          <div className={`reset-step ${step === 1 ? 'reset-step-active' : 'reset-step-done'}`}>
            1. Код
          </div>
          <div className={`reset-step ${step === 2 ? 'reset-step-active' : ''}`}>
            2. Новый пароль
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        {step === 1 && (
          <form onSubmit={handleVerifyCode}>
            <div className="form-group">
              <label htmlFor="mail">Email</label>
              <input
                type="email"
                id="mail"
                value={mail}
                onChange={(e) => setMail(e.target.value)}
                autoComplete="email"
                required
                readOnly={mailLocked}
              />
            </div>
            <div className="form-group">
              <label>Код из письма</label>
              <p className="otp-hint">6 цифр из письма «Восстановление пароля»</p>
              <OtpCodeInput value={code} onChange={setCode} disabled={loading} />
            </div>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading || code.length !== CODE_LENGTH}
            >
              {loading ? 'Проверка...' : 'Продолжить'}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleSetPassword}>
            <p className="auth-hint">Придумайте новый пароль и повторите его.</p>
            <div className="form-group">
              <label htmlFor="new_password">Новый пароль</label>
              <input
                type="password"
                id="new_password"
                className={newPassword.length > 0 ? (rulesOk ? 'valid-input' : 'invalid-input') : ''}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="confirm_password">Подтвердите пароль</label>
              <input
                type="password"
                id="confirm_password"
                className={
                  confirmPassword.length > 0 ? (passwordsMatch ? 'valid-input' : 'invalid-input') : ''
                }
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <PasswordRequirements
              password={newPassword}
              confirmPassword={confirmPassword}
              showMatch
            />
            <button
              type="submit"
              className="btn-primary"
              disabled={loading || !rulesOk || !passwordsMatch}
            >
              {loading ? 'Сохранение...' : 'Сохранить пароль'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={{ marginTop: '12px', width: '100%' }}
              onClick={() => {
                setStep(1);
                setError('');
              }}
              disabled={loading}
            >
              Назад к коду
            </button>
          </form>
        )}

        <div className="auth-links">
          <Link to="/reset-password">Запросить код снова</Link>
          <Link to="/login">Вернуться к входу</Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordConfirm;
