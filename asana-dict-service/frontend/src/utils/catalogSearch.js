/**
 * Поиск в каталоге: каждый токен запроса должен «привязаться» к какому-то слову в русском названии:
 * — точное совпадение слова; или для токена длиной ≥ 2 — слово в названии начинается с этого токена
 *   (чтобы «мукх» находило «мукха», согласовано с подсказками);
 * — токен из 1 символа только по полному совпадению слова (исключаем ложные срабатывания на «а»).
 * Подстрочные совпадения внутри слова («сана» в «асана») не используются.
 */
const SPLIT_RE = /[\s\-–—,.;:;]+/u;
const PREFIX_OK_MIN = 2;

/** Ключ для сравнения «одного и того же» русского названия (невидимые отличия в Unicode). */
export function normalizeCatalogNameKey(name) {
  try {
    return String(name ?? '')
      .normalize('NFKC')
      .replace(/\u00A0/g, ' ')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  } catch {
    return String(name ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }
}

/** Одна запись на нормализованное русское название (для гостя / обычного пользователя). */
export function dedupeAsanasByDisplayNameRu(asanas) {
  if (!Array.isArray(asanas)) return [];
  const map = new Map();
  for (const a of asanas) {
    const k = normalizeCatalogNameKey(a.name?.name_ru || '');
    if (!k) continue;
    if (!map.has(k)) map.set(k, a);
  }
  return Array.from(map.values());
}

export function tokenizeRU(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .split(SPLIT_RE)
    .filter(Boolean);
}

function tokenMatchesNameWord(qt, nameTokens) {
  if (!qt) return false;
  if (nameTokens.some((nw) => nw === qt)) return true;
  if (qt.length < PREFIX_OK_MIN) return false;
  return nameTokens.some((nw) => nw.startsWith(qt));
}

/** Все токены запроса сопоставлены со словами названия (точно или префикс ≥2 символов). */
export function matchesCatalogTokens(nameRu, query) {
  const qTokens = tokenizeRU(query);
  if (!qTokens.length) return false;
  const nameTokens = tokenizeRU(nameRu);
  if (!nameTokens.length) return false;
  return qTokens.every((qt) => tokenMatchesNameWord(qt, nameTokens));
}

/** Все токены — только точное совпадение слова (без префикса). */
export function catalogAllTokensExactWord(nameRu, query) {
  const qTokens = tokenizeRU(query);
  const nameTokens = tokenizeRU(nameRu);
  if (!qTokens.length || !nameTokens.length) return false;
  return qTokens.every((qt) => nameTokens.some((nw) => nw === qt));
}

/** Кортеж для сортировки: меньше = раньше в списке. */
export function catalogRankKey(nameRu, query) {
  const n = String(nameRu || '').trim();
  const q = String(query || '').trim();
  const nl = n.toLowerCase();
  const ql = q.toLowerCase();
  const words = tokenizeRU(n);
  const full = nl === ql ? 0 : 1;
  const allExact = catalogAllTokensExactWord(n, q) ? 0 : 1;
  const wordCount = words.length;
  return [full, allExact, wordCount, nl];
}

export function compareCatalogRank(nameA, nameB, query) {
  const ka = catalogRankKey(nameA, query);
  const kb = catalogRankKey(nameB, query);
  for (let i = 0; i < ka.length; i += 1) {
    if (ka[i] < kb[i]) return -1;
    if (ka[i] > kb[i]) return 1;
  }
  return 0;
}

export function filterAsanasByCatalogQuery(asanas, query) {
  if (!Array.isArray(asanas) || !query.trim()) return [];
  const matched = asanas.filter((a) =>
    matchesCatalogTokens(a.name?.name_ru || '', query)
  );
  matched.sort((a, b) =>
    compareCatalogRank(a.name?.name_ru || '', b.name?.name_ru || '', query)
  );
  return matched;
}

/**
 * Подсказки при вводе: уникальные названия, у которых есть слово с префиксом `prefix`
 * (без fuzzy). Короче название — выше.
 */
export function catalogNameSuggestions(asanas, prefix, limit = 12) {
  const p = String(prefix || '')
    .trim()
    .toLowerCase();
  if (!p || !Array.isArray(asanas)) return [];
  const seen = new Set();
  const out = [];
  for (const a of asanas) {
    const name = (a.name?.name_ru || '').trim();
    if (!name) continue;
    const dedupeKey = normalizeCatalogNameKey(name);
    if (!dedupeKey || seen.has(dedupeKey)) continue;
    const words = tokenizeRU(name);
    const hit = words.some((w) => w.startsWith(p)) || name.toLowerCase().startsWith(p);
    if (!hit) continue;
    seen.add(dedupeKey);
    out.push(name);
    if (out.length >= limit * 3) break;
  }
  out.sort((a, b) => {
    const la = tokenizeRU(a).length;
    const lb = tokenizeRU(b).length;
    if (la !== lb) return la - lb;
    return a.localeCompare(b, 'ru', { sensitivity: 'base' });
  });
  return out.slice(0, limit);
}
