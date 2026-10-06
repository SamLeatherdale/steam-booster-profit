import { describe, expect, it, vi } from 'vitest';
import {
  BADGE_PAGE_MESSAGE,
  appidFromGamecardsHref,
  stepBadgeIndex,
  BADGE_PRICE_TTL_MS,
  badgeCatalogKey,
  badgeLevelCaption,
  badgePriceCaption,
  badgePriceKey,
  badgeRequestKey,
  createBadgeLoader,
  extractBadgeCatalog,
  extractBadgePrices,
  readBadgePriceSnapshot,
  parseCardExchangeBadges,
  readBadgeCatalog,
  readBadgePageAppid,
  readBadgePageHtml,
  readBadgeRequest,
  selectBadgeLevels,
  seriesForCardName,
} from './badges';

const pricedCards = `
<div class="header"><span id="series-1-cards"></span></div>
<div class="grid">
  <div>
    <img src="https://steamcdn-a.akamaihd.net/steamcommunity/public/images/items/1658760/card-a.png" alt="Series 1 - Card 1 of 2 - Action">
    <a>Price: $0.07</a>
  </div>
  <div>
    <img src="https://steamcdn-a.akamaihd.net/steamcommunity/public/images/items/1658760/card-b.png" alt="Series 1 - Card 2 of 2 - Adventure">
    <a>Price: $0.06</a>
  </div>
</div>
<div class="header"><span id="series-1-foilcards"></span></div>
<div class="grid">
  <div>
    <img src="https://steamcdn-a.akamaihd.net/steamcommunity/public/images/items/1658760/foil-a.png" alt="Series 1 - Card 1 of 2 - Action">
    <a>Price: €1,20</a>
  </div>
  <div>
    <img src="https://steamcdn-a.akamaihd.net/steamcommunity/public/images/items/1658760/foil-b.png" alt="Series 1 - Card 2 of 2 - Adventure">
    <a>Price: €0,30</a>
  </div>
</div>
<div class="header"><span id="series-1-badges"></span></div>
<div class="grid">
  <div>
    <img src="https://steamcdn-a.akamaihd.net/steamcommunity/public/images/items/1658760/lvl1.png" alt="Series 1 - Level 1">
    <div>Level One</div>
    <div><div>Level 1</div></div>
  </div>
</div>
`;

const summerSale = `
<div class="header"><span id="series-1-badges"></span></div>
<div class="grid">
  <div>
    <img src="https://steamcdn-a.akamaihd.net/steamcommunity/public/images/items/1658760/lvl9.png" alt="Series 1 - Summer Sale 2021 - Lvl 9">
    <div>Summer Sale 2021 - Lvl 9</div>
    <div><div>Level 9</div><div>XP: 900</div></div>
  </div>
  <div>
    <img src="https://steamcdn-a.akamaihd.net/steamcommunity/public/images/items/1658760/lvl10.png" alt="Series 1 - Summer Sale 2021 - Lvl 10">
    <div>Summer Sale 2021 - Lvl 10</div>
    <div><div>Level 10 - 14</div><div>XP: 1000 - 1400</div></div>
  </div>
  <div>
    <img src="https://steamcdn-a.akamaihd.net/steamcommunity/public/images/items/1658760/lvl1000.png" alt="Series 1 - Summer Sale 2021 - Lvl 1000">
    <div>Summer Sale 2021 - Lvl 1000</div>
    <div><div>Level 1000+</div><div>XP: 100000+</div></div>
  </div>
  <div>
    <img src="https://steamcdn-a.akamaihd.net/steamcommunity/public/images/items/1658760/lvl15000.png" alt="Series 1 - Summer Sale 2021 - Lvl 15000">
    <div>Summer Sale 2021 - Lvl 15000</div>
    <div><div>Level 15000 - ???</div><div>XP: 1500000 - ???</div></div>
  </div>
</div>
<div class="header"><span id="series-1-foilbadges"></span></div>
<div class="grid">
  <div>
    <img src="https://steamcdn-a.akamaihd.net/steamcommunity/public/images/items/1658760/foil1.png" alt="Series 1 - Summer Sale 2021 Foil - Lvl 1">
    <div>Summer Sale 2021 Foil - Lvl 1</div>
    <div><div>Level 1 - 4</div><div>XP: 100 - 400</div></div>
  </div>
  <div>
    <img src="https://steamcdn-a.akamaihd.net/steamcommunity/public/images/items/1658760/foil10.png" alt="Series 1 - Summer Sale 2021 Foil - Lvl 10">
    <div>Summer Sale 2021 Foil - Lvl 10</div>
    <div><div>Level 10 - ??</div></div>
  </div>
</div>
`;

