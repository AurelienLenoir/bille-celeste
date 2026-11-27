import { render } from 'preact';
import { useEffect } from 'preact/hooks';
import { resolveLanguage, setLanguage, t } from '../i18n';
import type { UiDeps } from './actions';
import { labelHud } from './hud/hud';
import { useStore } from './hooks';
import { LevelSelect } from './screens/levelSelect';
import { PauseMenu } from './screens/pause';
import { SettingsCard } from './screens/settings';
import { TitleScreen } from './screens/title';
import { Victory } from './screens/victory';
import { WorldMap } from './screens/worldMap';

const PAUSE_KEYS = new Set(['escape', 'p']);

const PauseButton = ({ onClick }: { onClick: () => void }) => (
  <button class="pause-btn" id="pause" aria-label={t().hud.pause} onClick={onClick}>
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1.5" />
      <rect x="14" y="5" width="4" height="14" rx="1.5" />
    </svg>
  </button>
);

const App = ({ deps }: { deps: UiDeps }) => {
  const { ui, actions } = deps;
  const screen = useStore(ui, (s) => s.screen);
  const settingsOpen = useStore(ui, (s) => s.settings);
  const languageSetting = useStore(deps.settings, (s) => s.settings.language);
  const language = resolveLanguage(languageSetting, navigator.language);
  setLanguage(language);

  useEffect(() => {
    document.documentElement.lang = language;
    labelHud();
  }, [language]);
  useEffect(() => {
    document.body.dataset.screen = screen.name;
  }, [screen.name]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || !PAUSE_KEYS.has(e.key.toLowerCase()) || ui.getState().settings) return;
      const now = ui.getState().screen.name;
      if (now === 'play') actions.pause();
      else if (now === 'pause') actions.resume();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  const current = (() => {
    switch (screen.name) {
      case 'title':
        return <TitleScreen deps={deps} />;
      case 'map':
        return <WorldMap deps={deps} />;
      case 'levels':
        return <LevelSelect deps={deps} worldId={screen.world} />;
      case 'pause':
        return <PauseMenu deps={deps} />;
      case 'win':
        return <Victory deps={deps} win={screen.win} />;
      case 'loading':
        return <div class="loading">{t().loading}</div>;
      case 'play':
        return <PauseButton onClick={actions.pause} />;
    }
  })();

  return (
    <>
      {!settingsOpen && current}
      <div class="rotate" aria-hidden="true">
        <span class="phone" />
        <p>{t().rotate}</p>
      </div>
      {settingsOpen && <SettingsCard store={deps.settings} onBack={() => ui.getState().openSettings(false)} />}
    </>
  );
};

/** Renders the menus and overlays (Preact) into `root`. */
export const mountUi = (root: HTMLElement, deps: UiDeps): void => render(<App deps={deps} />, root);
