import type { LanguageSetting } from '../meta/settings';
import { en } from './en';
import { fr, type Strings } from './fr';

export type Language = 'fr' | 'en';
export type { Strings };

const STRINGS: Record<Language, Strings> = { fr, en };

/** `auto` picks French on a French device and English everywhere else. */
export const resolveLanguage = (setting: LanguageSetting, deviceLanguage: string): Language =>
  setting !== 'auto' ? setting : deviceLanguage.toLowerCase().startsWith('fr') ? 'fr' : 'en';

let current: Language = 'fr';

export const setLanguage = (language: Language): void => {
  current = language;
};
export const language = (): Language => current;

/** The strings of the current language. */
export const t = (): Strings => STRINGS[current];

/** A text written in both languages (level and world names, signs). */
export const pick = (text: Readonly<Record<Language, string>>): string => text[current];
