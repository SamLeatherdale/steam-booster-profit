import './style.css';
import { SACK_QUOTE_KEY } from '../../lib/hash';
import { loadMarketData } from '../../lib/market';
import { buildRows } from '../../lib/rank';
import type { Catalog, FetchResult, MarketCache } from '../../lib/types';
import { mountPanel, type PanelController } from './panel';

const STORAGE_KEY = 'market-cache-v1';
const BOOSTER_MATCHES = [
  'https://steamcommunity.com/tradingcards/boostercreator',
  'https://steamcommunity.com/tradingcards/boostercreator/*',
  'https://steamcommunity.com//tradingcards/boostercreator',
  'https://steamcommunity.com//tradingcards/boostercreator/*',
] as const;

export default defineContentScript({
  matches: [...BOOSTER_MATCHES],
  cssInjectionMode: 'ui',
  runAt: 'document_idle',
  async main(ctx) {
    const scope = globalThis as typeof globalThis & { __steamBoosterProfit?: boolean };
    if (scope.__steamBoosterProfit) return;
    scope.__steamBoosterProfit = true;

    let toggleRanking = (): void => {};
    let loadStarted = false;
    const trigger = mountTrigger(() => toggleRanking());
    const ui = await createShadowRootUi(ctx, {
      name: 'steam-booster-profit',
      position: 'inline',
      anchor: '.booster_creator_right',
      append: 'before',
      inheritStyles: true,
      onMount(container, _shadow, shadowHost) {
        shadowHost.hidden = true;
        const panel = mountPanel(container, shadowHost, {
          onSelect(appid) {
            const nextHash = `#${appid}`;
            if (location.hash === nextHash) return;
            location.hash = nextHash;
          },
          onClose() {
            setRankingOpen(shadowHost, trigger, false);
          },
        });
        const startLoad = (): void => {
          if (loadStarted) return;
          loadStarted = true;
          void loadPrices(panel, (ms) => new Promise((resolve) => ctx.setTimeout(resolve, ms))).catch(() => {
            loadStarted = false;
          });
        };
        toggleRanking = () => {
          const open = shadowHost.hidden;
          setRankingOpen(shadowHost, trigger, open);
          if (open) startLoad();
        };
        return panel;
      },
    });
    ui.mount();
  },
});

async function loadPrices(panel: PanelController, sleep: (ms: number) => Promise<void>): Promise<void> {
  try {
    panel.setStatus('Reading craftable packs…');
    const catalog = await readCatalog();
    panel.setGoo(catalog.goo);
    const cached = await readCache();
    let latest: MarketCache = cached ?? { currency: 0, country: null, quotes: {} };
    panel.setRows(buildRows(catalog.packs, latest));

    latest = await loadMarketData({
      packs: catalog.packs,
      cache: cached,
      now: Date.now(),
      fetchText,
      sleep,
      onProgress(progress) {
        const label =
          progress.phase === 'listings'
            ? 'Loading list prices'
            : progress.phase === 'buy-orders'
              ? 'Loading buy orders'
              : 'Checking 24-hour sales';
        panel.setStatus(`${label} ${progress.completed}/${progress.total}`);
      },
      onUpdate(cache) {
        latest = cache;
        panel.setRows(buildRows(catalog.packs, cache));
      },
    });
    await writeCache(latest);
    panel.setRows(buildRows(catalog.packs, latest));
    const priced = Object.keys(latest.quotes).filter((key) => key !== SACK_QUOTE_KEY).length;
    panel.setStatus(`${priced} packs priced`);
  } catch (error) {
    panel.setStatus(error instanceof Error ? error.message : 'Could not load market prices');
    throw error;
  }
}

function mountTrigger(onClick: () => void): HTMLAnchorElement {
  const slot = document.querySelector('.booster_creator_left');
  if (!slot) throw new Error('Could not find the game selector.');
  const link = document.createElement('a');
  link.className = 'btn_blue_steamui btn_medium steam-booster-profit-launch';
  link.href = '#profit-ranking';
  link.style.marginTop = '10px';
  link.setAttribute('aria-expanded', 'false');
  const label = document.createElement('span');
  label.textContent = 'Rank by profit';
  link.append(label);
  link.addEventListener('click', (event) => {
    event.preventDefault();
    onClick();
  });
  slot.append(link);
  return link;
}

function setRankingOpen(host: HTMLElement, trigger: HTMLAnchorElement, open: boolean): void {
  host.hidden = !open;
  const label = trigger.querySelector('span');
  if (label) label.textContent = open ? 'Hide ranking' : 'Rank by profit';
  trigger.setAttribute('aria-expanded', String(open));
  if (open) host.scrollIntoView({ block: 'nearest' });
}

function readCatalog(): Promise<Catalog> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener('message', onMessage);
      reject(new Error('The booster catalog did not appear. Reload the Booster Pack Creator page.'));
    }, 15_000);

    const onMessage = (event: MessageEvent<unknown>): void => {
      if (event.source !== window || !event.data || typeof event.data !== 'object') return;
      const data = event.data as { source?: string; catalog?: string };
      if (data.source !== 'steam-booster-profit' || typeof data.catalog !== 'string') return;
      window.clearTimeout(timeout);
      window.removeEventListener('message', onMessage);
      try {
        resolve(parseCatalog(data.catalog));
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Could not read the booster catalog'));
      }
    };

    window.addEventListener('message', onMessage);
    void injectScript('/booster-main-world.js', { keepInDom: true }).catch((error: unknown) => {
      window.clearTimeout(timeout);
      window.removeEventListener('message', onMessage);
      reject(error instanceof Error ? error : new Error('Could not read the booster catalog'));
    });
  });
}

function parseCatalog(detail: string): Catalog {
  const parsed: unknown = JSON.parse(detail);
  if (!parsed || typeof parsed !== 'object') throw new Error('Booster catalog was empty');
  const record = parsed as Partial<Catalog>;
  if (!Array.isArray(record.packs) || typeof record.goo !== 'number') {
    throw new Error('Booster catalog was incomplete');
  }
  return {
    packs: record.packs,
    goo: record.goo,
    tradableGoo: typeof record.tradableGoo === 'number' ? record.tradableGoo : record.goo,
  };
}

async function fetchText(url: string): Promise<FetchResult> {
  const response = await fetch(url, { credentials: 'include' });
  return { status: response.status, text: await response.text() };
}

async function readCache(): Promise<MarketCache | null> {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  const value: unknown = stored[STORAGE_KEY];
  if (!value || typeof value !== 'object') return null;
  const cache = value as Partial<MarketCache>;
  if (!cache.quotes || typeof cache.quotes !== 'object' || typeof cache.currency !== 'number') return null;
  return {
    currency: cache.currency,
    country: typeof cache.country === 'string' ? cache.country : null,
    quotes: cache.quotes,
  };
}

async function writeCache(cache: MarketCache): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: cache });
}
