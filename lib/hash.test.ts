import { describe, expect, it } from 'vitest';
import { boosterMarketHash } from './hash';

describe('boosterMarketHash', () => {
  it('keeps apostrophes, trademarks, and trailing spaces, and replaces slashes', () => {
    expect(boosterMarketHash(4000, "Garry's Mod")).toBe("4000-Garry's Mod Booster Pack");
    expect(boosterMarketHash(202170, 'Sleeping Dogs™')).toBe('202170-Sleeping Dogs™ Booster Pack');
    expect(boosterMarketHash(4570, 'Warhammer 40,000: Dawn of War - Anniversary Edition ')).toBe(
      '4570-Warhammer 40,000: Dawn of War - Anniversary Edition  Booster Pack',
    );
    expect(boosterMarketHash(1, 'A/B')).toBe('1-A-B Booster Pack');
  });
});
