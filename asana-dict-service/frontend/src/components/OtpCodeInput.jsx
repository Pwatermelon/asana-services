import React, { useRef, useEffect } from 'react';
import '../styles/PasswordForm.css';

const CODE_LENGTH = 6;

const OtpCodeInput = ({ value, onChange, disabled = false }) => {
  const inputsRef = useRef([]);

  const digits = Array.from({ length: CODE_LENGTH }, (_, i) => value[i] || '');

  useEffect(() => {
    if (!disabled && value.length === 0) {
      inputsRef.current[0]?.focus();
    }
  }, [disabled, value.length]);

  const emitChange = (nextDigits) => {
    onChange(nextDigits.join('').slice(0, CODE_LENGTH));
  };

  const handleChange = (index, raw) => {
    const digit = raw.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    emitChange(next);
    if (digit && index < CODE_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowRight' && index < CODE_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
    if (!pasted) return;
    const next = Array.from({ length: CODE_LENGTH }, (_, i) => pasted[i] || '');
    emitChange(next);
    const focusIndex = Math.min(pasted.length, CODE_LENGTH - 1);
    inputsRef.current[focusIndex]?.focus();
  };

  return (
    <div className="otp-input-row" onPaste={handlePaste}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            inputsRef.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          className={`otp-digit${digit ? ' otp-digit-filled' : ''}`}
          value={digit}
          disabled={disabled}
          aria-label={`Цифра ${index + 1} из ${CODE_LENGTH}`}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
        />
      ))}
    </div>
  );
};

export { CODE_LENGTH };
export default OtpCodeInput;
