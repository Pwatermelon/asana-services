import React from 'react';
import { useNavigate } from 'react-router-dom';

/** Путь к странице асаны; безопасен для null и сырого id. */
export function asanaPagePathSafe(asanaOrId) {
  if (asanaOrId == null) return null;
  const id = typeof asanaOrId === 'object' ? asanaOrId?.id : asanaOrId;
  if (!id) return null;
  const raw = String(id).split('#').pop();
  return raw ? `/asana/${raw}-page` : null;
}

export function asanaPagePath(asana) {
  const path = asanaPagePathSafe(asana);
  if (!path) throw new Error('asanaPagePath: missing asana id');
  return path;
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
