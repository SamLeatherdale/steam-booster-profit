import { GEMS_PER_SACK, SACK_QUOTE_KEY, boosterMarketHash } from './hash';
import { sellerReceivesFromBuyerPrice } from './prices';
import type { BoosterPack, MarketCache, RankedPack, SortKey } from './types';

export function receiveForQuote(
  buyOrderCents: number | null,
  listCents: number | null,
): { receiveCents: number | null; estimatedReceive: boolean } {
  if (buyOrderCents != null && buyOrderCents > 0) {
    return { receiveCents: sellerReceivesFromBuyerPrice(buyOrderCents), estimatedReceive: false };
  }
  if (listCents != null && listCents > 0) {
    return { receiveCents: sellerReceivesFromBuyerPrice(listCents), estimatedReceive: true };
  }
  return { receiveCents: null, estimatedReceive: false };
}

export function buildRows(packs: readonly BoosterPack[], cache: MarketCache): RankedPack[] {
  const sack = cache.quotes[SACK_QUOTE_KEY];
  const sackReceive = sack ? receiveForQuote(sack.buyOrderCents, sack.listCents).receiveCents : null;

  return packs.map((pack) => {
    const quote = cache.quotes[String(pack.appid)];
    const listCents = quote?.listCents ?? null;
    const buyOrderCents = quote?.buyOrderCents ?? null;
    const { receiveCents, estimatedReceive } = quote
      ? receiveForQuote(buyOrderCents, listCents)
      : { receiveCents: null, estimatedReceive: false };
    const proceedsPerGem = receiveCents != null && pack.gems > 0 ? receiveCents / pack.gems : null;
    const sackValueCents =
      sackReceive != null ? Math.round((pack.gems * sackReceive) / GEMS_PER_SACK) : null;
    const versusSackCents =
      receiveCents != null && sackValueCents != null ? receiveCents - sackValueCents : null;

    return {
      ...pack,
      marketHashName: boosterMarketHash(pack.appid, pack.name),
      listCents,
      listLabel: quote?.listLabel ?? null,
      buyOrderCents,
      buyOrderLabel: quote?.buyOrderLabel ?? null,
      receiveCents,
      estimatedReceive,
      proceedsPerGem,
      sackValueCents,
      versusSackCents,
      volume: quote?.volume ?? null,
      missing: quote?.missing ?? false,
    };
  });
}

function numericValue(row: RankedPack, key: SortKey): number | null {
  switch (key) {
    case 'name':
      return null;
    case 'gems':
      return row.gems;
    case 'buyOrder':
      return row.buyOrderCents;
    case 'receive':
      return row.receiveCents;
    case 'list':
      return row.listCents;
    case 'perGem':
      return row.proceedsPerGem;
    case 'versusSack':
      return row.versusSackCents;
    case 'volume':
      return row.volume;
  }
}

export function sortRows(rows: readonly RankedPack[], key: SortKey, direction: 1 | -1): RankedPack[] {
  return [...rows].sort((left, right) => {
    if (key === 'name') return left.name.localeCompare(right.name) * direction;
    const leftValue = numericValue(left, key);
    const rightValue = numericValue(right, key);
    if (leftValue == null && rightValue == null) return left.name.localeCompare(right.name);
    if (leftValue == null) return 1;
    if (rightValue == null) return -1;
    if (leftValue === rightValue) return left.name.localeCompare(right.name);
    return (leftValue - rightValue) * direction;
  });
}

export function filterAffordable(
  rows: readonly RankedPack[],
  goo: number,
  affordableOnly: boolean,
): RankedPack[] {
  if (!affordableOnly) return [...rows];
  return rows.filter((row) => row.gems <= goo);
}
