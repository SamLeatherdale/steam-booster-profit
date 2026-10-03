import { describe, expect, it } from 'vitest';
import { isMissingItemPage, parseMultibuy, parseMultisell, parsePriceOverview, readWallet } from './parse';

const halfLifeBuy = `
<tr>
  <td>
    <span class="market_multi_itemname">
      <a class="market_listing_item_name_link" href="https://steamcommunity.com/market/listings/753/220-Half-Life%202%20Booster%20Pack">Half-Life 2 Booster Pack</a>
    </span>
  </td>
  <td>
    <input name="buy_1115503_price" class="market_dialog_input market_multi_price" value="A$ 0.60" data-nameid="1115503" data-tooltip-text="cheapest listing">
  </td>
</tr>`;

const sackBuy = `
<tr>
  <td>
    <span class="market_multi_itemname">
      <a class="market_listing_item_name_link" href="https://steamcommunity.com/market/listings/753/753-Sack%20of%20Gems">Sack of Gems</a>
    </span>
  </td>
  <td>
    <input name="buy_26463978_price" class="market_dialog_input market_multi_price" value="A$ 0.97" data-nameid="26463978" data-tooltip-text="cheapest listing">
  </td>
</tr>`;

const halfLifeSell = `
<tr>
  <td>
    <a class="market_listing_item_name_link" href="https://steamcommunity.com/market/listings/753/220-Half-Life%202%20Booster%20Pack">Half-Life 2 Booster Pack</a>
  </td>
  <td><input class="market_dialog_input market_multi_price market_multi_price_recv" value=""></td>
  <td><input class="market_dialog_input market_multi_price market_multi_price_paid" value="A$ 0.57"></td>
</tr>`;

const wallet = '<script>"wallet_currency":21,"wallet_country":"AU"</script>';

describe('market html', () => {
  it('reads the lowest listing and the sack price from multibuy', () => {
    const quotes = parseMultibuy(`<table>${halfLifeBuy}${sackBuy}</table>${wallet}`);
    expect(quotes.map((quote) => [quote.marketHashName, quote.buyerCents, quote.appid])).toEqual([
      ['220-Half-Life 2 Booster Pack', 60, 220],
      ['753-Sack of Gems', 97, null],
    ]);
    expect(quotes[0]?.nameid).toBe('1115503');
    expect(readWallet(wallet)).toEqual({ currency: 21, country: 'AU' });
  });

  it('reads the highest buy order from multisell without using the empty receive field', () => {
    const [quote] = parseMultisell(`<table>${halfLifeSell}</table>`);
    expect(quote?.buyerCents).toBe(57);
    expect(quote?.buyerLabel).toBe('A$ 0.57');
  });

  it('recognises a missing item page and price overview volume', () => {
    expect(isMissingItemPage('<h3>The item "4000-Nope Booster Pack" does not exist on the market.</h3>')).toBe(
      true,
    );
    expect(parsePriceOverview('{"success":true,"lowest_price":"A$ 0.60","volume":"1,234"}')).toEqual({
      success: true,
      volume: 1234,
    });
    expect(parsePriceOverview('{"success":true,"lowest_price":"A$ 0.60"}')).toEqual({
      success: true,
      volume: 0,
    });
  });
});
