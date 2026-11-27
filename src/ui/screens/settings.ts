import type { Settings } from '../../meta/settings';
import type { SettingsStore } from '../../meta/store';
import { byId } from '../dom';

type BooleanKey = 'invertX' | 'invertY' | 'haptics' | 'sound';
const TOGGLES: BooleanKey[] = ['invertX', 'invertY', 'haptics', 'sound'];

const input = (form: HTMLFormElement, name: string): HTMLInputElement => {
  const el = form.elements.namedItem(name);
  if (!(el instanceof HTMLInputElement)) throw new Error(`Missing input ${name} in #settingsForm`);
  return el;
};

const formatSensitivity = (value: number) => `×${value.toFixed(1).replace('.', ',')}`;

/** Settings card: every change is applied and saved at once. Returns the function that opens it. */
export const bindSettings = (store: SettingsStore): ((back: () => void) => void) => {
  const overlay = byId('settings');
  const form = byId<HTMLFormElement>('settingsForm');
  const tiltRange = input(form, 'tiltRangeDeg');
  const touchSensitivity = input(form, 'touchSensitivity');
  let back: () => void = () => undefined;

  const render = (s: Settings) => {
    for (const radio of form.querySelectorAll<HTMLInputElement>('input[name="controlMode"]')) {
      radio.checked = radio.value === s.controlMode;
    }
    tiltRange.value = String(s.tiltRangeDeg);
    byId('tiltRangeOut').textContent = `${s.tiltRangeDeg}°`;
    touchSensitivity.value = String(s.touchSensitivity);
    byId('touchSensitivityOut').textContent = formatSensitivity(s.touchSensitivity);
    for (const key of TOGGLES) input(form, key).checked = s[key];
  };

  form.addEventListener('input', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLInputElement)) return;
    const { update } = store.getState();
    if (target.name === 'controlMode') update({ controlMode: target.value === 'tilt' ? 'tilt' : 'touch' });
    else if (target.name === 'tiltRangeDeg') update({ tiltRangeDeg: Number(target.value) });
    else if (target.name === 'touchSensitivity') update({ touchSensitivity: Number(target.value) });
    else if ((TOGGLES as string[]).includes(target.name)) update({ [target.name]: target.checked });
  });
  form.addEventListener('submit', (e) => e.preventDefault());
  byId('settingsBack').addEventListener('click', () => {
    overlay.hidden = true;
    back();
  });

  store.subscribe(({ settings }) => render(settings));
  render(store.getState().settings);

  return (onBack) => {
    back = onBack;
    overlay.hidden = false;
  };
};
