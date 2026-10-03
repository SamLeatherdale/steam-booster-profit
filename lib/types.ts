export interface BoosterPack {
  appid: number;
  name: string;
  series: number;
  gems: number;
  unavailable: boolean;
  availableAtTime: string | null;
}

export interface Catalog {
  packs: BoosterPack[];
  goo: number;
  tradableGoo: number;
}

export interface CachedQuote {
  listCents: number | null;
  listLabel: string | null;
  buyOrderCents: number | null;
  buyOrderLabel: string | null;
  volume: number | null;
  missing: boolean;
  updatedAt: number;
}

export interface MarketCache {
  currency: number;
  country: string | null;
  quotes: Record<string, CachedQuote>;
}

export interface RankedPack {
  appid: number;
  name: string;
  series: number;
  gems: number;
  unavailable: boolean;
  availableAtTime: string | null;
  marketHashName: string;
  listCents: number | null;
  listLabel: string | null;
  buyOrderCents: number | null;
  buyOrderLabel: string | null;
  receiveCents: number | null;
  estimatedReceive: boolean;
  proceedsPerGem: number | null;
  sackValueCents: number | null;
  versusSackCents: number | null;
  volume: number | null;
  missing: boolean;
}

export type SortKey =
  | 'name'
  | 'gems'
  | 'buyOrder'
  | 'receive'
  | 'list'
  | 'perGem'
  | 'versusSack'
  | 'volume';

export interface FetchResult {
  status: number;
  text: string;
}
