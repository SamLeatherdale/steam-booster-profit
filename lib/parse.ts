import { appidFromMarketHash } from './hash';
import { parseWalletCents } from './prices';

export interface ListingQuote {
  marketHashName: string;
  appid: number | null;
  buyerCents: number | null;
  buyerLabel: string | null;
  nameid: string | null;
}

export interface BuyOrderQuote {
  marketHashName: string;
  appid: number | null;
  buyerCents: number | null;
  buyerLabel: string | null;
}

export interface WalletInfo {
  currency: number | null;
  country: string | null;
}

export interface PriceOverview {
  success: boolean;
  volume: number | null;
}

export function isMissingItemPage(html: string): boolean {
  return /does not exist on the market/i.test(html);
}

export function readWallet(html: string): WalletInfo {
  const currency = /"wallet_currency":(\d+)/.exec(html);
  const country = /"wallet_country":"([A-Z]{2})"/.exec(html);
  return {
    currency: currency?.[1] ? Number(currency[1]) : null,
    country: country?.[1] ?? null,
  };
}

function marketHashFromHref(href: string): string | null {
  const marker = '/market/listings/753/';
  const index = href.indexOf(marker);
  if (index === -1) return null;
  const encoded = href.slice(index + marker.length).split('?')[0] ?? '';
  if (!encoded) return null;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return encoded;
  }
}

export function parseMultibuy(html: string): ListingQuote[] {
  const document = new DOMParser().parseFromString(html, 'text/html');
  const quotes: ListingQuote[] = [];
  for (const input of document.querySelectorAll('input.market_multi_price')) {
    if (!(input instanceof HTMLInputElement)) continue;
    if (input.classList.contains('market_multi_price_paid')) continue;
    if (input.classList.contains('market_multi_price_recv')) continue;
    const row = input.closest('tr');
    const link = row?.querySelector('a.market_listing_item_name_link');
    const hash = marketHashFromHref(link?.getAttribute('href') ?? '');
    if (!hash) continue;
    const listed = input.hasAttribute('data-tooltip-text') && input.value.trim() !== '';
    const nameid = input.dataset['nameid'] ?? /buy_(\d+)_price/.exec(input.name)?.[1] ?? null;
    quotes.push({
      marketHashName: hash,
      appid: appidFromMarketHash(hash),
      buyerCents: listed ? parseWalletCents(input.value) : null,
      buyerLabel: listed ? input.value.trim() : null,
      nameid,
    });
  }
  return quotes;
}

export function parseMultisell(html: string): BuyOrderQuote[] {
  const document = new DOMParser().parseFromString(html, 'text/html');
  const quotes: BuyOrderQuote[] = [];
  for (const input of document.querySelectorAll('input.market_multi_price_paid')) {
    if (!(input instanceof HTMLInputElement)) continue;
    const row = input.closest('tr');
    const link = row?.querySelector('a.market_listing_item_name_link');
    const hash = marketHashFromHref(link?.getAttribute('href') ?? '');
    if (!hash) continue;
    const label = input.value.trim();
    quotes.push({
      marketHashName: hash,
      appid: appidFromMarketHash(hash),
      buyerCents: label ? parseWalletCents(label) : null,
      buyerLabel: label || null,
    });
  }
  return quotes;
}

export function parsePriceOverview(body: string): PriceOverview {
  let data: { success?: boolean; volume?: string };
  try {
    data = JSON.parse(body) as { success?: boolean; volume?: string };
  } catch {
    return { success: false, volume: null };
  }
  if (!data.success) return { success: false, volume: null };
  if (!data.volume) return { success: true, volume: 0 };
  const volume = Number(data.volume.replace(/[^\d]/g, ''));
  return { success: true, volume: Number.isFinite(volume) ? volume : null };
}
