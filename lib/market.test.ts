import { describe, expect, it } from 'vitest';
import { boosterMarketHash } from './hash';
import { loadMarketData, multibuyUrl } from './market';
import type { BoosterPack, FetchResult } from './types';

const packs: BoosterPack[] = [
  {
    appid: 220,
    name: 'Half-Life 2',
    series: 1,
    gems: 750,
    unavailable: false,
    availableAtTime: null,
  },
  {
    appid: 4000,
    name: 'Missing Game',
    series: 1,
    gems: 400,
    unavailable: true,
    availableAtTime: '4 Sep @ 7:06pm',
  },
];

function page(rows: string): string {
  return `<html>"wallet_currency":21,"wallet_country":"AU"<table>${rows}</table></html>`;
}

function buyRow(hash: string, price: string): string {
  return `<tr><td><a class="market_listing_item_name_link" href="https://steamcommunity.com/market/listings/753/${encodeURIComponent(hash)}">${hash}</a></td><td><input class="market_multi_price" name="buy_1_price" value="${price}" data-nameid="1" data-tooltip-text="listed"></td></tr>`;
}

function sellRow(hash: string, price: string): string {
  return `<tr><td><a class="market_listing_item_name_link" href="https://steamcommunity.com/market/listings/753/${encodeURIComponent(hash)}">${hash}</a></td><td><input class="market_multi_price_paid" value="${price}"></td></tr>`;
}

describe('loadMarketData', () => {
  it('splits a batch when one market hash does not exist', async () => {
    const requested: string[] = [];
    const fetchText = async (url: string): Promise<FetchResult> => {
      requested.push(url);
      const hashes = [...url.matchAll(/items\[\]=([^&]+)/g)].map((match) => decodeURIComponent(match[1] ?? ''));
      if (url.includes('priceoverview')) {
        return { status: 200, text: '{"success":true,"volume":"17"}' };
      }
      if (hashes.includes(boosterMarketHash(4000, 'Missing Game')) && hashes.length > 1) {
        return {
          status: 200,
          text: '<h3>The item "4000-Missing Game Booster Pack" does not exist on the market.</h3>',
        };
      }
      if (hashes.length === 1 && hashes[0] === boosterMarketHash(4000, 'Missing Game')) {
        return {
          status: 200,
          text: '<h3>The item "4000-Missing Game Booster Pack" does not exist on the market.</h3>',
        };
      }
      const rows = hashes
        .map((hash) => (url.includes('multisell') ? sellRow(hash, 'A$ 0.57') : buyRow(hash, 'A$ 0.60')))
        .join('');
      return { status: 200, text: page(rows) };
    };

    const cache = await loadMarketData({
      packs,
      cache: null,
      now: 1_000,
      fetchText,
      sleep: async () => {},
      batchSize: 40,
      volumeLimit: 1,
    });

    expect(cache.currency).toBe(21);
    expect(cache.country).toBe('AU');
    expect(cache.quotes['220']?.listCents).toBe(60);
    expect(cache.quotes['220']?.buyOrderCents).toBe(57);
    expect(cache.quotes['220']?.volume).toBe(17);
    expect(cache.quotes['4000']?.missing).toBe(true);
    expect(cache.quotes['sack']?.listLabel).toBe('A$ 0.60');
    expect(requested.some((url) => url.startsWith(multibuyUrl(['753-Sack of Gems']).slice(0, 48)))).toBe(true);
  });

  it('keeps a fresh cached quote and still refreshes stale ones', async () => {
    const seen: string[] = [];
    const cache = await loadMarketData({
      packs: [packs[0]!],
      cache: {
        currency: 21,
        country: 'AU',
        quotes: {
          '220': {
            listCents: 60,
            listLabel: 'A$ 0.60',
            buyOrderCents: 57,
            buyOrderLabel: 'A$ 0.57',
            volume: 9,
            missing: false,
            updatedAt: 90_000,
          },
        },
      },
      now: 100_000,
      fetchText: async (url) => {
        seen.push(url);
        const hashes = [...url.matchAll(/items\[\]=([^&]+)/g)].map((match) => decodeURIComponent(match[1] ?? ''));
        const rows = hashes
          .map((hash) => (url.includes('multisell') ? sellRow(hash, 'A$ 0.80') : buyRow(hash, 'A$ 0.97')))
          .join('');
        return { status: 200, text: page(rows) };
      },
      sleep: async () => {},
      volumeLimit: 0,
    });

    expect(cache.quotes['220']?.listCents).toBe(60);
    expect(cache.quotes['sack']?.buyOrderCents).toBe(80);
    expect(seen.every((url) => !url.includes('220-Half-Life'))).toBe(true);
  });
});
