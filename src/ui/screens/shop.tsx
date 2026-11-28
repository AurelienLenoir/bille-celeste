import { useEffect, useRef, useState } from 'preact/hooks';
import { createSkinPreview, type SkinPreview } from '../../art/skinPreview';
import { pick, t } from '../../i18n';
import { skinById, SKINS, type Skin } from '../../meta/skins';
import { currentDaily, FEATHERS, today } from '../../meta/wallet';
import type { ShopOffer, UiDeps } from '../actions';
import { useStore } from '../hooks';
import { FeatherCount, FeatherIcon } from './feathers';

/** Turning 3D ball of the selected skin. */
const Preview = ({ skin }: { skin: Skin }) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const preview = useRef<SkinPreview | undefined>(undefined);
  useEffect(() => {
    if (!canvas.current) return undefined;
    try {
      preview.current = createSkinPreview(canvas.current);
    } catch {
      preview.current = undefined;
    }
    return () => preview.current?.dispose();
  }, []);
  useEffect(() => preview.current?.show(skin.look), [skin]);
  return <canvas class="skin-preview" ref={canvas} aria-hidden="true" />;
};

const DailyCard = ({ deps }: { deps: UiDeps }) => {
  const wallet = useStore(deps.wallet, (s) => s.wallet);
  const text = t().shop;
  const daily = currentDaily(wallet, today());
  return (
    <section class="daily">
      <strong>{text.daily}</strong>
      <span>{text.dailyKinds[daily.kind]}</span>
      <span class="reward">
        {daily.done
          ? text.dailyDone
          : `${daily.kind === 'winThree' ? `${text.dailyCount(daily.count)} · ` : ''}${text.dailyReward(FEATHERS.daily)}`}
      </span>
    </section>
  );
};

const Purchases = ({ deps }: { deps: UiDeps }) => {
  const [offers, setOffers] = useState<ShopOffer[]>([]);
  const noAds = useStore(deps.wallet, (s) => s.wallet.noAds);
  const text = t().shop;
  useEffect(() => {
    void deps.shop.offers().then(setOffers);
  }, []);
  const buy = async (key: ShopOffer['key']) => {
    const outcome = await deps.shop.buy(key);
    if (outcome === 'bought') deps.toast(text.thanks, 2200);
    else if (outcome === 'failed') deps.toast(text.failed, 2200);
  };
  return (
    <section class="purchases">
      <h3>{text.purchases}</h3>
      {offers.map((offer) =>
        offer.key === 'noAds' ? (
          <button key={offer.key} class="offer" disabled={noAds} onClick={() => void buy('noAds')}>
            <span>
              <strong>{noAds ? text.noAdsOwned : text.noAds}</strong>
              <small>{text.noAdsHint}</small>
            </span>
            {!noAds && <b>{offer.price}</b>}
          </button>
        ) : (
          <button key={offer.key} class="offer" onClick={() => void buy(offer.key)}>
            <span>
              <FeatherIcon /> <strong>{text.pack(offer.feathers ?? 0)}</strong>
            </span>
            <b>{offer.price}</b>
          </button>
        ),
      )}
      <button
        class="link"
        onClick={async () => deps.toast((await deps.shop.restore()) ? text.restored : text.nothingToRestore, 2200)}
      >
        {text.restore}
      </button>
    </section>
  );
};

/** Shop and collection: feathers, daily challenge, skins (preview, buy, equip), store purchases. */
export const Shop = ({ deps, back }: { deps: UiDeps; back: 'title' | 'map' }) => {
  const wallet = useStore(deps.wallet, (s) => s.wallet);
  const [selected, select] = useState(wallet.equipped);
  const skin = skinById(selected);
  const text = t().shop;
  const owned = wallet.owned.includes(skin.id);
  const act = () => {
    if (owned) return deps.wallet.getState().equip(skin.id);
    const result = deps.wallet.getState().buy(skin.id);
    if (!result.ok) return deps.toast(text.notEnough, 1800);
    deps.wallet.getState().equip(skin.id);
    deps.toast(text.bought(pick(skin.name)), 1800);
  };
  return (
    <div class="overlay menu" id="shop">
      <div class="menu-head">
        <button class="back" onClick={() => deps.ui.getState().go({ name: back })}>
          ‹ {text.back}
        </button>
        <FeatherCount wallet={deps.wallet} />
      </div>
      <h2>{text.title}</h2>
      <DailyCard deps={deps} />
      <section class="showcase">
        <Preview skin={skin} />
        <div class="showcase-info">
          <strong>{pick(skin.name)}</strong>
          <small class={`rarity ${skin.rarity}`}>{text.rarity[skin.rarity]}</small>
          <button
            class={owned && wallet.equipped === skin.id ? 'alt' : 'main'}
            disabled={owned && wallet.equipped === skin.id}
            onClick={act}
          >
            {owned ? (wallet.equipped === skin.id ? text.equipped : text.equip) : text.buy(skin.price)}
          </button>
        </div>
      </section>
      <h3 class="section-title">{text.skins}</h3>
      <ul class="skins">
        {SKINS.map((s) => (
          <li key={s.id}>
            <button
              class={`skin ${s.id === selected ? 'selected' : ''} ${s.rarity}`}
              aria-pressed={s.id === selected}
              aria-label={pick(s.name)}
              onClick={() => select(s.id)}
            >
              <span
                class="chip"
                style={{
                  background: `radial-gradient(circle at 35% 30%, #fff8 0 10%, transparent 11%), linear-gradient(${s.look.colors[0]} 0 40%, ${s.look.colors[1]} 40% 60%, ${s.look.colors[0]} 60%)`,
                }}
              />
              <small>
                {wallet.owned.includes(s.id) ? (
                  wallet.equipped === s.id ? (
                    '✓'
                  ) : (
                    pick(s.name)
                  )
                ) : (
                  <>
                    <FeatherIcon />
                    {s.price}
                  </>
                )}
              </small>
            </button>
          </li>
        ))}
      </ul>
      <p class="small hint">{text.howToEarn}</p>
      {deps.shop.available() && <Purchases deps={deps} />}
    </div>
  );
};
