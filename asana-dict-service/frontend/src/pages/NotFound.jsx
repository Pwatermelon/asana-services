import React from 'react';
import { Link } from 'react-router-dom';
import { usePageSeo } from '../utils/pageSeo';

/** Клиентская 404 (для SPA-навигации). HTTP-статус 404 отдаёт nginx для неизвестных URL. */
export default function NotFound() {
  usePageSeo({
    title: 'Страница не найдена',
    description: 'Запрошенная страница не существует.',
    path: typeof window !== 'undefined' ? window.location.pathname : '/404',
    noindex: true,
  });

  return (
    <div className="container" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
      <h1 className="page-title" style={{ fontSize: '2.5rem' }}>
        404
      </h1>
      <p className="page-description" style={{ marginBottom: '1.5rem' }}>
        Страница не найдена. Проверьте адрес или вернитесь в каталог.
      </p>
      <Link to="/asanas" className="btn-primary">
        В каталог
      </Link>
    </div>
  );
}
