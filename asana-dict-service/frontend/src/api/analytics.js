import apiClient from './client';

let _guideCache = { key: '', ts: 0, data: null };
const GUIDE_TTL_MS = 60_000;

export const analyticsAPI = {
  getNavSummary: async (days = 7) => {
    const response = await apiClient.get('/api/analytics/nav/summary', {
      params: { days },
    });
    return response.data;
  },

  getNavGuide: async (path = '/asanas', days = 14) => {
    const key = `${path}|${days}`;
    const now = Date.now();
    if (_guideCache.data && _guideCache.key === key && now - _guideCache.ts < GUIDE_TTL_MS) {
      return _guideCache.data;
    }
    const empty = {
      adaptive_enabled: false,
      next_steps: [],
      nav_order: ['/asanas', '/sources', '/about'],
      popular_asanas: [],
      popular_sources: [],
      applied_rules: [],
    };
    try {
      const headers = { Accept: 'application/json' };
      const token =
        typeof window !== 'undefined' && window.localStorage
          ? window.localStorage.getItem('access_token')
          : null;
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(
        `/api/analytics/nav/guide?path=${encodeURIComponent(path)}&days=${days}`,
        { headers }
      );
      if (!res.ok) return empty;
      const data = await res.json();
      _guideCache = { key, ts: now, data };
      return data;
    } catch {
      return empty;
    }
  },

  postNavEvents: async (events) => {
    const headers = { 'Content-Type': 'application/json' };
    const token =
      typeof window !== 'undefined' && window.localStorage
        ? window.localStorage.getItem('access_token')
        : null;
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch('/api/analytics/nav', {
      method: 'POST',
      headers,
      body: JSON.stringify({ events }),
      keepalive: true,
    });
    if (!res.ok) return { accepted: 0 };
    return res.json().catch(() => ({ accepted: 0 }));
  },
};
