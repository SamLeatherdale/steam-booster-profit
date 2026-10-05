import {
  BADGE_PAGE_MESSAGE,
  appidFromGamecardsHref,
  badgeCatalogKey,
  badgeRequestKey,
  createBadgeLoader,
  readBadgeCatalog,
  readBadgePageHtml,
  readBadgeRequest,
  type BadgeRequest,
} from '../../lib/badges';
import {
  badgeProgressFromTracks,
  gamecardsProgressUrls,
  nextBadgeLevel,
  parseBadgeRowId,
  readDisplayedBadge,
  readGamecardsTrack,
  type BadgeProgress,
  type BadgeTrack,
} from '../../lib/badge-progress';
import { BADGE_STYLE, createBadgePresenter } from '../../lib/badge-view';

const PAGE_MATCHES = [
  'https://steamcommunity.com/id/*/inventory*',
  'https://steamcommunity.com/profiles/*/inventory*',
  'https://steamcommunity.com//id/*/inventory*',
  'https://steamcommunity.com//profiles/*/inventory*',
  'https://steamcommunity.com/id/*/badges*',
  'https://steamcommunity.com/profiles/*/badges*',
  'https://steamcommunity.com//id/*/badges*',
  'https://steamcommunity.com//profiles/*/badges*',
  'https://steamcommunity.com/id/*/gamecards/*',
  'https://steamcommunity.com/profiles/*/gamecards/*',
  'https://steamcommunity.com//id/*/gamecards/*',
  'https://steamcommunity.com//profiles/*/gamecards/*',
] as const;

const TOGGLE_CLASS = 'steam-booster-badge-toggle';
const PROGRESS_LINK = /view(?:\s+foil)?\s+badge\s+progress/i;
const BOUND = 'steamBoosterBadgeBound';

const badges = createBadgeLoader(
  async (url) => {
    const appid = Number(/gamepage-appid-(\d+)/.exec(url)?.[1]);
    let response: unknown;
    try {
      response = await browser.runtime.sendMessage({ type: BADGE_PAGE_MESSAGE, appid });
    } catch {
      throw new Error('Could not load badge levels from SteamCardExchange.');
    }
    return readBadgePageHtml(response);
  },
  {
    async read(appid) {
      const key = badgeCatalogKey(appid);
      const stored = await browser.storage.local.get(key);
      return readBadgeCatalog(stored[key]);
    },
    async write(appid, catalog) {
      await browser.storage.local.set({ [badgeCatalogKey(appid)]: catalog });
    },
  },
);
const presenter = createBadgePresenter((request) => badges.load(request));
const tracksInFlight = new Map<string, Promise<BadgeTrack | null>>();

export default defineContentScript({
  matches: [...PAGE_MATCHES],
  runAt: 'document_idle',
  main(ctx) {
    const scope = globalThis as typeof globalThis & { __steamBoosterBadgeLevels?: boolean };
    if (scope.__steamBoosterBadgeLevels) return;
    scope.__steamBoosterBadgeLevels = true;
    ctx.onInvalidated(() => {
      scope.__steamBoosterBadgeLevels = false;
    });

    const style = document.createElement('style');
    style.id = 'steam-booster-badge-style';
    style.textContent = BADGE_STYLE;
    document.documentElement.append(style);
    ctx.onInvalidated(() => style.remove());

    const onKey = (event: KeyboardEvent): void => presenter.handleKey(event);
    document.addEventListener('keydown', onKey, true);

    let timer = 0;
    const scheduleScan = (): void => {
      window.clearTimeout(timer);
      timer = window.setTimeout(scan, 50);
    };
    const observer = new MutationObserver(() => {
      presenter.syncConnection();
      scheduleScan();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    ctx.onInvalidated(() => {
      observer.disconnect();
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKey, true);
      presenter.destroy();
    });
    scan();
  },
});

function scan(): void {
  if (/\/inventory/i.test(location.pathname)) {
    for (const node of document.querySelectorAll('a[href*="/gamecards/"]')) {
      if (!(node instanceof HTMLAnchorElement)) continue;
      if (!PROGRESS_LINK.test(node.textContent ?? '')) continue;
      mountInventoryToggle(node);
    }
  }
  if (/\/badges/i.test(location.pathname)) {
    for (const node of document.querySelectorAll('.badge_row[id^="badge_gamebadge_"]')) {
      if (node instanceof HTMLElement) mountOverviewRow(node);
    }
  }
  if (/\/gamecards\/\d+/i.test(location.pathname)) mountGamecard();
}

function mountInventoryToggle(link: HTMLAnchorElement): void {
  const request = readInventoryRequest(link);
  const row = link.parentElement;
  if (!request || !row) return;
  const anchor = preferredProgressLink(row) ?? link;
  if (link !== anchor) return;
  const key = badgeRequestKey(request);
  const existing = findToggle(row, anchor.href);
  if (existing?.dataset.key === key) return;
  const oldSlot = row.nextElementSibling;
  if (oldSlot instanceof HTMLElement && oldSlot.classList.contains('steam-booster-badge-slot')) oldSlot.remove();
  existing?.remove();

  const slot = document.createElement('div');
  slot.className = 'steam-booster-badge-slot';
  const button = document.createElement('a');
  button.className = `${link.className} ${TOGGLE_CLASS}`;
  button.href = '#badge-levels';
  button.dataset.href = anchor.href;
  button.dataset.key = key;
  button.setAttribute('role', 'button');
  button.setAttribute('aria-expanded', 'false');
  const accent = link.getAttribute('data-accent-color');
  if (accent) button.setAttribute('data-accent-color', accent);
  button.style.setProperty('--min-width', 'fit-content');
  button.textContent = 'Badge levels';
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const current = readInventoryRequest(anchor);
    if (!current) return;
    const open = presenter.toggle(slot, current, () => progressForUrls(anchor.href));
    button.setAttribute('aria-expanded', String(open));
  });
  anchor.after(button);
  row.after(slot);
}

