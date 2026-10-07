import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { analyticsAPI } from '../api/analytics';

const SESSION_KEY = 'asana_nav_sid';
const SKIP_PREFIXES = ['/login', '/confirm-registration', '/reset-password'];

function getOrCreateSessionId() {
  try {
    let sid = window.sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      window.sessionStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  } catch {
    return `s_${Date.now()}`;
  }
}

function shouldTrack(pathname) {
  if (!pathname) return false;
  return !SKIP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Сбор pageview SPA для AsanaNavPath: маршрут → пакет на /api/analytics/nav.
 */
const NavPathTracker = () => {
  const location = useLocation();
  const prevPathRef = useRef(null);
  const enteredAtRef = useRef(Date.now());
  const queueRef = useRef([]);
  const flushTimerRef = useRef(null);

  const flush = () => {
    const batch = queueRef.current.splice(0, 40);
    if (!batch.length) return;
    analyticsAPI.postNavEvents(batch).catch(() => {});
  };

  const enqueue = (event) => {
    queueRef.current.push(event);
    if (queueRef.current.length >= 8) {
      flush();
      return;
    }
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    flushTimerRef.current = setTimeout(flush, 1200);
  };

  useEffect(() => {
    const path = location.pathname || '/';
    if (!shouldTrack(path)) {
      prevPathRef.current = path;
      enteredAtRef.current = Date.now();
      return undefined;
    }

    const now = Date.now();
    const dwellMs =
      prevPathRef.current != null ? Math.max(0, now - enteredAtRef.current) : null;

    enqueue({
      path,
      referrer_path: prevPathRef.current,
      session_id: getOrCreateSessionId(),
      dwell_ms: dwellMs,
      viewport_w: typeof window !== 'undefined' ? window.innerWidth : null,
      created_at: new Date().toISOString(),
    });

    prevPathRef.current = path;
    enteredAtRef.current = now;
    return undefined;
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onHide = () => flush();
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
    return () => {
      window.removeEventListener('pagehide', onHide);
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      flush();
    };
  }, []);

  return null;
};

export default NavPathTracker;
