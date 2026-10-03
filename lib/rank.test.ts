import { describe, expect, it } from 'vitest';
import { SACK_QUOTE_KEY } from './hash';
import { buildRows, filterAffordable, sortRows } from './rank';
import type { BoosterPack, MarketCache } from './types';

const halfLife: BoosterPack = {
  appid: 220,
  name: 'Half-Life 2',
  series: 1,
  gems: 750,
  unavailable: false,
  availableAtTime: null,
};

const cheap: BoosterPack = {
  appid: 4000,
  name: "Garry's Mod",
  series: 1,
  gems: 400,
  unavailable: false,
  availableAtTime: null,
};

function cache(): MarketCache {
  return {
    currency: 21,
    country: 'AU',
    quotes: {
      [SACK_QUOTE_KEY]: {
        listCents: 97,
        listLabel: 'A$ 0.97',
        buyOrderCents: 80,
        buyOrderLabel: 'A$ 0.80',
        volume: null,
        missing: false,
        updatedAt: 1,
      },
      '220': {
        listCents: 60,
        listLabel: 'A$ 0.60',
        buyOrderCents: 57,
        buyOrderLabel: 'A$ 0.57',
        volume: 17,
        missing: false,
        updatedAt: 1,
      },
      '4000': {
        listCents: 26,
        listLabel: 'A$ 0.26',
        buyOrderCents: null,
        buyOrderLabel: null,
        volume: null,
        missing: false,
        updatedAt: 1,
      },
    },
  };
}

describe('buildRows', () => {
  it('ranks by seller proceeds and compares them with selling the gems', () => {
    const [first] = buildRows([halfLife], cache());
    expect(first?.listCents).toBe(60);
    expect(first?.buyOrderCents).toBe(57);
    expect(first?.receiveCents).toBe(50);
    expect(first?.estimatedReceive).toBe(false);
    expect(first?.marketHashName).toBe('220-Half-Life 2 Booster Pack');
    expect(first?.versusSackCents).toBeLessThan(0);
  });

  it('estimates proceeds from the list price when there is no buy order', () => {
    const [row] = buildRows([cheap], cache());
    expect(row?.estimatedReceive).toBe(true);
    expect(row?.receiveCents).toBe(23);
  });
});

describe('filter and sort', () => {
  it('hides packs that cost more gems than the balance', () => {
    const rows = buildRows([halfLife, cheap], cache());
    expect(filterAffordable(rows, 561, true).map((row) => row.appid)).toEqual([4000]);
    expect(filterAffordable(rows, 561, false)).toHaveLength(2);
  });

  it('sorts higher proceeds per gem first and leaves unknown prices last', () => {
    const rows = buildRows([halfLife, cheap], cache());
    const sorted = sortRows(rows, 'perGem', -1);
    expect(sorted[0]?.appid).toBe(220);
  });
});
