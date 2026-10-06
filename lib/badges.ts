export interface BadgeLevel {
  /** First crafted level that uses this artwork. */
  level: number;
  /** Last crafted level that uses this artwork. Null when the upper bound is open or unknown. */
  levelMax: number | null;
  /** SteamCardExchange requirement, such as "Level 5", "Level 10 - 14", or "Level 1000+". */
  levelLabel: string;
  name: string;
  imageUrl: string;
  foil: boolean;
}

export interface BadgeRequest {
  appid: number;
  cardName: string;
  seriesHint: number | null;
}

export const BADGE_PAGE_MESSAGE = 'steam-booster-badge-page';

export function cardExchangeGameUrl(appid: number): string {
  return `https://www.steamcardexchange.net/index.php?gamepage-appid-${appid}`;
}

export function readBadgePageAppid(message: unknown): number | null {
  if (!message || typeof message !== 'object') return null;
  const record = message as { type?: unknown; appid?: unknown };
  if (record.type !== BADGE_PAGE_MESSAGE) return null;
  if (typeof record.appid !== 'number' || !Number.isSafeInteger(record.appid) || record.appid <= 0) return null;
  return record.appid;
}

export function readBadgePageHtml(message: unknown): string {
  if (!message || typeof message !== 'object') {
    throw new Error('Could not load badge levels from SteamCardExchange.');
  }
  const record = message as { text?: unknown; error?: unknown };
  if (typeof record.error === 'string' && record.error) throw new Error(record.error);
  if (typeof record.text !== 'string') throw new Error('Could not load badge levels from SteamCardExchange.');
  return record.text;
}

export function stepBadgeIndex(index: number, count: number, direction: -1 | 1): number {
  if (count <= 0) return 0;
  return (index + direction + count) % count;
}

export function appidFromGamecardsHref(href: string): number | null {
  const match = /\/gamecards\/(\d+)/.exec(href);
  if (!match?.[1]) return null;
  const appid = Number(match[1]);
  return Number.isSafeInteger(appid) && appid > 0 ? appid : null;
}

export function badgeRequestKey(request: BadgeRequest): string {
  return `${request.appid}:${request.seriesHint ?? ''}:${request.cardName}`;
}

export function readBadgeRequest(link: HTMLAnchorElement): BadgeRequest | null {
  const href = link.getAttribute('href') ?? '';
  const appid = appidFromGamecardsHref(href);
  const panel = link.closest('#iteminfo0, #iteminfo1');
  if (appid == null || !(panel instanceof HTMLElement)) return null;
  const cardName = panel.querySelector('h1')?.textContent?.trim() ?? '';
  const seriesMatch = /\bSeries\s+(\d+)\b/i.exec(panel.textContent ?? '');
  const seriesHint = seriesMatch?.[1] ? Number(seriesMatch[1]) : null;
  return { appid, cardName, seriesHint };
}

const CARD_ALT = /^Series\s+(\d+)\s+-\s+Card\s+\d+\s+of\s+\d+\s+-\s+(.+)$/i;

export interface BadgeCatalog {
  cards: Record<string, number>;
  series: Record<string, BadgeLevel[]>;
}

export interface BadgeCatalogStore {
  read(appid: number): Promise<BadgeCatalog | null>;
  write(appid: number, catalog: BadgeCatalog): Promise<void>;
}

export function badgeCatalogKey(appid: number): string {
  return `badge-catalog-v2:${appid}`;
}

export function badgeLevelCaption(badge: Pick<BadgeLevel, 'foil' | 'levelLabel'>): string {
  if (!badge.foil) return badge.levelLabel;
  const detail = badge.levelLabel.replace(/^Level\s+/i, '');
  return detail === '1' ? 'Foil' : `Foil ${detail}`;
}

export function parseCardExchangeBadges(html: string, series: number, foil: boolean): BadgeLevel[] {
  return parseBadges(new DOMParser().parseFromString(html, 'text/html'), series, foil);
}

