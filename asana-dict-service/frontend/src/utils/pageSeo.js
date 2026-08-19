import { useEffect } from 'react';

export const SITE_NAME = 'Каталог асан традиционных школ йоги';

export const DEFAULT_SITE_DESCRIPTION =
  'Справочник асан традиционных школ йоги: русские и санскритские названия, иллюстрации из первоисточников, связи между школами и источниками.';

const SITE_ORIGIN = (
  import.meta.env.VITE_PUBLIC_SITE_URL || 'https://catalog-asan.ru'
).replace(/\/$/, '');

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

function absoluteUrl(pathOrUrl) {
  if (!pathOrUrl) return `${SITE_ORIGIN}/`;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${SITE_ORIGIN}${path}`;
}

/**
 * Обновляет title, description, Open Graph, Twitter Card и canonical для SPA-страницы.
 */
export function usePageSeo({
  title,
  description = DEFAULT_SITE_DESCRIPTION,
  path,
  image,
  type = 'website',
  noindex = false,
} = {}) {
  useEffect(() => {
    const canonicalPath =
      path ?? `${window.location.pathname}${window.location.search}`;
    const pageTitle = title ? `${title} — ${SITE_NAME}` : SITE_NAME;
    const canonicalUrl = absoluteUrl(canonicalPath);
    const ogImage = absoluteUrl(image || '/icon.svg');

    document.title = pageTitle;
    upsertMeta('name', 'description', description);
    upsertMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');
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
  }, [title, description, path, image, type, noindex]);
}