function mountOverviewRow(row: HTMLElement): void {
  if (row.dataset[BOUND] === '1') return;
  const overlay = row.querySelector('a.badge_row_overlay');
  const identity = parseBadgeRowId(row.id);
  if (!(overlay instanceof HTMLAnchorElement) || !identity) return;
  row.dataset[BOUND] = '1';
  row.classList.add('steam-booster-badge-row');
  const request: BadgeRequest = { appid: identity.appid, cardName: '', seriesHint: identity.series };
  const paintHot = (event: MouseEvent): void => {
    const current = row.querySelector('.badge_current');
    if (!(current instanceof HTMLElement)) return;
    current.classList.toggle('steam-booster-badge-hot', eventHits(event, current));
  };
  overlay.addEventListener('mousemove', paintHot);
  overlay.addEventListener('mouseleave', () => {
    row.querySelector('.badge_current')?.classList.remove('steam-booster-badge-hot');
  });
  overlay.addEventListener(
    'click',
    (event) => {
      const current = row.querySelector('.badge_current');
      if (!(current instanceof HTMLElement) || !eventHits(event, current)) return;
      event.preventDefault();
      event.stopPropagation();
      const slot = slotFor(row);
      presenter.toggle(slot, request, () => progressForOverview(row, overlay.href));
    },
    true,
  );
}

function mountGamecard(): void {
  const details = document.querySelector('.gamecard_details');
  if (!(details instanceof HTMLElement) || details.dataset[BOUND] === '1') return;
  const request = gamecardRequest();
  if (!request) return;
  details.dataset[BOUND] = '1';
  const slot = placeGamecardSlot(details);
  const foilPage = new URL(location.href).searchParams.get('border') === '1';
  const open = (): void => {
    presenter.toggle(slot, request, () => progressForGamecard(foilPage));
  };
  details.querySelector('.badge_current')?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    open();
  });
  const progress = details.querySelector('.gamecard_badge_progress');
  if (progress instanceof HTMLElement) {
    progress.setAttribute('role', 'button');
    progress.tabIndex = 0;
    progress.setAttribute('aria-label', 'Show badge levels');
    progress.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      open();
    });
    progress.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      open();
    });
    const circle = progress.querySelector('.badge_empty_circle');
    if (circle instanceof HTMLElement) void fillNextBadge(circle, request, foilPage);
  }
}

async function fillNextBadge(circle: HTMLElement, request: BadgeRequest, foilPage: boolean): Promise<void> {
  const [levels, progress] = await Promise.all([
    badges.load(request).catch(() => []),
    progressForGamecard(foilPage),
  ]);
  if (!progress || !circle.isConnected) return;
  const next = nextBadgeLevel(levels, progress, foilPage);
  if (!next) return;
  const existing = circle.querySelector('.steam-booster-next-badge');
  const image = existing instanceof HTMLImageElement ? existing : document.createElement('img');
  if (!(existing instanceof HTMLImageElement)) {
    image.className = 'steam-booster-next-badge';
    image.alt = '';
    image.addEventListener('error', () => image.remove(), { once: true });
    circle.prepend(image);
  }
  image.src = next.imageUrl;
  circle.closest('.gamecard_badge_progress')?.setAttribute('aria-label', `Show badge levels. Next badge: ${next.name}`);
}

