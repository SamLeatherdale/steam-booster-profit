import type { BadgeLevel } from './badges';

export interface BadgeTrack {
  owned: boolean;
  level: number | null;
}

export interface BadgeProgress {
  level: number;
  foil: boolean;
}

export interface BadgeRowIdentity {
  appid: number;
  series: number;
  foil: boolean;
}

const ROW_ID = /^badge_gamebadge_(\d+)_(\d+)_(\d+)$/;

export function parseBadgeRowId(id: string): BadgeRowIdentity | null {
  const match = ROW_ID.exec(id);
  if (!match?.[1] || !match[2] || !match[3]) return null;
  const appid = Number(match[1]);
  const series = Number(match[2]);
  const border = Number(match[3]);
  if (!Number.isSafeInteger(appid) || appid <= 0 || !Number.isInteger(series) || series < 1) return null;
  return { appid, series, foil: border === 1 };
}

export function gamecardsProgressUrls(href: string): { normal: string; foil: string } | null {
  let url: URL;
  try {
    url = new URL(href, 'https://steamcommunity.com');
  } catch {
    return null;
  }
  if (!/\/gamecards\/\d+/.test(url.pathname)) return null;
  url.hash = '';
  const normal = new URL(url.href);
  const foil = new URL(url.href);
  normal.searchParams.delete('border');
  foil.searchParams.set('border', '1');
  return { normal: normal.href, foil: foil.href };
}

export function readDisplayedBadge(root: ParentNode): BadgeTrack | null {
  const current = root.querySelector('.badge_current');
  if (!current) return null;
  const empty = current.querySelector('.badge_empty, .badge_empty_circle') != null;
  const match = /Level\s+(\d+)/i.exec(current.textContent ?? '');
  const level = match?.[1] ? Number(match[1]) : null;
  if (empty) return { owned: false, level: 0 };
  return { owned: true, level };
}

export function readGamecardsTrack(html: string): BadgeTrack | null {
  const document = new DOMParser().parseFromString(html, 'text/html');
  const details = document.querySelector('.gamecard_details');
  if (!details) return null;
  return readDisplayedBadge(details);
}

export function badgeProgressFromTracks(normal: BadgeTrack | null, foil: BadgeTrack | null): BadgeProgress | null {
  if (!normal && !foil) return null;
  return {
    level: normal?.owned ? (normal.level ?? 0) : 0,
    foil: foil?.owned ?? false,
  };
}

export function badgeIsOwned(level: Pick<BadgeLevel, 'level' | 'foil'>, progress: BadgeProgress | null): boolean {
  if (!progress) return false;
  if (level.foil) return progress.foil;
  return level.level <= progress.level;
}

export function nextBadgeLevel(
  levels: readonly BadgeLevel[],
  progress: BadgeProgress,
  foilPage: boolean,
): BadgeLevel | null {
  if (foilPage) {
    if (progress.foil) return null;
    return levels.find((level) => level.foil) ?? null;
  }
  return levels.find((level) => !level.foil && level.level === progress.level + 1) ?? null;
}
