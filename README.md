# Steam Card Toolkit

![A teal gem and a gold badge on a navy trading card](public/icon/128.png)

Tools for Steam trading cards.

On an inventory item, **Badge levels** shows the regular and foil badge artwork for that card. On the badges page, click the badge on the left of a game row. On a game's badge page, the next badge keeps its faded circle, now with that level's artwork, and clicking it opens the same list. Levels you already own have a green outline. That progress is read from Steam when you open the list, and it is not saved with the artwork. Click a level for a large view, then move through the set with the buttons or the arrow keys. The full badge title is shown there. Sale and award badges can share one image across a range of levels, such as 10–14, and the label shows that range. The list also shows the SteamCardExchange price of the regular set and the foil set. **View on SteamCardExchange** opens the same game page. Artwork is loaded from SteamCardExchange the first time you open a game, then kept in the extension's local storage.

On the [Booster Pack Creator](https://steamcommunity.com/tradingcards/boostercreator) page, **Rank by profit** opens a table of the packs you can craft. Each row uses the highest market buy order, or the lowest listing when nobody is bidding. The sort key is what you would receive after Steam's fees, divided by the gem cost.

The extension only reads Steam and SteamCardExchange. It does not craft packs, craft badges, or place market orders. Market prices load when you open the ranking, and they stay cached for 30 minutes.

## Key concepts

- **Gems.** Steam shows your total as `sm_flUserGooAmount`. A pack's `price` is how many gems it costs to craft.
- **Catalog.** `CBoosterCreatorPage.sm_rgBoosterData` lists the packs this account can craft. A page script reads it, because an extension content script cannot see the page's JavaScript.
- **Market hash name.** A pack is `` `${appid}-${name} Booster Pack` ``, with `/` in the name replaced by `-`. The Sack of Gems (`753-Sack of Gems`, 1,000 gems) is priced too, as a baseline for selling the gems instead.
- **Seller receives.** Steam keeps 5% and the publisher keeps 10%. Each fee is at least 1 cent. A buyer price of 60 cents leaves the seller 53 cents. A buyer price of 57 cents leaves 50 cents.
- **Proceeds per gem.** Seller receives divided by gem cost. This is the default sort, highest first. **Vs selling gems** compares the pack with selling that many gems as sacks.
- **Cache.** Quotes are stored in extension local storage for 30 minutes, keyed by wallet currency and app.
- **Badge artwork.** A SteamCardExchange game page lists each badge level's image, name, and level requirement, including ranges such as 10–14 or 1000+. The background script fetches that page, because the inventory page cannot read it directly. The parsed catalog is stored under `badge-catalog-v2:<appid>` and kept, since the artwork does not change.
- **Badge prices.** The same page prices each trading card. The regular set price is the sum of the regular card prices, and the foil set price is the sum of the foil card prices. SteamCardExchange publishes those two totals on its badge pricelists. They are stored under `badge-prices-v1:<appid>` for 30 minutes.

## Install

You need Node.js, pnpm, and Chrome. Sign in to Steam in that browser before you open a Steam Community page. The pnpm version is pinned in `package.json`; if `pnpm` is not on your PATH, run `corepack enable` first.

### Load a development build

The dev server has to keep running. Reloading the extension in Chrome does not replace it.

1. Install dependencies:

   ```sh
   pnpm install
   ```

2. Start the dev server:

   ```sh
   pnpm dev
   ```

3. Open `chrome://extensions`.
4. Turn on **Developer mode**.
5. Select **Load unpacked** and choose `.output/chrome-mv3-dev` in this project.
6. Open the [Booster Pack Creator](https://steamcommunity.com/tradingcards/boostercreator), or an inventory item, while you are signed in.
7. Select **Rank by profit** or **Badge levels**.

### Load a production build

1. Build the extension:

   ```sh
   pnpm build
   ```

2. On `chrome://extensions`, select **Load unpacked** and choose `.output/chrome-mv3`.

You can close the terminal after the build finishes. Run `pnpm test` to execute the unit tests.
