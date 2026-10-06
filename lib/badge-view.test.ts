import { describe, expect, it } from 'vitest';
import type { BadgeLevel } from './badges';
import { createBadgePresenter } from './badge-view';

const saleBadge: BadgeLevel = {
  level: 10,
  levelMax: 14,
  levelLabel: 'Level 10 - 14',
  name: 'Summer Sale 2021 - Lvl 10',
  imageUrl: 'https://steamcdn-a.akamaihd.net/steamcommunity/public/images/items/1658760/lvl10.png',
  foil: false,
};

describe('badge popup', () => {
  it('shows the level range and a SteamCardExchange link', async () => {
    const presenter = createBadgePresenter(async () => ({
      levels: [saleBadge],
      prices: { regular: '$0.57', foil: '$4.51' },
    }));
    const slot = document.createElement('div');
    document.body.append(slot);
    presenter.toggle(slot, { appid: 1658760, cardName: '', seriesHint: 1 }, async () => null);

    const link = slot.querySelector('a.steam-booster-badge-exchange');
    expect(link?.getAttribute('href')).toBe('https://www.steamcardexchange.net/index.php?gamepage-appid-1658760');
    expect(link?.textContent).toBe('View on SteamCardExchange');
    expect(link?.getAttribute('target')).toBe('_blank');

    await Promise.resolve();
    await Promise.resolve();
    expect(slot.querySelector('.steam-booster-badge-level-label')?.textContent).toBe('Level 10 - 14');
    expect(slot.querySelector('.steam-booster-badge-prices')?.textContent).toBe('Regular $0.57 · Foil $4.51');

    slot.querySelector('button.steam-booster-badge-level')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const modalLink = document.querySelector('.steam-booster-badge-modal a.steam-booster-badge-exchange');
    expect(modalLink?.getAttribute('href')).toBe('https://www.steamcardexchange.net/index.php?gamepage-appid-1658760');
    expect(document.querySelector('.steam-booster-badge-modal-label')?.textContent).toBe('Level 10 - 14');
    expect(document.querySelector('.steam-booster-badge-modal .steam-booster-badge-prices')?.textContent).toBe(
      'Regular $0.57 · Foil $4.51',
    );

    presenter.destroy();
    slot.remove();
  });
});
