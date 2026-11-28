import { describe, expect, it } from 'vitest';
import { SONGS } from '../../src/art/music';
import { BEATS_PER_BAR, composeBar } from '../../src/engine/music';

describe('procedural music', () => {
  it('composes the same bar the same way every time', () => {
    expect(composeBar(SONGS.garden, 3)).toEqual(composeBar(SONGS.garden, 3));
  });
  it('loops over the progression', () => {
    const length = SONGS.garden.progression.length;
    expect(composeBar(SONGS.garden, 2 + length)).toEqual(composeBar(SONGS.garden, 2));
  });
  it('keeps every note inside its bar', () => {
    for (const song of Object.values(SONGS)) {
      for (let bar = 0; bar < song.progression.length; bar++) {
        for (const n of composeBar(song, bar)) {
          expect(n.beat).toBeGreaterThanOrEqual(0);
          expect(n.beat).toBeLessThan(BEATS_PER_BAR);
        }
      }
    }
  });
  it('gives each world its own tune', () => {
    const tune = (id: keyof typeof SONGS) =>
      JSON.stringify(composeBar(SONGS[id], 0).filter((n) => n.instrument === SONGS[id].lead));
    expect(new Set((['garden', 'sunset', 'glacier', 'factory'] as const).map(tune)).size).toBe(4);
  });
  it('plays drums only where the song has some', () => {
    expect(composeBar(SONGS.menu, 0).some((n) => n.instrument === 'kick')).toBe(false);
    expect(composeBar(SONGS.factory, 0).some((n) => n.instrument === 'kick')).toBe(true);
  });
});