function placeGamecardSlot(details: HTMLElement): HTMLElement {
  const parent = details.parentElement;
  const placed = parent?.querySelector(':scope > .steam-booster-badge-slot');
  if (placed instanceof HTMLElement) return placed;
  const inside = details.querySelector(':scope > .steam-booster-badge-slot');
  if (inside instanceof HTMLElement) {
    details.after(inside);
    return inside;
  }
  const slot = document.createElement('div');
  slot.className = 'steam-booster-badge-slot';
  details.after(slot);
  return slot;
}

function slotFor(row: HTMLElement): HTMLElement {
  const existing = row.querySelector(':scope .steam-booster-badge-slot');
  if (existing instanceof HTMLElement) return existing;
  const slot = document.createElement('div');
  slot.className = 'steam-booster-badge-slot';
  (row.querySelector('.badge_row_inner') ?? row).append(slot);
  return slot;
}

function eventHits(event: MouseEvent, element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
}

function gamecardRequest(): BadgeRequest | null {
  const appid = appidFromGamecardsHref(location.pathname);
  if (appid == null) return null;
  const series = Number(new URL(location.href).searchParams.get('series'));
  return { appid, cardName: '', seriesHint: Number.isInteger(series) && series > 0 ? series : null };
}

function readInventoryRequest(link: HTMLAnchorElement): BadgeRequest | null {
  return readBadgeRequest(link);
}

async function progressForOverview(row: HTMLElement, href: string): Promise<BadgeProgress | null> {
  const identity = parseBadgeRowId(row.id);
  const displayed = readDisplayedBadge(row);
  const urls = gamecardsProgressUrls(href);
  if (!identity) return null;
  if (identity.foil) {
    const normal = urls ? await fetchTrack(urls.normal) : null;
    return badgeProgressFromTracks(normal, displayed);
  }
  const foilRow = document.getElementById(`badge_gamebadge_${identity.appid}_${identity.series}_1`);
  const foil = foilRow ? readDisplayedBadge(foilRow) : urls ? await fetchTrack(urls.foil) : null;
  return badgeProgressFromTracks(displayed, foil);
}

async function progressForGamecard(foilPage: boolean): Promise<BadgeProgress | null> {
  const urls = gamecardsProgressUrls(location.href);
  const details = document.querySelector('.gamecard_details');
  const displayed = details ? readDisplayedBadge(details) : null;
  if (!urls) return badgeProgressFromTracks(displayed, null);
  if (foilPage) return badgeProgressFromTracks(await fetchTrack(urls.normal), displayed);
  return badgeProgressFromTracks(displayed, await fetchTrack(urls.foil));
}

function progressForUrls(href: string): Promise<BadgeProgress | null> {
  const urls = gamecardsProgressUrls(href);
  if (!urls) return Promise.resolve(null);
  return Promise.all([fetchTrack(urls.normal), fetchTrack(urls.foil)]).then(([normal, foil]) =>
    badgeProgressFromTracks(normal, foil),
  );
}

function fetchTrack(url: string): Promise<BadgeTrack | null> {
  const existing = tracksInFlight.get(url);
  if (existing) return existing;
  const pending = fetch(url, { credentials: 'include' })
    .then(async (response) => (response.ok ? readGamecardsTrack(await response.text()) : null))
    .catch(() => null)
    .finally(() => {
      if (tracksInFlight.get(url) === pending) tracksInFlight.delete(url);
    });
  tracksInFlight.set(url, pending);
  return pending;
}

function preferredProgressLink(row: HTMLElement): HTMLAnchorElement | null {
  const links = [...row.querySelectorAll('a[href*="/gamecards/"]')].filter(
    (node): node is HTMLAnchorElement =>
      node instanceof HTMLAnchorElement && PROGRESS_LINK.test(node.textContent ?? ''),
  );
  return links.find((node) => !/\bfoil\b/i.test(node.textContent ?? '')) ?? links[0] ?? null;
}

function findToggle(row: HTMLElement, href: string): HTMLAnchorElement | null {
  for (const node of row.querySelectorAll(`:scope > .${TOGGLE_CLASS}`)) {
    if (node instanceof HTMLAnchorElement && node.dataset.href === href) return node;
  }
  return null;
}
