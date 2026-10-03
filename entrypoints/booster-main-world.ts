interface RawPack {
  appid: number;
  name: string;
  series: number;
  price: string | number;
  unavailable?: boolean;
  available_at_time?: string;
}

interface BoosterPage {
  sm_rgBoosterData?: Record<string, RawPack>;
  sm_flUserGooAmount?: number;
  sm_flUserTradableGooAmount?: number;
}

export default defineUnlistedScript(() => {
  const publish = (): boolean => {
    const page = (window as Window & { CBoosterCreatorPage?: BoosterPage }).CBoosterCreatorPage;
    const data = page?.sm_rgBoosterData;
    if (!page || !data) return false;
    const packs = Object.values(data).map((item) => ({
      appid: item.appid,
      name: item.name,
      series: item.series,
      gems: Number(item.price),
      unavailable: Boolean(item.unavailable),
      availableAtTime: item.available_at_time ?? null,
    }));
    window.postMessage(
      {
        source: 'steam-booster-profit',
        catalog: JSON.stringify({
          packs,
          goo: page.sm_flUserGooAmount ?? 0,
          tradableGoo: page.sm_flUserTradableGooAmount ?? 0,
        }),
      },
      window.location.origin,
    );
    return true;
  };

  if (publish()) return;
  const timer = window.setInterval(() => {
    if (publish()) window.clearInterval(timer);
  }, 250);
  window.setTimeout(() => window.clearInterval(timer), 10_000);
});
