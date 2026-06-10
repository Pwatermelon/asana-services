import { canonicalPhotoId, resolvePhotoId } from './photoSameAs';

const FOCUS_KEY = 'asanaFocusPhoto';

export function stashFocusPhoto(photoCanon, ownerId = null) {
  const photo = canonicalPhotoId(photoCanon);
  if (!photo) return;
  try {
    sessionStorage.setItem(
      FOCUS_KEY,
      JSON.stringify({ photoCanon: photo, ownerId: ownerId || null })
    );
  } catch {
    /* ignore */
  }
}

export function readFocusPhoto() {
  try {
    const raw = sessionStorage.getItem(FOCUS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.photoCanon) return null;
    return {
      photoCanon: canonicalPhotoId(parsed.photoCanon),
      ownerId: parsed.ownerId || null,
    };
  } catch {
    return null;
  }
}

export function clearFocusPhoto() {
  try {
    sessionStorage.removeItem(FOCUS_KEY);
  } catch {
    /* ignore */
  }
}

export function resolveFocusPhotoHint(searchParams, locationState = null) {
  const fromUrl = searchParams?.get?.('focusPhoto');
  const fromState = locationState?.focusPhoto;
  const photoRaw = fromUrl || fromState;
  if (!photoRaw) return null;
  const stashed = readFocusPhoto();
  const ownerFromUrl = searchParams?.get?.('focusOwner');
  return {
    photoCanon: canonicalPhotoId(photoRaw),
    ownerId:
      stashed?.ownerId ||
      locationState?.focusOwner ||
      ownerFromUrl ||
      null,
  };
}

export function buildFocusPhotoQuery(photoCanon, ownerId = null) {
  const photo = canonicalPhotoId(photoCanon);
  if (!photo) return '';
  const params = new URLSearchParams();
  params.set('focusPhoto', photo);
  if (ownerId) {
    const owner = String(ownerId).trim();
    if (owner) params.set('focusOwner', owner);
  }
  return params.toString();
}

export function findSlideIndexByPhoto(slides, photoCanon) {
  const target = canonicalPhotoId(photoCanon);
  if (!target || !slides?.length) return -1;
  return slides.findIndex(
    (s) =>
      canonicalPhotoId(resolvePhotoId(s.photo, s.photoIndexInOwner)) === target
  );
}

/** Прокрутка к секции буквы с учётом шапки и липкой панели поиска/алфавита. */
export function scrollToCatalogLetter(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return false;
  const root = document.documentElement;
  const headerOffset =
    parseFloat(getComputedStyle(root).getPropertyValue('--app-header-offset')) || 64;
  const sticky = document.querySelector('.catalog-toolbar--sticky, .catalog-toolbar');
  const cssFallback =
    parseFloat(getComputedStyle(root).getPropertyValue('--catalog-sticky-offset')) || 150;
  const toolbarH = sticky?.getBoundingClientRect().height ?? cssFallback;
  const gap = 10;
  const top = el.getBoundingClientRect().top + window.scrollY - headerOffset - toolbarH - gap;
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  return true;
}