const firewatch = `
<div class="header">
  <span id="series-1-badges"></span>
</div>
<div class="grid">
  <div>
    <img src="https://steamcdn-a.akamaihd.net/steamcommunity/public/images/items/383870/level1.png" alt="Series 1 - Communicator">
    <div>Communicator</div>
    <div>
      <div>Level 1</div>
      <div>XP: 100</div>
    </div>
  </div>
  <div>
    <img src="https://steamcdn-a.akamaihd.net/steamcommunity/public/images/items/383870/level2.png" alt="Series 1 - Cartographer">
    <div>Cartographer</div>
    <div><div>Level 2</div><div>XP: 200</div></div>
  </div>
  <div class="filler"></div>
  <div>
    <img src="javascript:alert(1)" alt="Series 1 - Unsafe">
    <div>Unsafe</div>
    <div><div>Level 3</div></div>
  </div>
</div>
<div class="header">
  <span id="series-1-foilbadges"></span>
</div>
<div class="grid">
  <div>
    <img src="https://shared.fastly.steamstatic.com/community_assets/images/items/383870/foil.png" alt="Series 1 - Lookout">
    <div>Lookout</div>
    <div><div>Level 1</div><div>XP: 100</div></div>
  </div>
</div>
<img alt="Series 1 - Card 1 of 6 - Volunteer">
<img alt="Series 2 - Card 3 of 8 - You Fell Off">
<div class="header"><span id="series-2-badges"></span></div>
<div class="grid">
  <div>
    <img src="https://shared.fastly.steamstatic.com/community_assets/images/items/3527290/peak.png" alt="Series 2 - Ascent">
    <div>Ascent</div>
    <div><div>Level 1</div></div>
  </div>
</div>
`;

describe('badge pages', () => {
  it('reads the five-level art and skips fillers and unsafe urls', () => {
    expect(parseCardExchangeBadges(firewatch, 1, false)).toEqual([
      {
        level: 1,
        levelMax: 1,
        levelLabel: 'Level 1',
        name: 'Communicator',
        imageUrl: 'https://steamcdn-a.akamaihd.net/steamcommunity/public/images/items/383870/level1.png',
        foil: false,
      },
      {
        level: 2,
        levelMax: 2,
        levelLabel: 'Level 2',
        name: 'Cartographer',
        imageUrl: 'https://steamcdn-a.akamaihd.net/steamcommunity/public/images/items/383870/level2.png',
        foil: false,
      },
    ]);
  });

  it('reads the foil badge separately', () => {
    expect(parseCardExchangeBadges(firewatch, 1, true).map((badge) => badge.name)).toEqual(['Lookout']);
  });

  it('keeps sale badge ranges instead of counting every image from 1', () => {
    const badges = parseCardExchangeBadges(summerSale, 1, false);
    expect(badges.map((badge) => [badge.level, badge.levelMax, badge.levelLabel])).toEqual([
      [9, 9, 'Level 9'],
      [10, 14, 'Level 10 - 14'],
      [1000, null, 'Level 1000+'],
      [15000, null, 'Level 15000 - ???'],
    ]);
    expect(parseCardExchangeBadges(summerSale, 1, true).map((badge) => badge.levelLabel)).toEqual([
      'Level 1 - 4',
      'Level 10 - ??',
    ]);
    expect(badgeLevelCaption(badges[1]!)).toBe('Level 10 - 14');
    expect(badgeLevelCaption({ foil: true, levelLabel: 'Level 1' })).toBe('Foil');
    expect(badgeLevelCaption({ foil: true, levelLabel: 'Level 1 - 4' })).toBe('Foil 1 - 4');
    expect(badgeLevelCaption({ foil: true, levelLabel: 'Level 1000+' })).toBe('Foil 1000+');
  });

  it('sums regular and foil card prices into one set price each', () => {
    expect(extractBadgePrices(pricedCards)).toEqual({
      '1': { regular: '$0.13', foil: '€1,50' },
    });
    expect(extractBadgePrices(pricedCards.replace('Price: $0.06', 'Price: NA'))).toEqual({
      '1': { regular: null, foil: '€1,50' },
    });
    expect(badgePriceCaption({ regular: '$0.57', foil: '$4.51' })).toBe('Regular $0.57 · Foil $4.51');
    expect(badgePriceCaption({ regular: '$0.57', foil: null })).toBe('Regular $0.57');
    expect(badgePriceKey(1658760)).toBe('badge-prices-v1:1658760');
    expect(readBadgePriceSnapshot({ updatedAt: 10, series: { '1': { regular: '$0.57', foil: null } } })?.series['1']).toEqual({
      regular: '$0.57',
      foil: null,
    });
    expect(readBadgePriceSnapshot({ updatedAt: 10, series: { '1': { regular: 'free', foil: null } } })).toBeNull();
  });

  it('picks the series that contains the card name and appends that series foil badge', () => {
    expect(seriesForCardName(firewatch, 'You Fell Off')).toBe(2);
    expect(selectBadgeLevels(firewatch, { cardName: 'Volunteer', seriesHint: null })).toEqual([
      {
        level: 1,
        levelMax: 1,
        levelLabel: 'Level 1',
        name: 'Communicator',
        imageUrl: 'https://steamcdn-a.akamaihd.net/steamcommunity/public/images/items/383870/level1.png',
        foil: false,
      },
      {
        level: 2,
        levelMax: 2,
        levelLabel: 'Level 2',
        name: 'Cartographer',
        imageUrl: 'https://steamcdn-a.akamaihd.net/steamcommunity/public/images/items/383870/level2.png',
        foil: false,
      },
      {
        level: 1,
        levelMax: 1,
        levelLabel: 'Level 1',
        name: 'Lookout',
        imageUrl: 'https://shared.fastly.steamstatic.com/community_assets/images/items/383870/foil.png',
        foil: true,
      },
    ]);
    expect(selectBadgeLevels(firewatch, { cardName: 'You Fell Off', seriesHint: 1 })).toEqual([
      {
        level: 1,
        levelMax: 1,
        levelLabel: 'Level 1',
        name: 'Ascent',
        imageUrl: 'https://shared.fastly.steamstatic.com/community_assets/images/items/3527290/peak.png',
        foil: false,
      },
    ]);
  });

  it('falls back to the series named on the item when the card title is missing', () => {
    expect(selectBadgeLevels(firewatch, { cardName: '', seriesHint: 2 })[0]?.name).toBe('Ascent');
  });
});

