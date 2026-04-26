import React from 'react';
import { useNavigate } from 'react-router-dom';

export function asanaPagePath(asana) {
  const raw = asana.id.split('#').pop();
  return `/asana/${raw}-page`;
}

export function CompactAsanaRow({ asana }) {
  const navigate = useNavigate();
  const to = asanaPagePath(asana);
  const titleHint = asana.name?.name_ru || '';

  return (
    <div className="asana-line">
      <div
        className="asana-line-click"
        role="button"
        tabIndex={0}
        title={titleHint || undefined}
        onClick={() => navigate(to)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            navigate(to);
          }
        }}
      >
        <span className="asana-line-name-ru">{asana.name?.name_ru || '—'}</span>
      </div>
    </div>
  );
}
