import { SACK_OF_GEMS_HASH, SACK_QUOTE_KEY, boosterMarketHash } from './hash';
import {
  isMissingItemPage,
  parseMultibuy,
  parseMultisell,
  parsePriceOverview,
  readWallet,
  type BuyOrderQuote,
  type ListingQuote,
} from './parse';
import { buildRows } from './rank';
import type { BoosterPack, CachedQuote, FetchResult, MarketCache } from './types';

export const BATCH_SIZE = 40;
export const REQUEST_GAP_MS = 1200;
export const RATE_LIMIT_WAIT_MS = 15_000;
export const CACHE_TTL_MS = 30 * 60 * 1000;
export const VOLUME_LIMIT = 25;

export interface LoadProgress {
  phase: 'listings' | 'buy-orders' | 'volume';
  completed: number;
  total: number;
}

export function isFresh(quote: CachedQuote | undefined, now: number, ttl = CACHE_TTL_MS): boolean {
  return quote != null && now - quote.updatedAt < ttl;
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size <= 0) throw new Error('Batch size must be positive');
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

export function multibuyUrl(hashes: readonly string[]): string {
  const items = hashes.map((hash) => `items[]=${encodeURIComponent(hash)}`).join('&');
  return `https://steamcommunity.com/market/multibuy?appid=753&${items}&l=english`;
}

export function multisellUrl(hashes: readonly string[]): string {
  const items = hashes.map((hash) => `items[]=${encodeURIComponent(hash)}&qty[]=0`).join('&');
  return `https://steamcommunity.com/market/multisell?appid=753&contextid=6&${items}&l=english`;
}

export function priceOverviewUrl(currency: number, marketHashName: string): string {
  const params = new URLSearchParams({
    appid: '753',
    currency: String(currency),
    market_hash_name: marketHashName,
  });
  return `https://steamcommunity.com/market/priceoverview/?${params.toString()}`;
}

interface LoadOptions {
  packs: readonly BoosterPack[];
  cache: MarketCache | null;
  now: number;
  fetchText: (url: string) => Promise<FetchResult>;
  sleep: (ms: number) => Promise<void>;
  onProgress?: (progress: LoadProgress) => void;
  onUpdate?: (cache: MarketCache) => void;
  volumeLimit?: number;
  batchSize?: number;
  retriedCurrency?: boolean;
}

async function fetchMarketText(
  url: string,
  fetchText: (url: string) => Promise<FetchResult>,
  sleep: (ms: number) => Promise<void>,
  attempt = 0,
): Promise<string> {
  const result = await fetchText(url);
  if (result.status === 429 && attempt < 4) {
    await sleep(RATE_LIMIT_WAIT_MS * (attempt + 1));
    return fetchMarketText(url, fetchText, sleep, attempt + 1);
  }
  if (result.status >= 500 && attempt < 3) {
    await sleep(REQUEST_GAP_MS * (attempt + 1));
    return fetchMarketText(url, fetchText, sleep, attempt + 1);
  }
  if (result.status !== 200) {
    throw new Error(`Steam market request failed (${result.status})`);
  }
  return result.text;
}

function blankQuote(now: number, missing: boolean, volume: number | null): CachedQuote {
  return {
    listCents: null,
    listLabel: null,
    buyOrderCents: null,
    buyOrderLabel: null,
    volume,
    missing,
    updatedAt: now,
  };
}

