import { t } from '../../i18n';
import { TILT_RANGE_DEG, TOUCH_SENSITIVITY, type LanguageSetting, type Settings } from '../../meta/settings';
import type { SettingsStore } from '../../meta/store';
import { useStore } from '../hooks';

type BooleanKey = 'invertX' | 'invertY' | 'haptics' | 'sound' | 'music';
const TOGGLES: BooleanKey[] = ['invertX', 'invertY', 'haptics', 'sound', 'music'];
type VolumeKey = 'sfxVolume' | 'musicVolume';
/** Each volume slider shows only while its sound is on. */
const VOLUMES: { key: VolumeKey; when: BooleanKey }[] = [
  { key: 'sfxVolume', when: 'sound' },
  { key: 'musicVolume', when: 'music' },
];

const formatSensitivity = (value: number) => `×${value.toFixed(1).replace('.', t().lang === 'fr' ? ',' : '.')}`;

type Option<T extends string> = { value: T; label: string };

const Segmented = <T extends string>(props: {
  name: string;
  legend: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
}) => (
  <fieldset class="choice">
    <legend>{props.legend}</legend>
    <div class="segmented">
      {props.options.map((o) => (
        <label key={o.value}>
          <input
            type="radio"
            name={props.name}
            value={o.value}
            checked={props.value === o.value}
            onInput={() => props.onChange(o.value)}
          />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  </fieldset>
);

/** Settings card: every change is applied and saved at once. */
export const SettingsCard = ({ store, onBack }: { store: SettingsStore; onBack: () => void }) => {
  const s: Settings = useStore(store, (state) => state.settings);
  const update = store.getState().update;
  const text = t().settings;
  return (
    <div class="overlay" id="settings">
      <form class="card settings" onSubmit={(e) => e.preventDefault()}>
        <h2>{text.title}</h2>
        <Segmented
          name="controlMode"
          legend={text.control}
          value={s.controlMode}
          options={[
            { value: 'tilt', label: text.tilt },
            { value: 'touch', label: text.touch },
          ]}
          onChange={(controlMode) => update({ controlMode })}
        />
        <label class="row slider">
          <span>
            {text.tiltRange} <output>{s.tiltRangeDeg}°</output>
          </span>
          <input
            type="range"
            name="tiltRangeDeg"
            min={TILT_RANGE_DEG.min}
            max={TILT_RANGE_DEG.max}
            step="1"
            value={s.tiltRangeDeg}
            onInput={(e) => update({ tiltRangeDeg: Number(e.currentTarget.value) })}
          />
        </label>
        <label class="row slider">
          <span>
            {text.touchSensitivity} <output>{formatSensitivity(s.touchSensitivity)}</output>
          </span>
          <input
            type="range"
            name="touchSensitivity"
            min={TOUCH_SENSITIVITY.min}
            max={TOUCH_SENSITIVITY.max}
            step="0.1"
            value={s.touchSensitivity}
            onInput={(e) => update({ touchSensitivity: Number(e.currentTarget.value) })}
          />
        </label>
        {TOGGLES.map((key) => (
          <label class="row toggle" key={key}>
            <span>{text[key]}</span>
            <input
              type="checkbox"
              name={key}
              checked={s[key]}
              onInput={(e) => update({ [key]: e.currentTarget.checked })}
            />
          </label>
        ))}
        {VOLUMES.filter((v) => s[v.when]).map(({ key }) => (
          <label class="row slider" key={key}>
            <span>
              {text[key]} <output>{Math.round(s[key] * 100)} %</output>
            </span>
            <input
              type="range"
              name={key}
              min="0"
              max="1"
              step="0.05"
              value={s[key]}
              onInput={(e) => update({ [key]: Number(e.currentTarget.value) })}
            />
          </label>
        ))}
        <Segmented<LanguageSetting>
          name="language"
          legend={text.language}
          value={s.language}
          options={[
            { value: 'auto', label: text.auto },
            { value: 'fr', label: 'Français' },
            { value: 'en', label: 'English' },
          ]}
          onChange={(language) => update({ language })}
        />
        <button class="main" type="button" onClick={onBack}>
          {text.back}
        </button>
      </form>
    </div>
  );
};
