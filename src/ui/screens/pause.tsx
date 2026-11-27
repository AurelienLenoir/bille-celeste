import { t } from '../../i18n';
import type { UiDeps } from '../actions';

/** Pause menu: resume, recalibrate (tilt), restart, settings, quit to the level select. */
export const PauseMenu = ({ deps }: { deps: UiDeps }) => {
  const { actions, ui, toast } = deps;
  const text = t().pause;
  const tilt = actions.usesTilt();
  return (
    <div class="overlay" id="pauseMenu">
      <div class="card">
        <h2>{text.title}</h2>
        <button class="main" autoFocus onClick={actions.resume}>
          {text.resume}
        </button>
        {tilt && (
          <>
            <button class="alt" onClick={() => toast(actions.calibrate() ? t().calibrated : t().noTiltReading, 1400)}>
              {text.calibrate}
            </button>
            <p class="small">{text.calibrateHint}</p>
          </>
        )}
        <button class="alt" onClick={actions.restart}>
          {text.restart}
        </button>
        <button class="alt" onClick={() => ui.getState().openSettings(true)}>
          {text.settings}
        </button>
        <button class="link" onClick={actions.quit}>
          {text.quit}
        </button>
      </div>
    </div>
  );
};