export function extractBadgeCatalog(html: string): BadgeCatalog {
  const document = new DOMParser().parseFromString(html, 'text/html');
  const cards: Record<string, number> = {};
  const seriesNumbers = new Set<number>();
  for (const image of document.querySelectorAll('img')) {
    const match = CARD_ALT.exec(image.getAttribute('alt') ?? '');
    if (!match?.[1] || !match[2]) continue;
    const series = Number(match[1]);
    if (!Number.isInteger(series) || series < 1) continue;
    seriesNumbers.add(series);
    const name = match[2].trim().toLowerCase();
    if (name && cards[name] == null) cards[name] = series;
  }
  for (const node of document.querySelectorAll('[id^="series-"]')) {
    const match = /^series-(\d+)-(?:foil)?badges$/.exec(node.id);
    const series = Number(match?.[1]);
    if (Number.isInteger(series) && series >= 1) seriesNumbers.add(series);
  }

  const series: Record<string, BadgeLevel[]> = {};
  for (const number of [...seriesNumbers].sort((left, right) => left - right)) {
    const levels = [...parseBadges(document, number, false), ...parseBadges(document, number, true)];
    if (levels.length > 0) series[String(number)] = levels;
  }
  return { cards, series };
}

export function readBadgeCatalog(value: unknown): BadgeCatalog | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as { cards?: unknown; series?: unknown };
  if (!record.cards || typeof record.cards !== 'object' || Array.isArray(record.cards)) return null;
  if (!record.series || typeof record.series !== 'object' || Array.isArray(record.series)) return null;

  const cards: Record<string, number> = {};
  for (const [name, series] of Object.entries(record.cards as Record<string, unknown>)) {
    if (!name.trim() || typeof series !== 'number' || !Number.isSafeInteger(series) || series < 1) return null;
    cards[name] = series;
  }

  const series: Record<string, BadgeLevel[]> = {};
  for (const [key, levels] of Object.entries(record.series as Record<string, unknown>)) {
    if (!/^[1-9]\d*$/.test(key) || !Array.isArray(levels) || levels.length === 0) return null;
    const parsed: BadgeLevel[] = [];
    for (const level of levels) {
      const badge = readBadgeLevel(level);
      if (!badge) return null;
      parsed.push(badge);
    }
    series[key] = parsed;
  }
  if (Object.keys(series).length === 0) return null;
  return { cards, series };
}

function parseBadges(document: Document, series: number, foil: boolean): BadgeLevel[] {
  const anchor = document.getElementById(`series-${series}-${foil ? 'foilbadges' : 'badges'}`);
  if (!anchor) return [];
  let section = anchor.parentElement?.nextElementSibling ?? null;
  for (let step = 0; section && step < 3 && section.querySelector('img') == null; step += 1) {
    section = section.nextElementSibling;
  }
  if (!section) return [];

  const levels: BadgeLevel[] = [];
  for (const card of section.children) {
    const image = card.querySelector('img');
    if (!(image instanceof HTMLImageElement)) continue;
    const imageUrl = badgeImageUrl(image.getAttribute('src') ?? '');
    if (!imageUrl) continue;
    const leaves = leafText(card);
    const requirement = leaves.map(parseLevelRequirement).find((parsed) => parsed != null);
    const fallbackLevel = levels.length + 1;
    const parsed = requirement ?? {
      level: fallbackLevel,
      levelMax: fallbackLevel,
      levelLabel: `Level ${fallbackLevel}`,
    };
    const name =
      leaves.find((text) => parseLevelRequirement(text) == null && !/^XP:/i.test(text)) ||
      nameFromAlt(image.getAttribute('alt') ?? '');
    if (!name) continue;
    levels.push({ ...parsed, name, imageUrl, foil });
  }
  return levels.sort((left, right) => left.level - right.level);
}

export function seriesForCardName(html: string, cardName: string): number | null {
  const wanted = cardName.trim().toLowerCase();
  if (!wanted) return null;
  return extractBadgeCatalog(html).cards[wanted] ?? null;
}

export function selectBadgeLevels(
  html: string,
  request: Pick<BadgeRequest, 'seriesHint' | 'cardName'>,
): BadgeLevel[] {
  return selectCatalogLevels(extractBadgeCatalog(html), request);
}

export function selectCatalogLevels(
  catalog: BadgeCatalog,
  request: Pick<BadgeRequest, 'seriesHint' | 'cardName'>,
): BadgeLevel[] {
  const seriesNumbers: number[] = [];
  const add = (series: number | null): void => {
    if (series == null || !Number.isInteger(series) || series < 1 || seriesNumbers.includes(series)) return;
    seriesNumbers.push(series);
  };
  add(catalog.cards[request.cardName.trim().toLowerCase()] ?? null);
  add(request.seriesHint);
  add(1);
  for (const series of seriesNumbers) {
    const levels = catalog.series[String(series)];
    if (levels && levels.length > 0) return levels;
  }
  return [];
}

