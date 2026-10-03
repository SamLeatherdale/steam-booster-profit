import { defineConfig } from 'wxt';

export default defineConfig({
  webExt: {
    disabled: true,
  },
  manifest: {
    name: 'Steam Booster Pack Profit',
    description: 'Rank booster packs you can craft by what they sell for per gem.',
    permissions: ['storage', 'scripting', 'tabs'],
    host_permissions: ['https://steamcommunity.com/*'],
    web_accessible_resources: [
      {
        resources: ['booster-main-world.js'],
        matches: ['https://steamcommunity.com/*'],
      },
    ],
  },
});
