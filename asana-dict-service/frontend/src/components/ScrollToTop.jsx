import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Сбрасывает прокрутку при смене маршрута (иначе контент оказывается «сдвинутым» под фиксированную шапку).
 */
const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname]);

  return null;
};

export default ScrollToTop;