export function createBadgeLoader(
  fetchText: (url: string) => Promise<string>,
  store?: BadgeCatalogStore,
): {
  load(request: BadgeRequest): Promise<BadgeLevel[]>;
} {
  const catalogs = new Map<number, Promise<BadgeCatalog>>();
  const previews = new Map<string, BadgeLevel[]>();

  return {
    async load(request) {
      const key = badgeRequestKey(request);
      const cached = previews.get(key);
      if (cached) return cached;

      let catalog = catalogs.get(request.appid);
      if (!catalog) {
        catalog = loadCatalog(request.appid, fetchText, store).catch((error: unknown) => {
          catalogs.delete(request.appid);
          throw error;
        });
        catalogs.set(request.appid, catalog);
      }

      const levels = selectCatalogLevels(await catalog, request);
      if (levels.length > 0) previews.set(key, levels);
      return levels;
    },
  };
}

async function loadCatalog(
  appid: number,
  fetchText: (url: string) => Promise<string>,
  store: BadgeCatalogStore | undefined,
): Promise<BadgeCatalog> {
  if (store) {
    try {
      const stored = await store.read(appid);
      if (stored) return stored;
    } catch {
      // Storage can be unavailable. The network result is still shown.
    }
  }

  const catalog = extractBadgeCatalog(await fetchText(cardExchangeGameUrl(appid)));
  if (store && Object.keys(catalog.series).length > 0) {
    try {
      await store.write(appid, catalog);
    } catch {
      // A full extension quota should not hide badges that were just fetched.
    }
  }
  return catalog;
}

function readBadgeLevel(value: unknown): BadgeLevel | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Partial<BadgeLevel>;
  if (typeof record.level !== 'number' || !Number.isSafeInteger(record.level) || record.level < 1) return null;
  if (record.levelMax === undefined) return null;
  if (typeof record.levelMax === 'number') {
    if (!Number.isSafeInteger(record.levelMax) || record.levelMax < record.level) return null;
  } else if (record.levelMax !== null) {
    return null;
  }
  if (typeof record.levelLabel !== 'string' || record.levelLabel.trim().length === 0) return null;
  if (typeof record.name !== 'string' || record.name.trim().length === 0) return null;
  if (typeof record.imageUrl !== 'string' || badgeImageUrl(record.imageUrl) !== record.imageUrl) return null;
  if (typeof record.foil !== 'boolean') return null;
  return {
    level: record.level,
    levelMax: record.levelMax,
    levelLabel: record.levelLabel.trim(),
    name: record.name,
    imageUrl: record.imageUrl,
    foil: record.foil,
  };
}

function parseLevelRequirement(text: string): Pick<BadgeLevel, 'level' | 'levelMax' | 'levelLabel'> | null {
  const normalized = text.trim().replace(/\s+/g, ' ');
  const match = /^Level\s+(\d+)(.*)$/i.exec(normalized);
  if (!match?.[1]) return null;
  const level = Number(match[1]);
  if (!Number.isSafeInteger(level) || level < 1) return null;
  const rest = (match[2] ?? '').trim();
  if (rest === '') return { level, levelMax: level, levelLabel: `Level ${level}` };
  if (rest === '+') return { level, levelMax: null, levelLabel: `Level ${level}+` };
  const range = /^[-–—]\s*(\d+|\?+)$/.exec(rest);
  if (range?.[1] && /^\?+$/.test(range[1])) {
    return { level, levelMax: null, levelLabel: `Level ${level} - ${range[1]}` };
  }
  if (range?.[1] && /^\d+$/.test(range[1])) {
    const levelMax = Number(range[1]);
    if (Number.isSafeInteger(levelMax) && levelMax >= level) {
      return { level, levelMax, levelLabel: `Level ${level} - ${levelMax}` };
    }
  }
  return { level, levelMax: null, levelLabel: normalized };
}

function badgeImageUrl(src: string): string | null {
  try {
    const url = new URL(src, 'https://www.steamcardexchange.net');
    if (url.protocol !== 'https:') return null;
    if (!/\/images\/items\/\d+\//.test(url.pathname)) return null;
    return url.href;
  } catch {
    return null;
  }
}

function leafText(card: Element): string[] {
  return [...card.querySelectorAll('div')]
    .filter((div) => ![...div.children].some((child) => child instanceof HTMLDivElement))
    .map((div) => div.textContent?.trim() ?? '')
    .filter((text) => text.length > 0);
}

function nameFromAlt(alt: string): string {
  return alt.replace(/^Series\s+\d+\s+-\s+/i, '').trim();
}
