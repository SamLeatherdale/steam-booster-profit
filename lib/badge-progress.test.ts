import { describe, expect, it } from 'vitest';
import type { BadgeLevel } from './badges';
import {
  badgeIsOwned,
  badgeProgressFromTracks,
  gamecardsProgressUrls,
  nextBadgeLevel,
  parseBadgeRowId,
  readDisplayedBadge,
  readGamecardsTrack,
} from './badge-progress';

const levels: BadgeLevel[] = [
  { level: 1, name: 'Beachcomber', imageUrl: 'https://example.test/1.png', foil: false },
  { level: 2, name: 'Trailblazer', imageUrl: 'https://example.test/2.png', foil: false },
  { level: 1, name: 'Lookout', imageUrl: 'https://example.test/foil.png', foil: true },
];

const gamecards = `
<div class="badge_content gamecard_details">
  <div class="badge_current">
    <div class="badge_info_title">Beachcomber Badge</div>
    <div>Level 2, 200 XP</div>
  </div>
  <div class="gamecard_badge_progress">
    <div class="badge_empty_circle"></div>
    <div class="badge_empty_name">Trailblazer Badge</div>
  </div>
</div>
`;

describe('badge progress', () => {
  it('reads a crafted level without treating the next-badge circle as unowned', () => {
    expect(readGamecardsTrack(gamecards)).toEqual({ owned: true, level: 2 });
    expect(readGamecardsTrack('<div class="badge_current">Level 5, 500 XP</div>')).toBeNull();
  });

  it('reads an empty badge as unowned', () => {
    document.body.innerHTML = `
      <div class="badge_current">
        <div class="badge_empty"><div class="badge_empty_circle"></div><div>100 XP</div></div>
      </div>`;
    expect(readDisplayedBadge(document.body)).toEqual({ owned: false, level: 0 });
  });

  it('keeps foil ownership separate from the regular level', () => {
    const progress = badgeProgressFromTracks({ owned: true, level: 2 }, { owned: false, level: 0 });
    expect(progress).toEqual({ level: 2, foil: false });
    expect(badgeIsOwned(levels[0]!, progress)).toBe(true);
    expect(badgeIsOwned(levels[1]!, progress)).toBe(true);
    expect(badgeIsOwned({ level: 3, foil: false }, progress)).toBe(false);
    expect(badgeIsOwned(levels[2]!, progress)).toBe(false);
    expect(badgeIsOwned(levels[2]!, { level: 2, foil: true })).toBe(true);
    expect(nextBadgeLevel(levels, { level: 1, foil: false }, false)?.name).toBe('Trailblazer');
    expect(nextBadgeLevel(levels, { level: 2, foil: false }, true)?.name).toBe('Lookout');
    expect(nextBadgeLevel(levels, { level: 2, foil: true }, true)).toBeNull();
  });

  it('parses game badge rows and the normal and foil progress urls', () => {
    expect(parseBadgeRowId('badge_gamebadge_3527290_1_0')).toEqual({ appid: 3527290, series: 1, foil: false });
    expect(parseBadgeRowId('badge_gamebadge_383870_1_1')?.foil).toBe(true);
    expect(parseBadgeRowId('badge_badge_1')).toBeNull();
    expect(gamecardsProgressUrls('https://steamcommunity.com/id/kevin2027/gamecards/3527290/?border=1')).toEqual({
      normal: 'https://steamcommunity.com/id/kevin2027/gamecards/3527290/',
      foil: 'https://steamcommunity.com/id/kevin2027/gamecards/3527290/?border=1',
    });
    expect(gamecardsProgressUrls('https://steamcommunity.com/id/kevin2027/badges')).toBeNull();
  });
});
