import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { analyticsAPI } from '../api/analytics';
import '../styles/AdaptiveNav.css';

/**
 * Подсказки следующего шага (AsanaNavPath) — только для администратора.
 */
const AdaptiveNextSteps = ({ title = 'Куда обычно идут дальше' }) => {
  const { isAdmin } = useAuth();
  const location = useLocation();
  const [steps, setSteps] = useState([]);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!isAdmin) return undefined;
    let cancelled = false;
    analyticsAPI.getNavGuide(location.pathname || '/asanas').then((guide) => {
      if (cancelled) return;
      setEnabled(Boolean(guide.adaptive_enabled));
      setSteps(Array.isArray(guide.next_steps) ? guide.next_steps : []);
    });
    return () => {
      cancelled = true;
    };
  }, [location.pathname, isAdmin]);

  if (!isAdmin || !enabled || !steps.length) return null;

  return (
    <aside className="adaptive-next" aria-label={title}>
      <div className="adaptive-next__title">{title}</div>
      <p className="adaptive-next__hint">
        Подсказки построены по переходам пользователей (цепь Маркова). Видно только администратору.
      </p>
      <div className="adaptive-next__chips">
        {steps.map((s) => (
          <Link
            key={`${s.href}-${s.to_pattern}`}
            to={s.href}
            className="adaptive-next__chip"
            title={`P=${s.probability}, n=${s.count}`}
          >
            <span className="adaptive-next__chip-label">{s.label}</span>
            <span className="adaptive-next__chip-meta">
              {Math.round((s.probability || 0) * 100)}%
            </span>
          </Link>
        ))}
      </div>
    </aside>
  );
};

export default AdaptiveNextSteps;
