import { defineConfig } from 'wxt';

export default defineConfig({
  webExt: {
    disabled: true,
  },
  manifest: {
    name: 'Steam Card Toolkit',
    description: 'Preview badge artwork for a trading card, and rank booster packs by what they sell for per gem.',
    permissions: ['storage', 'scripting', 'tabs'],
    host_permissions: ['https://steamcommunity.com/*', 'https://www.steamcardexchange.net/*', 'https://steamcardexchange.net/*'],
    web_accessible_resources: [
      {
        resources: ['booster-main-world.js'],
        matches: ['https://steamcommunity.com/*'],
      },
    ],
  },
});
