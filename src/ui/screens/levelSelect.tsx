import { useEffect, useState } from 'preact/hooks';
import { pick, t } from '../../i18n';
import { fetchLevel } from '../../levels/catalog';
import type { Level } from '../../levels/schema';
import { levelNumber, WORLDS } from '../../levels/worlds';
import { isLevelOpen } from '../../meta/progress';
import type { UiDeps } from '../actions';
import { formatTime } from '../format';
import { useStore } from '../hooks';
import { StarRow } from './stars';

/** Names of the levels, loaded with the level files (one small chunk each). */
const useLevels = (ids: readonly string[]) => {
  const [levels, setLevels] = useState<Record<string, Level>>({});
  useEffect(() => {
    let live = true;
    void Promise.all(ids.map((id) => fetchLevel(id).then((level) => [id, level] as const))).then((pairs) => {
      if (live) setLevels(Object.fromEntries(pairs));
    });
    return () => {
      live = false;
    };
  }, [ids]);
  return levels;
};

/** The five levels of a world: stars, best time, locked ones greyed out. */
export const LevelSelect = ({ deps, worldId }: { deps: UiDeps; worldId: number }) => {
  const { ui, actions, unlockAll } = deps;
  const progress = useStore(deps.progress, (s) => s.progress);
  const world = WORLDS.find((w) => w.id === worldId) ?? WORLDS[0];
  const levels = useLevels(world?.levels ?? []);
  const firstOpen = world?.levels.find((id) => isLevelOpen(progress, id) && !progress.levels[id]);
  useEffect(() => {
    const backdrop = firstOpen ?? world?.levels[0];
    if (backdrop) actions.showBackdrop(backdrop);
  }, [worldId]);
  if (!world) return null;
  const text = t().levels;
  return (
    <div class={`overlay menu ${world.theme}`} id="levels">
      <div class="menu-head">
        <button class="back" onClick={() => ui.getState().go({ name: 'map' })}>
          ‹ {text.back}
        </button>
      </div>
      <h2>{pick(world.name)}</h2>
      <ol class="levels">
        {world.levels.map((id) => {
          const record = progress.levels[id];
          const open = unlockAll || isLevelOpen(progress, id);
          const name = levels[id]?.name;
          return (
            <li key={id}>
              <button class="level" disabled={!open} onClick={() => actions.play(id)}>
                <span class="num">{levelNumber(id)}</span>
                <span class="body">
                  <strong>{name ? pick(name) : '…'}</strong>
                  <small>
                    {!open
                      ? `🔒 ${text.locked}`
                      : record
                        ? `${text.best(formatTime(record.bestTime))}${record.gem ? ` · ◆ ${text.gem}` : ''}`
                        : text.notPlayed}
                  </small>
                </span>
                <StarRow
                  earned={[!!record, !!record?.underPar, !!record?.noFall]}
                  label={t().win.starsLabel(record ? 1 + Number(record.underPar) + Number(record.noFall) : 0)}
                />
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
};
