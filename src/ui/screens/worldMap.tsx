import { pick, t } from '../../i18n';
import { WORLDS } from '../../levels/worlds';
import { isWorldOpen, totalStars, worldStars } from '../../meta/progress';
import type { UiDeps } from '../actions';
import { useStore } from '../hooks';
import { FeatherCount } from './feathers';

const MAX_STARS = WORLDS.length * 5 * 3;

/** The four worlds, their stars and how many stars open the locked ones. */
export const WorldMap = ({ deps }: { deps: UiDeps }) => {
  const { ui, unlockAll } = deps;
  const progress = useStore(deps.progress, (s) => s.progress);
  const text = t().map;
  return (
    <div class="overlay menu" id="map">
      <div class="menu-head">
        <button class="back" onClick={() => ui.getState().go({ name: 'title' })}>
          ‹ {text.back}
        </button>
        <span class="total">★ {text.totalStars(totalStars(progress), MAX_STARS)}</span>
      </div>
      <h2>{text.title}</h2>
      <button class="shop-link" onClick={() => ui.getState().go({ name: 'shop', back: 'map' })}>
        <FeatherCount wallet={deps.wallet} />
        <span>{t().shop.open} ›</span>
      </button>
      <ol class="worlds">
        {WORLDS.map((world) => {
          const open = unlockAll || isWorldOpen(progress, world);
          return (
            <li key={world.id}>
              <button
                class={`world ${world.theme}`}
                disabled={!open}
                onClick={() => ui.getState().go({ name: 'levels', world: world.id })}
              >
                <span class="num">{world.id}</span>
                <span class="body">
                  <strong>{pick(world.name)}</strong>
                  <small>{pick(world.tagline)}</small>
                </span>
                <span class="stars-count">
                  {open ? `★ ${worldStars(progress, world)}/15` : `🔒 ${text.locked(world.unlockStars)}`}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
};
