import { pick, t } from '../../i18n';
import { worldOfLevel } from '../../levels/worlds';
import type { UiDeps } from '../actions';
import { formatTime, formatTimeShort } from '../format';
import type { WinView } from '../state';
import { useState } from 'preact/hooks';
import { FeatherIcon } from './feathers';

/** Feathers this win paid, and the offer to double them with a rewarded ad. */
const Earned = ({ deps, amount }: { deps: UiDeps; amount: number }) => {
  const [doubled, setDoubled] = useState(false);
  const rewards = deps.rewards();
  return (
    <div class="earned">
      <span id="wFeathers">
        <FeatherIcon /> {t().earned(doubled ? amount * 2 : amount)}
      </span>
      {rewards !== 'none' && !doubled && (
        <button
          class="alt small-btn"
          onClick={async () => {
            if (await deps.actions.doubleFeathers(amount)) setDoubled(true);
            else deps.toast(t().ads.unavailable, 1800);
          }}
        >
          ×2 {t().ads.doubleFeathers} <small>{rewards === 'free' ? t().ads.free : t().ads.watch}</small>
        </button>
      )}
    </div>
  );
};

/** Victory card: stars, time, falls, crystals, record, gem, and where to go next. */
export const Victory = ({ deps, win }: { deps: UiDeps; win: WinView }) => {
  const { actions, ui } = deps;
  const text = t().win;
  const { run, outcome } = win;
  const earned = [true, run.stars.underPar, run.stars.noFall];
  const labels = [t().stars.finished, t().stars.underPar(win.parTimeSec), t().stars.noFall];
  const world = worldOfLevel(win.levelId);
  return (
    <div class="overlay" id="win">
      <div class="card">
        <h2>{text.title}</h2>
        <ul class="stars" id="wStars" role="img" aria-label={text.starsLabel(run.stars.count)}>
          {earned.map((on, i) => (
            <li key={i} class={on ? 'on' : ''}>
              <span aria-hidden="true">★</span>
              {labels[i]}
            </li>
          ))}
        </ul>
        <div class="stats">
          <div>
            <strong id="wTime">{formatTimeShort(run.time)}</strong>
            {text.time}
          </div>
          <div>
            <strong id="wFalls">{run.falls}</strong>
            {text.falls}
          </div>
          <div>
            <strong id="wCrystals">
              {win.crystals}/{win.crystals}
            </strong>
            {text.crystals}
          </div>
        </div>
        {outcome && (
          <p class={`record ${outcome.newRecord ? 'new' : ''}`} id="wRecord">
            {outcome.newRecord ? text.newRecord : text.record(formatTime(outcome.previousBest ?? run.time))}
          </p>
        )}
        {win.earnings && win.earnings.total > 0 && <Earned deps={deps} amount={win.earnings.total} />}
        <p class="small gem">{run.gem ? t().gemFound : win.hasGem ? t().gemMissed : ''}</p>
        {win.opened && <p class="unlocked">{text.worldOpened(pick(win.opened.name))}</p>}
        {win.campaignDone && <p class="unlocked">{text.campaignDone}</p>}
        {win.next && (
          <button class="main" onClick={() => win.next && actions.play(win.next)}>
            {text.next}
          </button>
        )}
        <button class={win.next ? 'alt' : 'main'} onClick={actions.restart}>
          {text.again}
        </button>
        {world && (
          <button class="link" onClick={() => ui.getState().go({ name: 'levels', world: world.id })}>
            {text.levels}
          </button>
        )}
      </div>
    </div>
  );
};
