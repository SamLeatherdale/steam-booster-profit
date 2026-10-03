import { describe, expect, it } from 'vitest';
import {
  buyerPriceForSellerReceives,
  formatLike,
  formatSignedLike,
  parseWalletCents,
  sellerReceivesFromBuyerPrice,
} from './prices';

describe('parseWalletCents', () => {
  it('parses AUD wallet labels', () => {
    expect(parseWalletCents('A$ 0.60')).toBe(60);
    expect(parseWalletCents('A$ 0.57')).toBe(57);
    expect(parseWalletCents('A$ 0.97')).toBe(97);
    expect(parseWalletCents('A$ 1,234.56')).toBe(123456);
  });

  it('parses comma-decimal labels and thousands separators', () => {
    expect(parseWalletCents('0,60€')).toBe(60);
    expect(parseWalletCents('1.234,56 €')).toBe(123456);
    expect(parseWalletCents('1,234')).toBe(123400);
  });

  it('rejects empty labels', () => {
    expect(parseWalletCents('')).toBeNull();
    expect(parseWalletCents('   ')).toBeNull();
    expect(parseWalletCents(null)).toBeNull();
  });
});

describe('Steam fees', () => {
  it('turns a buyer price into seller proceeds', () => {
    expect(sellerReceivesFromBuyerPrice(60)).toBe(53);
    expect(sellerReceivesFromBuyerPrice(57)).toBe(50);
    expect(sellerReceivesFromBuyerPrice(25)).toBe(22);
    expect(buyerPriceForSellerReceives(53)).toBe(60);
    expect(buyerPriceForSellerReceives(50)).toBe(57);
  });
});

describe('formatLike', () => {
  it('keeps the wallet prefix and decimal mark', () => {
    expect(formatLike(50, 'A$ 0.57')).toBe('A$ 0.50');
    expect(formatLike(50, '0,60€')).toBe('0,50€');
    expect(formatSignedLike(12, 'A$ 0.57')).toBe('+A$ 0.12');
    expect(formatSignedLike(-8, 'A$ 0.57')).toBe('-A$ 0.08');
  });
});
