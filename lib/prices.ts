const STEAM_FEE_RATE = 0.05;
const PUBLISHER_FEE_RATE = 0.1;

/**
 * Steam wallet labels use either a dot or a comma as the decimal mark.
 * A lone separator followed by exactly three digits is a thousands separator.
 */
export function parseWalletCents(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const numeric = raw.trim().replace(/[^\d,.-]/g, '');
  if (!/\d/.test(numeric)) return null;

  const lastComma = numeric.lastIndexOf(',');
  const lastDot = numeric.lastIndexOf('.');
  const lastSeparator = Math.max(lastComma, lastDot);
  let normalized = numeric;

  if (lastSeparator !== -1) {
    const fractionLength = numeric.length - lastSeparator - 1;
    const decimalSeparator = lastComma > lastDot ? ',' : '.';
    const thousandsSeparator = decimalSeparator === ',' ? '.' : ',';
    const onlyOneSeparator = lastComma === -1 || lastDot === -1;
    if (onlyOneSeparator && fractionLength === 3) {
      normalized = numeric.replaceAll(decimalSeparator, '');
    } else {
      normalized = numeric.replaceAll(thousandsSeparator, '').replace(decimalSeparator, '.');
    }
  }

  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

export function buyerPriceForSellerReceives(receiveCents: number): number {
  if (receiveCents <= 0) return 0;
  const steamFee = Math.max(Math.floor(receiveCents * STEAM_FEE_RATE), 1);
  const publisherFee = Math.max(Math.floor(receiveCents * PUBLISHER_FEE_RATE), 1);
  return receiveCents + steamFee + publisherFee;
}

/** Buyer-facing cents to the amount the seller receives after Steam and publisher fees. */
export function sellerReceivesFromBuyerPrice(buyerCents: number): number {
  if (buyerCents <= 0) return 0;
  let receive = buyerCents;
  while (receive > 0 && buyerPriceForSellerReceives(receive) > buyerCents) {
    receive -= 1;
  }
  return receive;
}

export function formatLike(cents: number, sampleLabel: string | null): string {
  const negative = cents < 0;
  const absolute = Math.abs(cents);
  const body = `${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`;
  if (!sampleLabel) return `${negative ? '-' : ''}${body}`;

  const match = /^(\D*)[\d.,]+(\D*)$/.exec(sampleLabel.trim());
  const prefix = match?.[1] ?? '';
  const suffix = match?.[2] ?? '';
  const numeric = sampleLabel.replace(/[^\d,.]/g, '');
  const commaDecimal = numeric.lastIndexOf(',') > numeric.lastIndexOf('.');
  const formatted = commaDecimal ? body.replace('.', ',') : body;
  return `${negative ? '-' : ''}${prefix}${formatted}${suffix}`;
}

export function formatSignedLike(cents: number, sampleLabel: string | null): string {
  const formatted = formatLike(cents, sampleLabel);
  return cents > 0 ? `+${formatted}` : formatted;
}
