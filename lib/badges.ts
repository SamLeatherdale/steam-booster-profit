import { formatLike, parseWalletCents } from './prices';

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

export interface BadgeSetPrices {
  regular: string | null;
  foil: string | null;
}

export interface BadgePreview {
  levels: BadgeLevel[];
  prices: BadgeSetPrices;
}

export interface BadgePriceSnapshot {
  updatedAt: number;
  series: Record<string, BadgeSetPrices>;
}

export interface BadgeCatalog {
  cards: Record<string, number>;
  series: Record<string, BadgeLevel[]>;
}

export interface BadgeCatalogStore {
  read(appid: number): Promise<BadgeCatalog | null>;
  write(appid: number, catalog: BadgeCatalog): Promise<void>;
  readPrices?(appid: number): Promise<BadgePriceSnapshot | null>;
  writePrices?(appid: number, snapshot: BadgePriceSnapshot): Promise<void>;
}

export const BADGE_PRICE_TTL_MS = 30 * 60 * 1000;

const EMPTY_PRICES: BadgeSetPrices = { regular: null, foil: null };

export function badgePriceKey(appid: number): string {
  return `badge-prices-v1:${appid}`;
}

export function badgePriceCaption(prices: BadgeSetPrices): string {
  const parts: string[] = [];
  if (prices.regular) parts.push(`Regular ${prices.regular}`);
  if (prices.foil) parts.push(`Foil ${prices.foil}`);
  return parts.join(' · ');
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
  const section = sectionAfter(document.getElementById(`series-${series}-${foil ? 'foilbadges' : 'badges'}`));
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
  const series = matchingSeries(catalog, request);
  return series ? (catalog.series[series] ?? []) : [];
}

export function selectCatalogPreview(
  catalog: BadgeCatalog,
  prices: Record<string, BadgeSetPrices>,
  request: Pick<BadgeRequest, 'seriesHint' | 'cardName'>,
): BadgePreview {
  const series = matchingSeries(catalog, request);
  return {
    levels: series ? (catalog.series[series] ?? []) : [],
    prices: (series && prices[series]) || EMPTY_PRICES,
  };
}

export function extractBadgePrices(html: string): Record<string, BadgeSetPrices> {
  const document = new DOMParser().parseFromString(html, 'text/html');
  const seriesNumbers = new Set<number>();
  for (const node of document.querySelectorAll('[id^="series-"]')) {
    const match = /^series-(\d+)-(?:foil)?cards$/.exec(node.id);
    const series = Number(match?.[1]);
    if (Number.isInteger(series) && series >= 1) seriesNumbers.add(series);
  }

  const prices: Record<string, BadgeSetPrices> = {};
  for (const series of [...seriesNumbers].sort((left, right) => left - right)) {
    const regular = sumCardPrices(document, `series-${series}-cards`);
    const foil = sumCardPrices(document, `series-${series}-foilcards`);
    if (regular || foil) prices[String(series)] = { regular, foil };
  }
  return prices;
}

export function readBadgePriceSnapshot(value: unknown): BadgePriceSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as { updatedAt?: unknown; series?: unknown };
  if (typeof record.updatedAt !== 'number' || !Number.isFinite(record.updatedAt)) return null;
  if (!record.series || typeof record.series !== 'object' || Array.isArray(record.series)) return null;

  const series: Record<string, BadgeSetPrices> = {};
  for (const [key, prices] of Object.entries(record.series as Record<string, unknown>)) {
    if (!/^[1-9]\d*$/.test(key)) return null;
    const parsed = readSetPrices(prices);
    if (!parsed) return null;
    series[key] = parsed;
  }
  return { updatedAt: record.updatedAt, series };
}

export function createBadgeLoader(
  fetchText: (url: string) => Promise<string>,
  store?: BadgeCatalogStore,
  now: () => number = Date.now,
): {
  load(request: BadgeRequest): Promise<BadgePreview>;
} {
  const bundles = new Map<number, Promise<BadgeBundle>>();
  const previews = new Map<string, BadgePreview>();

  return {
    async load(request) {
      const key = badgeRequestKey(request);
      const cached = previews.get(key);
      if (cached) return cached;

      let bundle = bundles.get(request.appid);
      if (!bundle) {
        bundle = loadBundle(request.appid, fetchText, store, now).catch((error: unknown) => {
          bundles.delete(request.appid);
          throw error;
        });
        bundles.set(request.appid, bundle);
      }

      const loaded = await bundle;
      const preview = selectCatalogPreview(loaded.catalog, loaded.prices, request);
      if (preview.levels.length > 0) previews.set(key, preview);
      return preview;
    },
  };
}

