export const SACK_OF_GEMS_HASH = '753-Sack of Gems';
export const GEMS_PER_SACK = 1000;
export const SACK_QUOTE_KEY = 'sack';

export function boosterMarketHash(appid: number, name: string): string {
  return `${appid}-${name.replaceAll('/', '-')} Booster Pack`;
}

export function appidFromMarketHash(marketHashName: string): number | null {
  if (!marketHashName.endsWith(' Booster Pack')) return null;
  const match = /^(\d+)-/.exec(marketHashName);
  if (!match?.[1]) return null;
  return Number(match[1]);
}
