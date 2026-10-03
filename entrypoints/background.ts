const MATCHES = [
  'https://steamcommunity.com/tradingcards/boostercreator',
  'https://steamcommunity.com/tradingcards/boostercreator/*',
  'https://steamcommunity.com//tradingcards/boostercreator',
  'https://steamcommunity.com//tradingcards/boostercreator/*',
];

const SCRIPT_ID = 'steam-booster-profit';

export default defineBackground(() => {
  void injectIntoOpenTabs();
});

async function injectIntoOpenTabs(): Promise<void> {
  if (import.meta.env.COMMAND === 'serve') {
    try {
      const registered = await browser.scripting.getRegisteredContentScripts();
      const staleIds = registered
        .filter((script) => script.id === SCRIPT_ID || script.js?.some((file) => file.endsWith('booster.js')))
        .map((script) => script.id);
      if (staleIds.length > 0) await browser.scripting.unregisterContentScripts({ ids: staleIds });
      await browser.scripting.registerContentScripts([
        {
          id: SCRIPT_ID,
          matches: MATCHES,
          js: ['/content-scripts/booster.js'],
          runAt: 'document_idle',
          world: 'ISOLATED',
          persistAcrossSessions: false,
        },
      ]);
    } catch (error) {
      console.warn('Could not register the booster content script', error);
    }
  }

  const tabs = await browser.tabs.query({ url: MATCHES });
  await Promise.all(
    tabs.map(async (tab) => {
      if (tab.id == null) return;
      try {
        await browser.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['/content-scripts/booster.js'],
        });
      } catch (error) {
        console.warn('Could not inject the booster content script', error);
      }
    }),
  );
}