export async function loadMarketData(options: LoadOptions): Promise<MarketCache> {
  const batchSize = options.batchSize ?? BATCH_SIZE;
  const volumeLimit = options.volumeLimit ?? VOLUME_LIMIT;
  const quotes: Record<string, CachedQuote> = { ...(options.cache?.quotes ?? {}) };
  let currency = options.cache?.currency ?? 0;
  let country = options.cache?.country ?? null;
  let spaced = false;

  const hashByKey = new Map<string, string>([[SACK_QUOTE_KEY, SACK_OF_GEMS_HASH]]);
  for (const pack of options.packs) {
    hashByKey.set(String(pack.appid), boosterMarketHash(pack.appid, pack.name));
  }

  const staleKeys = [...hashByKey.keys()].filter((key) => !isFresh(quotes[key], options.now));
  const staleHashes = staleKeys.flatMap((key) => {
    const hash = hashByKey.get(key);
    return hash ? [hash] : [];
  });

  const snapshot = (): MarketCache => ({ currency, country, quotes: { ...quotes } });

  const noteWallet = (html: string): void => {
    const wallet = readWallet(html);
    if (wallet.currency) currency = wallet.currency;
    if (wallet.country) country = wallet.country;
  };

  const nextText = async (url: string): Promise<string> => {
    if (spaced) await options.sleep(REQUEST_GAP_MS);
    spaced = true;
    return fetchMarketText(url, options.fetchText, options.sleep);
  };

  async function loadGroups<T extends { marketHashName: string }>(
    hashes: readonly string[],
    phase: 'listings' | 'buy-orders',
    urlFor: (group: readonly string[]) => string,
    parse: (html: string) => T[],
  ): Promise<Map<string, T>> {
    const found = new Map<string, T>();
    const batches = chunk(hashes, batchSize);
    let completed = 0;
    const progressTotal = { value: batches.length };

    const loadGroup = async (group: readonly string[]): Promise<void> => {
      if (group.length === 0) return;
      const html = await nextText(urlFor(group));
      noteWallet(html);
      const parsed = parse(html);
      if (parsed.length === 0 && isMissingItemPage(html)) {
        if (group.length === 1) return;
        progressTotal.value += 2;
        const mid = Math.ceil(group.length / 2);
        await loadGroup(group.slice(0, mid));
        await loadGroup(group.slice(mid));
        return;
      }
      if (parsed.length === 0) {
        throw new Error('Steam market page did not include prices');
      }
      for (const quote of parsed) found.set(quote.marketHashName, quote);
      completed += 1;
      options.onProgress?.({ phase, completed, total: progressTotal.value });
    };

    for (const batch of batches) await loadGroup(batch);
    return found;
  }

  if (staleHashes.length > 0) {
    const listings = await loadGroups(staleHashes, 'listings', multibuyUrl, parseMultibuy);
    const orders = await loadGroups(staleHashes, 'buy-orders', multisellUrl, parseMultisell);

    if (
      !options.retriedCurrency &&
      options.cache &&
      options.cache.currency > 0 &&
      currency > 0 &&
      options.cache.currency !== currency
    ) {
      return loadMarketData({ ...options, cache: null, retriedCurrency: true });
    }

    for (const key of staleKeys) {
      const hash = hashByKey.get(key);
      if (!hash) continue;
      const listing = listings.get(hash);
      const order = orders.get(hash);
      const previous = quotes[key];
      if (!listing && !order) {
        quotes[key] = blankQuote(options.now, true, previous?.volume ?? null);
        continue;
      }
      quotes[key] = mergeQuote(previous, listing, order, options.now);
    }
    options.onUpdate?.(snapshot());
  }

  if (currency > 0) {
    const ranked = buildRows(options.packs, snapshot())
      .filter((row) => row.receiveCents != null && !row.missing)
      .sort((left, right) => (right.proceedsPerGem ?? 0) - (left.proceedsPerGem ?? 0))
      .slice(0, volumeLimit);

    let completed = 0;
    for (const row of ranked) {
      const key = String(row.appid);
      const quote = quotes[key];
      if (!quote || quote.volume != null) continue;
      const body = await nextText(priceOverviewUrl(currency, row.marketHashName));
      const overview = parsePriceOverview(body);
      if (overview.success && overview.volume != null) {
        quotes[key] = { ...quote, volume: overview.volume };
        options.onUpdate?.(snapshot());
      }
      completed += 1;
      options.onProgress?.({ phase: 'volume', completed, total: ranked.length });
    }
  }

  return snapshot();
}

function mergeQuote(
  previous: CachedQuote | undefined,
  listing: ListingQuote | undefined,
  order: BuyOrderQuote | undefined,
  now: number,
): CachedQuote {
  return {
    listCents: listing ? listing.buyerCents : (previous?.listCents ?? null),
    listLabel: listing ? listing.buyerLabel : (previous?.listLabel ?? null),
    buyOrderCents: order ? order.buyerCents : (previous?.buyOrderCents ?? null),
    buyOrderLabel: order ? order.buyerLabel : (previous?.buyOrderLabel ?? null),
    volume: previous?.volume ?? null,
    missing: false,
    updatedAt: now,
  };
}
