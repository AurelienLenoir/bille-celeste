import { describe, expect, it } from 'vitest';
import { buildNav, planRoute } from '../../src/game/nav';
import { estimateDrawCalls, hasErrors, validateLevel } from '../../src/levels/validate';
import { levelWith, shippedLevel } from './helpers';

const messages = (level: Parameters<typeof validateLevel>[0]) =>
  validateLevel(level)
    .map((i) => i.message)
    .join('\n');

const corridor = levelWith(
  [
    { type: 'platform', cell: [0, 0, 0] },
    { type: 'straight', cell: [0, 0, -2], length: 3 },
    { type: 'platform', cell: [0, 0, -6] },
  ],
  {
    entities: [
      { type: 'crystal', cell: [0, 0, -3] },
      { type: 'goal', cell: [0, 0, -6] },
    ],
  },
);

describe('nav graph', () => {
  it('joins pieces through matching ports and plans a route through every crystal', () => {
    const nav = buildNav(corridor);
    const route = planRoute(corridor, nav);
    expect(route?.steps[0]?.at).toEqual([0, 0, 0]);
    expect(route?.steps.at(-1)?.at).toEqual([0, 0, -12]);
    expect(route?.length).toBeCloseTo(12);
  });

  it('only rolls down a drop, never up', () => {
    const level = levelWith(
      [
        { type: 'platform', cell: [0, 0, 0] },
        { type: 'platform', cell: [0, -2, -3] },
      ],
      {
        entities: [
          { type: 'crystal', cell: [0, -2, -3] },
          { type: 'goal', cell: [0, 0, 0] },
        ],
      },
    );
    expect(messages(level)).toContain(`l'arrivée est inaccessible`);
  });

  it('a wall closes an edge', () => {
    const blocked = levelWith([...corridor.pieces, { type: 'wall', cell: [0, 0, -4], length: 1 }], {
      entities: corridor.entities,
    });
    expect(messages(blocked)).toContain('Arrivée 1 en [0, 0, -6] est inaccessible');
  });
});

describe('validateLevel', () => {
  it('accepts a simple corridor and every shipped level', () => {
    expect(validateLevel(corridor)).toEqual([]);
    for (const id of ['poc', 'pieces']) expect(hasErrors(validateLevel(shippedLevel(id)))).toBe(false);
  });

  it('finds overlapping pieces', () => {
    const level = levelWith([...corridor.pieces, { type: 'straight', cell: [-1, 0, -3], rot: 90, length: 3 }], {
      entities: corridor.entities,
    });
    expect(messages(level)).toMatch(/se chevauchent en \[0, -3\]/);
  });

  it('finds entities off the course, in a wall or under a surface', () => {
    const level = levelWith(
      [
        ...corridor.pieces,
        { type: 'wall', cell: [0, 0, 1], rot: 180, length: 1, height: 1 },
        { type: 'platform', cell: [0, 2, -6], size: [1, 1] },
      ],
      {
        entities: [
          { type: 'crystal', cell: [5, 0, 0] },
          { type: 'crystal', cell: [0, 0, 2] },
          { type: 'crystal', cell: [0, 0, -6] },
          { type: 'goal', cell: [0, 0, -6] },
        ],
      },
    );
    const text = messages(level);
    expect(text).toContain(`Cristal 0 en [5, 0, 0] n'est posé sur aucune pièce`);
    expect(text).toContain('Cristal 2 en [0, 0, -6] est sous une autre surface');
  });

  it('asks for a checkpoint on long courses', () => {
    const level = levelWith(
      [
        { type: 'platform', cell: [0, 0, 0] },
        { type: 'straight', cell: [0, 0, -2], length: 24 },
        { type: 'straight', cell: [0, 0, -26], length: 12 },
        { type: 'platform', cell: [0, 0, -39] },
      ],
      {
        entities: [
          { type: 'crystal', cell: [0, 0, -10] },
          { type: 'goal', cell: [0, 0, -39] },
        ],
      },
    );
    expect(messages(level)).toContain('sans checkpoint');
  });

  it('estimates draw calls within budget', () => {
    const level = shippedLevel('poc');
    expect(estimateDrawCalls(level, buildNav(level).builds)).toBeLessThan(80);
  });
});
