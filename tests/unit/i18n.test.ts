import { describe, expect, it } from 'vitest';
import { en } from '../../src/i18n/en';
import { fr } from '../../src/i18n/fr';
import { pick, resolveLanguage, setLanguage, t } from '../../src/i18n';

/** Every leaf of a strings object, as "path: kind". */
const shape = (value: unknown, path = ''): string[] =>
  typeof value === 'object' && value !== null
    ? Object.entries(value).flatMap(([k, v]) => shape(v, `${path}.${k}`))
    : [`${path}: ${typeof value}`];

describe('i18n', () => {
  it('English has every French string, and nothing more', () => {
    expect(shape(en)).toEqual(shape(fr));
  });
  it('auto follows the device: French for French, English otherwise', () => {
    expect(resolveLanguage('auto', 'fr-FR')).toBe('fr');
    expect(resolveLanguage('auto', 'fr')).toBe('fr');
    expect(resolveLanguage('auto', 'en-US')).toBe('en');
    expect(resolveLanguage('auto', 'de-DE')).toBe('en');
    expect(resolveLanguage('fr', 'en-US')).toBe('fr');
  });
  it('switches every string at once', () => {
    setLanguage('en');
    expect(t().win.title).toBe('Level complete!');
    expect(pick({ fr: 'Bonjour', en: 'Hello' })).toBe('Hello');
    setLanguage('fr');
    expect(t().missingCrystals(2)).toBe('Il manque encore 2 cristaux !');
  });
});
