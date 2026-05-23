import React from 'react';
import { buildPasswordRules } from '../utils/passwordRules';
import '../styles/PasswordForm.css';

const RULE_LABELS = [
  { key: 'length', label: 'минимум 12 символов' },
  { key: 'upper', label: 'минимум одна заглавная буква' },
  { key: 'lower', label: 'минимум одна строчная буква' },
  { key: 'digit', label: 'минимум одна цифра' },
  { key: 'special', label: 'минимум один спецсимвол' },
  { key: 'noSpace', label: 'без пробелов' },
];

const PasswordRequirements = ({ password, confirmPassword, showMatch = false }) => {
  const rules = buildPasswordRules(password);
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;

  return (
    <div className="password-form-extras">
      <ul className="password-rules-list" aria-label="Требования к паролю">
        {RULE_LABELS.map(({ key, label }) => (
          <li key={key} className={rules[key] ? 'rule-ok' : 'rule-bad'}>
            {rules[key] ? '✓' : '○'} {label}
          </li>
        ))}
      </ul>
      {showMatch && confirmPassword.length > 0 && (
        <div className={passwordsMatch ? 'match-ok' : 'match-bad'}>
          {passwordsMatch ? '✓ Пароли совпадают' : 'Пароли не совпадают'}
        </div>
      )}
    </div>
  );
};

export default PasswordRequirements;
