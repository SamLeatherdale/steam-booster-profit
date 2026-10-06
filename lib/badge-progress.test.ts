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
  { level: 1, levelMax: 1, levelLabel: 'Level 1', name: 'Beachcomber', imageUrl: 'https://example.test/1.png', foil: false },
  { level: 2, levelMax: 2, levelLabel: 'Level 2', name: 'Trailblazer', imageUrl: 'https://example.test/2.png', foil: false },
  { level: 1, levelMax: 1, levelLabel: 'Level 1', name: 'Lookout', imageUrl: 'https://example.test/foil.png', foil: true },
];

const saleLevels: BadgeLevel[] = [
  { level: 9, levelMax: 9, levelLabel: 'Level 9', name: 'Nine', imageUrl: 'https://example.test/9.png', foil: false },
  { level: 10, levelMax: 14, levelLabel: 'Level 10 - 14', name: 'Ten', imageUrl: 'https://example.test/10.png', foil: false },
  { level: 15, levelMax: 29, levelLabel: 'Level 15 - 29', name: 'Fifteen', imageUrl: 'https://example.test/15.png', foil: false },
  { level: 1000, levelMax: null, levelLabel: 'Level 1000+', name: 'Thousand', imageUrl: 'https://example.test/1000.png', foil: false },
  { level: 15000, levelMax: null, levelLabel: 'Level 15000 - ???', name: 'Top', imageUrl: 'https://example.test/15000.png', foil: false },
  { level: 1, levelMax: 4, levelLabel: 'Level 1 - 4', name: 'Foil low', imageUrl: 'https://example.test/foil-low.png', foil: true },
  { level: 5, levelMax: null, levelLabel: 'Level 5 - ??', name: 'Foil high', imageUrl: 'https://example.test/foil-high.png', foil: true },
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
    expect(progress).toEqual({ level: 2, foil: false, foilLevel: 0 });
    expect(badgeIsOwned(levels[0]!, progress)).toBe(true);
    expect(badgeIsOwned(levels[1]!, progress)).toBe(true);
    expect(badgeIsOwned({ level: 3, foil: false }, progress)).toBe(false);
    expect(badgeIsOwned(levels[2]!, progress)).toBe(false);
    expect(badgeIsOwned(levels[2]!, { level: 2, foil: true, foilLevel: 1 })).toBe(true);
    expect(nextBadgeLevel(levels, { level: 1, foil: false, foilLevel: 0 }, false)?.name).toBe('Trailblazer');
    expect(nextBadgeLevel(levels, { level: 2, foil: false, foilLevel: 0 }, true)?.name).toBe('Lookout');
    expect(nextBadgeLevel(levels, { level: 2, foil: true, foilLevel: 1 }, true)).toBeNull();
  });

  it('follows level ranges when the next craft stays on the same artwork', () => {
    const midway = { level: 12, foil: true, foilLevel: 2 };
    expect(badgeIsOwned(saleLevels[1]!, midway)).toBe(true);
    expect(badgeIsOwned(saleLevels[2]!, midway)).toBe(false);
    expect(badgeIsOwned(saleLevels[5]!, midway)).toBe(true);
    expect(badgeIsOwned(saleLevels[6]!, midway)).toBe(false);
    expect(nextBadgeLevel(saleLevels, { level: 12, foil: false, foilLevel: 0 }, false)?.name).toBe('Ten');
    expect(nextBadgeLevel(saleLevels, { level: 14, foil: false, foilLevel: 0 }, false)?.name).toBe('Fifteen');
    expect(nextBadgeLevel(saleLevels, { level: 5000, foil: false, foilLevel: 0 }, false)?.name).toBe('Thousand');
    expect(nextBadgeLevel(saleLevels, { level: 14999, foil: false, foilLevel: 0 }, false)?.name).toBe('Top');
    expect(nextBadgeLevel(saleLevels, { level: 4, foil: true, foilLevel: 4 }, true)?.name).toBe('Foil high');
    expect(nextBadgeLevel(saleLevels, { level: 1, foil: true, foilLevel: 2 }, true)?.name).toBe('Foil low');
    const unknownFoil = badgeProgressFromTracks({ owned: true, level: 2 }, { owned: true, level: null });
    expect(unknownFoil).toEqual({ level: 2, foil: true, foilLevel: null });
    expect(badgeIsOwned(saleLevels[6]!, unknownFoil)).toBe(true);
    expect(nextBadgeLevel(saleLevels, unknownFoil!, true)).toBeNull();
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