describe('inventory badge link', () => {
  it('reads the app, card name, and series from the item panel', () => {
    document.body.innerHTML = `
      <div id="iteminfo0">
        <h1>You Fell Off</h1>
        <div>Series 2 Trading Card</div>
        <a href="https://steamcommunity.com/my/gamecards/3527290/?border=1">View foil badge progress</a>
      </div>`;
    const link = document.querySelector('a');
    if (!(link instanceof HTMLAnchorElement)) throw new Error('missing link');
    const request = readBadgeRequest(link);
    expect(request).toEqual({
      appid: 3527290,
      cardName: 'You Fell Off',
      seriesHint: 2,
    });
    expect(appidFromGamecardsHref('https://steamcommunity.com/my/')).toBeNull();
    expect(request ? badgeRequestKey(request) : '').toBe('3527290:2:You Fell Off');
  });
});

describe('badge modal order', () => {
  it('loops from either end of the list', () => {
    expect(stepBadgeIndex(0, 6, -1)).toBe(5);
    expect(stepBadgeIndex(5, 6, 1)).toBe(0);
    expect(stepBadgeIndex(2, 6, 1)).toBe(3);
    expect(stepBadgeIndex(0, 1, 1)).toBe(0);
  });
});

describe('badge page messages', () => {
  it('accepts only a positive app id for the background fetch', () => {
    expect(readBadgePageAppid({ type: BADGE_PAGE_MESSAGE, appid: 383870 })).toBe(383870);
    expect(readBadgePageAppid({ type: BADGE_PAGE_MESSAGE, appid: 0 })).toBeNull();
    expect(readBadgePageAppid({ type: 'other', appid: 383870 })).toBeNull();
    expect(readBadgePageHtml({ text: '<div></div>' })).toBe('<div></div>');
    expect(() => readBadgePageHtml({ error: 'SteamCardExchange returned 404 for this game.' })).toThrow(
      'SteamCardExchange returned 404',
    );
  });
});

