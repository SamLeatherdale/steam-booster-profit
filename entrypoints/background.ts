import { cardExchangeGameUrl, readBadgePageAppid } from '../lib/badges';

const BOOSTER_MATCHES = [
  'https://steamcommunity.com/tradingcards/boostercreator',
  'https://steamcommunity.com/tradingcards/boostercreator/*',
  'https://steamcommunity.com//tradingcards/boostercreator',
  'https://steamcommunity.com//tradingcards/boostercreator/*',
];

const INVENTORY_MATCHES = [
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
];

const SCRIPTS = [
  { id: 'steam-booster-profit', matches: BOOSTER_MATCHES, file: '/content-scripts/booster.js' },
  { id: 'steam-booster-badge-preview', matches: INVENTORY_MATCHES, file: '/content-scripts/inventory.js' },
] as const;

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const appid = readBadgePageAppid(message);
    if (appid == null) return;
    void fetchBadgePage(appid)
      .then((text) => sendResponse({ text }))
      .catch((error: unknown) => {
        sendResponse({ error: error instanceof Error ? error.message : 'Could not load badge levels from SteamCardExchange.' });
      });
    return true;
  });
  void injectIntoOpenTabs();
});

async function fetchBadgePage(appid: number): Promise<string> {
  let response: Response;
  try {
    response = await fetch(cardExchangeGameUrl(appid), { credentials: 'omit' });
  } catch {
    throw new Error('Could not load badge levels from SteamCardExchange.');
  }
  if (!response.ok) throw new Error(`SteamCardExchange returned ${response.status} for this game.`);
  return response.text();
}

async function injectIntoOpenTabs(): Promise<void> {
  if (import.meta.env.COMMAND === 'serve') {
    try {
      const registered = await browser.scripting.getRegisteredContentScripts();
      const managed = new Set<string>(SCRIPTS.map((script) => script.id));
      const staleIds = registered
        .filter(
          (script) =>
            managed.has(script.id) ||
            script.js?.some((file) => file.endsWith('booster.js') || file.endsWith('inventory.js')),
        )
        .map((script) => script.id);
      if (staleIds.length > 0) await browser.scripting.unregisterContentScripts({ ids: staleIds });
      await browser.scripting.registerContentScripts(
        SCRIPTS.map((script) => ({
          id: script.id,
          matches: [...script.matches],
          js: [script.file],
          runAt: 'document_idle',
          world: 'ISOLATED',
          persistAcrossSessions: false,
        })),
      );
    } catch (error) {
      console.warn('Could not register content scripts', error);
    }
  }

  await Promise.all(SCRIPTS.map((script) => injectScript(script.matches, script.file)));
}

async function injectScript(
  matches: readonly string[],
  file: '/content-scripts/booster.js' | '/content-scripts/inventory.js',
): Promise<void> {
  const tabs = await browser.tabs.query({ url: [...matches] });

  await Promise.all(
    tabs.map(async (tab) => {
      if (tab.id == null) return;
      try {
        await browser.scripting.executeScript({
          target: { tabId: tab.id },
          files: [file],
        });
      } catch (error) {
        console.warn(`Could not inject ${file}`, error);
      }
    }),
  );
}
