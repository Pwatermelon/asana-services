/** Вкладки Grafana — uid совпадает с provisioning JSON. */
export const GRAFANA_DASHBOARD_TABS = [
  {
    id: 'app',
    title: 'Приложение',
    uid: 'asana-app-overview',
    slug: 'application-overview',
  },
  {
    id: 'infra',
    title: 'Инфраструктура',
    uid: 'asana-infrastructure',
    slug: 'infrastructure',
  },
  {
    id: 'catalog',
    title: 'Каталог',
    uid: 'asana-catalog-metrics',
    slug: 'catalog-domain-metrics',
  },
  {
    id: 'ai',
    title: 'ИИ',
    uid: 'asana-ai-metrics',
    slug: 'ai-metrics',
  },
  {
    id: 'backup',
    title: 'Бэкапы',
    uid: 'asana-backup-status',
    slug: 'backup-status',
  },
];

/** Вкладки Kibana Discover. */
export const KIBANA_LOG_TABS = [
  {
    id: 'all',
    title: 'Все логи',
    path: '/kibana/app/discover',
  },
  {
    id: 'errors',
    title: 'Ошибки',
    path: "/kibana/app/discover#/?_a=(query:(language:kuery,query:'message:*error*%20OR%20message:*ERROR*%20OR%20message:*Exception*'))",
  },
  {
    id: 'backend',
    title: 'Backend',
    path: "/kibana/app/discover#/?_a=(query:(language:kuery,query:'message:*asana-backend*'))",
  },
  {
    id: 'import',
    title: 'Import',
    path: "/kibana/app/discover#/?_a=(query:(language:kuery,query:'message:*asana-import*'))",
  },
];

export function grafanaDashboardEmbedUrl(uid, slug) {
  const params = new URLSearchParams({
    orgId: '1',
    kiosk: '1',
    theme: 'light',
  });
  return `/grafana/d/${uid}/${slug}?${params.toString()}`;
}

/** Cookie monitoring_token для iframe Grafana/Kibana (только админ). */
export async function bootstrapMonitoringCookie(accessToken) {
  if (!accessToken) return false;
  const params = new URLSearchParams({ access_token: accessToken });
  try {
    const res = await fetch(`/api/auth/monitoring-bootstrap?${params.toString()}`, {
      credentials: 'include',
    });
    return res.ok;
  } catch {
    return false;
  }
}