async function loadBundle(
  appid: number,
  fetchText: (url: string) => Promise<string>,
  store: BadgeCatalogStore | undefined,
  now: () => number,
): Promise<BadgeBundle> {
  let storedCatalog: BadgeCatalog | null = null;
  let storedPrices: BadgePriceSnapshot | null = null;
  if (store) {
    try {
      storedCatalog = await store.read(appid);
    } catch {
      // Storage can be unavailable. The network result is still shown.
    }
    if (store.readPrices) {
      try {
        storedPrices = await store.readPrices(appid);
      } catch {
        // A bad price cache should not hide badge artwork.
      }
    }
  }

  const pricesFresh = storedPrices != null && now() - storedPrices.updatedAt < BADGE_PRICE_TTL_MS;
  if (storedCatalog && (pricesFresh || !store?.readPrices)) {
    return { catalog: storedCatalog, prices: storedPrices?.series ?? {} };
  }

  let html: string;
  try {
    html = await fetchText(cardExchangeGameUrl(appid));
  } catch (error) {
    if (storedCatalog) return { catalog: storedCatalog, prices: storedPrices?.series ?? {} };
    throw error;
  }

  const catalog = storedCatalog ?? extractBadgeCatalog(html);
  const prices = extractBadgePrices(html);
  if (store && !storedCatalog && Object.keys(catalog.series).length > 0) {
    try {
      await store.write(appid, catalog);
    } catch {
      // A full extension quota should not hide badges that were just fetched.
    }
  }
  if (store?.writePrices) {
    try {
      await store.writePrices(appid, { updatedAt: now(), series: prices });
    } catch {
      // Prices can be shown for this visit even when they cannot be saved.
    }
  }
  return { catalog, prices };
}

interface BadgeBundle {
  catalog: BadgeCatalog;
  prices: Record<string, BadgeSetPrices>;
}

function matchingSeries(catalog: BadgeCatalog, request: Pick<BadgeRequest, 'seriesHint' | 'cardName'>): string | null {
  const seriesNumbers: number[] = [];
  const add = (series: number | null): void => {
    if (series == null || !Number.isInteger(series) || series < 1 || seriesNumbers.includes(series)) return;
    seriesNumbers.push(series);
  };
  add(catalog.cards[request.cardName.trim().toLowerCase()] ?? null);
  add(request.seriesHint);
  add(1);
  for (const series of seriesNumbers) {
    const key = String(series);
    const levels = catalog.series[key];
    if (levels && levels.length > 0) return key;
  }
  return null;
}

function sectionAfter(anchor: HTMLElement | null): Element | null {
  if (!anchor) return null;
  let section = anchor.parentElement?.nextElementSibling ?? null;
  for (let step = 0; section && step < 3 && section.querySelector('img') == null; step += 1) {
    section = section.nextElementSibling;
  }
  return section;
}

function sumCardPrices(document: Document, id: string): string | null {
  const section = sectionAfter(document.getElementById(id));
  if (!section) return null;
  const cents: number[] = [];
  let sample: string | null = null;
  for (const card of section.children) {
    const line = [...card.querySelectorAll('a')]
      .map((link) => link.textContent?.trim().replace(/\s+/g, ' ') ?? '')
      .find((text) => /^Price:/i.test(text));
    if (!line) continue;
    const amount = line.replace(/^Price:\s*/i, '').trim();
    const value = parseWalletCents(amount);
    if (value == null) return null;
    sample ??= amount;
    cents.push(value);
  }
  if (!sample || cents.length === 0) return null;
  return formatLike(
    cents.reduce((sum, value) => sum + value, 0),
    sample,
  );
}

function readSetPrices(value: unknown): BadgeSetPrices | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as { regular?: unknown; foil?: unknown };
  const regular = readPriceLabel(record.regular);
  const foil = readPriceLabel(record.foil);
  if (regular === undefined || foil === undefined) return null;
  return { regular, foil };
}

function readPriceLabel(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 32 || parseWalletCents(trimmed) == null) return undefined;
  return trimmed;
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
