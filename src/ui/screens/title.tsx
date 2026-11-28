import { t } from '../../i18n';
import type { UiDeps } from '../actions';

/** Title card: choose the control and go on to the world map (or straight to `?level`). */
export const TitleScreen = ({ deps }: { deps: UiDeps }) => {
  const { actions, ui, directLevel } = deps;
  const text = t().title;
  const next = () => (directLevel ? actions.play(directLevel) : ui.getState().go({ name: 'map' }));
  return (
    <div class="overlay" id="start">
      <div class="card">
        <h1>{t().gameTitle}</h1>
        <p>{text.pitch}</p>
        <p class="small">{text.neutral}</p>
        <button
          class="main"
          onClick={async () => {
            actions.chooseControl('tilt');
            await actions.enableTilt();
            next();
          }}
        >
          {text.playTilt}
        </button>
        <button
          class="alt"
          onClick={() => {
            actions.chooseControl('touch');
            next();
          }}
        >
          {text.playTouch}
        </button>
        <div class="links">
          <button class="link" onClick={() => ui.getState().go({ name: 'shop', back: 'title' })}>
            {t().shop.open}
          </button>
          <button class="link" onClick={() => ui.getState().openSettings(true)}>
            {text.settings}
          </button>
        </div>
        <p class="small">{text.keys}</p>
      </div>
    </div>
  );
};
