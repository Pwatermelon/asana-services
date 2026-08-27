import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { isNoindexPath } from '../utils/pageSeo';

/** Служебные URL без собственного SEO: выставляет noindex. */
export default function NoindexGuard() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (!isNoindexPath(pathname)) return undefined;
    let el = document.head.querySelector('meta[name="robots"]');
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('name', 'robots');
      document.head.appendChild(el);
    }
    el.setAttribute('content', 'noindex, nofollow');
    document.title = 'Служебная страница — Каталог асан традиционных школ йоги';
    return undefined;
  }, [pathname]);

  return null;
}
