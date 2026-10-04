# Steam booster profit

![A teal gem on a navy trading card](public/icon/128.png)

Rank the Steam booster packs you can craft by what they sell for per gem. On the [Booster Pack Creator](https://steamcommunity.com/tradingcards/boostercreator) page, **Rank by profit** opens a table of those packs. Each row uses the highest market buy order, or the lowest listing when nobody is bidding. The sort key is what you would receive after Steam's fees, divided by the gem cost.

The extension only reads the page and the Steam Community Market. It does not craft packs or place market orders. Prices load when you open the ranking, and they stay cached for 30 minutes.

## Key concepts

- **Gems.** Steam shows your total as `sm_flUserGooAmount`. A pack's `price` is how many gems it costs to craft.
- **Catalog.** `CBoosterCreatorPage.sm_rgBoosterData` lists the packs this account can craft. A page script reads it, because an extension content script cannot see the page's JavaScript.
- **Market hash name.** A pack is `` `${appid}-${name} Booster Pack` ``, with `/` in the name replaced by `-`. The Sack of Gems (`753-Sack of Gems`, 1,000 gems) is priced too, as a baseline for selling the gems instead.
- **Seller receives.** Steam keeps 5% and the publisher keeps 10%. Each fee is at least 1 cent. A buyer price of 60 cents leaves the seller 53 cents. A buyer price of 57 cents leaves 50 cents.
- **Proceeds per gem.** Seller receives divided by gem cost. This is the default sort, highest first. **Vs selling gems** compares the pack with selling that many gems as sacks.
- **Cache.** Quotes are stored in extension local storage for 30 minutes, keyed by wallet currency and app.

## Install

You need Node.js, pnpm, and Chrome. Sign in to Steam in that browser before you open the Booster Pack Creator. The pnpm version is pinned in `package.json`; if `pnpm` is not on your PATH, run `corepack enable` first.

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
6. Open the [Booster Pack Creator](https://steamcommunity.com/tradingcards/boostercreator) while you are signed in.
7. Select **Rank by profit**.

### Load a production build

1. Build the extension:

   ```sh
   pnpm build
   ```

2. On `chrome://extensions`, select **Load unpacked** and choose `.output/chrome-mv3`.

You can close the terminal after the build finishes. Run `pnpm test` to execute the unit tests.
