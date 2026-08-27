import { useEffect } from 'react';

export const SITE_NAME = 'Каталог асан традиционных школ йоги';
export const SITE_ORIGIN = (
  import.meta.env.VITE_PUBLIC_SITE_URL || 'https://catalog-asan.ru'
).replace(/\/$/, '');

export const DEFAULT_SITE_DESCRIPTION =
  'Справочник асан традиционных школ йоги: русские и санскритские названия, иллюстрации из первоисточников, связи между школами и источниками.';

export const SITE_EMAIL = 'zhukov.jm@gmail.com';

/** Пути, которые не должны индексироваться (служебные / личные). */
export const NOINDEX_PATH_PREFIXES = [
  '/login',
  '/confirm-registration',
  '/reset-password',
  '/profile',
  '/admin',
  '/users',
  '/settings',
  '/moderation',
  '/ai-moderation',
  '/names',
  '/asana/add',
  '/sources/add',
  '/expert-instructions',
];

export function isNoindexPath(pathname) {
  const p = pathname || '';
  if (NOINDEX_PATH_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`))) {
    return true;
  }
  if (/^\/sources\/[^/]+\/edit\/?$/.test(p)) return true;
  return false;
}

function upsertMeta(attrName, attrValue, content) {
  if (content == null || content === '') return;
  let el = document.head.querySelector(`meta[${attrName}="${attrValue}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel, href) {
  if (!href) return;
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

export function absoluteUrl(pathOrUrl) {
  if (!pathOrUrl) return `${SITE_ORIGIN}/`;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${SITE_ORIGIN}${path}`;
}

function setJsonLd(id, data) {
  const scriptId = `jsonld-${id}`;
  let el = document.getElementById(scriptId);
  if (!data) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = scriptId;
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

/** Базовая Organization + WebSite (+ SearchAction) для всего сайта. */
export function buildSiteGraphJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_ORIGIN}/#organization`,
        name: SITE_NAME,
        url: SITE_ORIGIN,
        logo: absoluteUrl('/icon-512.png'),
        email: SITE_EMAIL,
        description: DEFAULT_SITE_DESCRIPTION,
        foundingDate: '2025',
        sameAs: [
          'https://vk.com/tatianashulgayoga',
          'https://vk.com/sergey_babkin9',
          'https://github.com/Pwatermelon',
        ],
        contactPoint: [
          {
            '@type': 'ContactPoint',
            email: SITE_EMAIL,
            contactType: 'technical support',
            availableLanguage: 'Russian',
          },
          {
            '@type': 'ContactPoint',
            email: 'taiss@yandex.ru',
            contactType: 'customer support',
            availableLanguage: 'Russian',
          },
        ],
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_ORIGIN}/#website`,
        url: SITE_ORIGIN,
        name: SITE_NAME,
        description: DEFAULT_SITE_DESCRIPTION,
        inLanguage: 'ru-RU',
        publisher: { '@id': `${SITE_ORIGIN}/#organization` },
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${SITE_ORIGIN}/asanas?search={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  };
}

export function buildBreadcrumbJsonLd(items) {
  if (!items?.length) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function buildAsanaJsonLd({ nameRu, nameSa, definition, path, image }) {
  if (!nameRu) return null;
  const pageUrl = absoluteUrl(path);
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: nameRu,
    name: nameRu,
    alternateName: [nameSa, definition].filter(Boolean),
    description:
      [nameRu, nameSa && `санскр. ${nameSa}`, definition].filter(Boolean).join(' — ') ||
      DEFAULT_SITE_DESCRIPTION,
    inLanguage: 'ru-RU',
    url: pageUrl,
    mainEntityOfPage: pageUrl,
    image: image ? absoluteUrl(image) : absoluteUrl('/icon-512.png'),
    author: { '@id': `${SITE_ORIGIN}/#organization` },
    publisher: { '@id': `${SITE_ORIGIN}/#organization` },
    about: {
      '@type': 'Thing',
      name: nameRu,
      alternateName: nameSa || undefined,
      description: definition || undefined,
    },
  };
}

/**
 * Обновляет title, description, Open Graph, Twitter Card, canonical и JSON-LD.
 */
export function usePageSeo({
  title,
  description = DEFAULT_SITE_DESCRIPTION,
  path,
  image,
  type = 'website',
  noindex = false,
  breadcrumbs,
  jsonLd,
} = {}) {
  useEffect(() => {
    const canonicalPath =
      path ?? `${window.location.pathname}${window.location.search}`;
    const pageTitle = title ? `${title} — ${SITE_NAME}` : SITE_NAME;
    const canonicalUrl = absoluteUrl(canonicalPath);
    const ogImage = absoluteUrl(image || '/icon-512.png');
    const robotsNoindex = noindex || isNoindexPath(window.location.pathname);

    document.title = pageTitle;
    upsertMeta('name', 'description', description);
    upsertMeta('name', 'robots', robotsNoindex ? 'noindex, nofollow' : 'index, follow');
    upsertMeta('property', 'og:site_name', SITE_NAME);
    upsertMeta('property', 'og:title', pageTitle);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:url', canonicalUrl);
    upsertMeta('property', 'og:type', type);
    upsertMeta('property', 'og:locale', 'ru_RU');
    upsertMeta('property', 'og:image', ogImage);
    upsertMeta('name', 'twitter:card', 'summary');
    upsertMeta('name', 'twitter:title', pageTitle);
    upsertMeta('name', 'twitter:description', description);
    upsertMeta('name', 'twitter:image', ogImage);
    upsertLink('canonical', canonicalUrl);

    setJsonLd('site', buildSiteGraphJsonLd());
    setJsonLd('breadcrumb', buildBreadcrumbJsonLd(breadcrumbs));
    setJsonLd('page', jsonLd || null);
    // breadcrumbs/jsonLd сравниваем по сериализации — массивы/объекты с страниц часто новые по ссылке
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    title,
    description,
    path,
    image,
    type,
    noindex,
    JSON.stringify(breadcrumbs),
    JSON.stringify(jsonLd),
  ]);
}