describe('badge catalog cache', () => {
  it('keeps the card series and both badge sets', () => {
    const catalog = extractBadgeCatalog(firewatch);
    expect(catalog.cards['you fell off']).toBe(2);
    expect(catalog.series['1']?.map((badge) => badge.name)).toEqual(['Communicator', 'Cartographer', 'Lookout']);
    expect(readBadgeCatalog(catalog)?.series['2']?.[0]?.name).toBe('Ascent');
    expect(badgeCatalogKey(383870)).toBe('badge-catalog-v2:383870');
    expect(readBadgeCatalog({ cards: {}, series: { '1': [{ level: 1, name: 'A', imageUrl: 'javascript:alert(1)', foil: false }] } })).toBeNull();
    expect(
      readBadgeCatalog({
        cards: {},
        series: {
          '1': [
            {
              level: 1,
              name: 'A',
              imageUrl: 'https://steamcdn-a.akamaihd.net/steamcommunity/public/images/items/383870/level1.png',
              foil: false,
            },
          ],
        },
      }),
    ).toBeNull();
  });

  it('reuses a stored catalog without fetching', async () => {
    const catalog = extractBadgeCatalog(firewatch);
    const fetchText = vi.fn(async () => firewatch);
    const read = vi.fn(async () => catalog);
    const write = vi.fn(async () => undefined);
    const loader = createBadgeLoader(fetchText, { read, write });
    const request = { appid: 383870, cardName: 'Volunteer', seriesHint: null };
    const first = await loader.load(request);
    await loader.load({ appid: 383870, cardName: 'You Fell Off', seriesHint: 1 });
    expect(first.levels[0]?.name).toBe('Communicator');
    expect(first.prices).toEqual({ regular: null, foil: null });
    expect(read).toHaveBeenCalledOnce();
    expect(read).toHaveBeenCalledWith(383870);
    expect(fetchText).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it('stores a fetched catalog and skips pages with no badges', async () => {
    const fetchText = vi.fn(async (url: string) => (url.endsWith('383870') ? firewatch : '<div>no badges</div>'));
    const read = vi.fn(async () => null);
    const write = vi.fn(async () => undefined);
    const loader = createBadgeLoader(fetchText, { read, write });
    await loader.load({ appid: 383870, cardName: 'Volunteer', seriesHint: null });
    await loader.load({ appid: 1, cardName: 'Volunteer', seriesHint: null });
    expect(write).toHaveBeenCalledOnce();
    expect(write).toHaveBeenCalledWith(383870, extractBadgeCatalog(firewatch));
  });

  it('refreshes a stale set price without rewriting the artwork catalog', async () => {
    const now = 1_000_000;
    const catalog = extractBadgeCatalog(pricedCards);
    const fetchText = vi.fn(async () => pricedCards);
    const read = vi.fn(async () => catalog);
    const write = vi.fn(async () => undefined);
    const readPrices = vi.fn(async () => ({
      updatedAt: now - BADGE_PRICE_TTL_MS,
      series: { '1': { regular: '$0.01', foil: null } },
    }));
    const writePrices = vi.fn(async () => undefined);
    const loader = createBadgeLoader(fetchText, { read, write, readPrices, writePrices }, () => now);
    const preview = await loader.load({ appid: 1658760, cardName: 'Action', seriesHint: null });
    expect(preview.levels[0]?.name).toBe('Level One');
    expect(preview.prices).toEqual({ regular: '$0.13', foil: '€1,50' });
    expect(fetchText).toHaveBeenCalledOnce();
    expect(write).not.toHaveBeenCalled();
    expect(writePrices).toHaveBeenCalledWith(1658760, { updatedAt: now, series: extractBadgePrices(pricedCards) });
  });

  it('reuses a fresh set price without fetching the game page', async () => {
    const now = 1_000_000;
    const catalog = extractBadgeCatalog(pricedCards);
    const fetchText = vi.fn(async () => pricedCards);
    const stored = { updatedAt: now - 1_000, series: { '1': { regular: '$0.57', foil: '$4.51' } } };
    const loader = createBadgeLoader(
      fetchText,
      {
        read: async () => catalog,
        write: async () => undefined,
        readPrices: async () => stored,
        writePrices: async () => undefined,
      },
      () => now,
    );
    const preview = await loader.load({ appid: 1658760, cardName: 'Action', seriesHint: 1 });
    expect(preview.prices).toEqual(stored.series['1']);
    expect(fetchText).not.toHaveBeenCalled();
  });
});

describe('badge loader', () => {
  it('fetches each game page once and reuses the parsed levels', async () => {
    const fetchText = vi.fn(async () => firewatch);
    const loader = createBadgeLoader(fetchText);
    const request = { appid: 383870, cardName: 'Volunteer', seriesHint: null };
    const first = await loader.load(request);
    const second = await loader.load(request);
    expect(first.levels.map((badge) => [badge.name, badge.foil])).toEqual([
      ['Communicator', false],
      ['Cartographer', false],
      ['Lookout', true],
    ]);
    expect(second).toBe(first);
    expect(fetchText).toHaveBeenCalledOnce();
    expect(fetchText).toHaveBeenCalledWith('https://www.steamcardexchange.net/index.php?gamepage-appid-383870');
  });

  it('retries a game page after a failed fetch', async () => {
    const fetchText = vi.fn(async () => {
      throw new Error('offline');
    });
    const write = vi.fn(async () => undefined);
    const loader = createBadgeLoader(fetchText, { read: async () => null, write });
    const request = { appid: 383870, cardName: 'Volunteer', seriesHint: null };
    await expect(loader.load(request)).rejects.toThrow('offline');
    await expect(loader.load(request)).rejects.toThrow('offline');
    expect(fetchText).toHaveBeenCalledTimes(2);
    expect(write).not.toHaveBeenCalled();
  });
});
