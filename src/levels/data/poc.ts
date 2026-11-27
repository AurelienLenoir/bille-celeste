import type { LevelData } from '../types';

/** The single level of the original index.html prototype, coordinates unchanged. */
export const POC_LEVEL: LevelData = {
  id: 'poc',
  name: 'Niveau 1',
  start: [0, 0, 1],
  pieces: [
    { type: 'slab', at: [0, 0, 0], size: [6, 6], surface: 'mint' }, // départ
    { type: 'slab', at: [0, 0, -8], size: [2, 10.2], surface: 'cream' }, // couloir
    { type: 'slab', at: [0, 0, -16], size: [6, 6], surface: 'mint' }, // plateforme B (checkpoint 1)
    { type: 'wall', at: [0, 0, -19.15], size: [6.6, 0.3] },
    { type: 'wall', at: [-3.15, 0, -16], size: [0.3, 6] },
    { type: 'slab', at: [7, 0, -16], size: [8.2, 2], surface: 'cream' }, // virage à droite
    { type: 'slab', at: [14, 0, -16], size: [6, 6], surface: 'rose' }, // plateforme D
    { type: 'wall', at: [17.15, 0, -16], size: [0.3, 6.6] },
    { type: 'slab', at: [14, 0, -24], size: [1.4, 10.2], surface: 'cream' }, // pont étroit
    { type: 'slab', at: [14, 0, -32], size: [6, 6], surface: 'mint' }, // plateforme E (checkpoint 2)
    { type: 'ramp', at: [14, 0, -35], length: 10, drop: 3, width: 3, surface: 'cream' }, // grande descente
    { type: 'slab', at: [14, -3, -48], size: [6, 6], surface: 'rose' }, // plateforme F
    {
      type: 'movingPlatform',
      at: [14, -3, -52.5],
      size: [3, 3],
      surface: 'lav',
      toZ: -62.5,
      speed: 2.2,
      pause: 1.2,
    },
    { type: 'slab', at: [14, -3, -67], size: [6, 6], surface: 'mint' }, // plateforme G (checkpoint 3)
    { type: 'slab', at: [14, -3, -74], size: [2, 8.2], surface: 'cream' }, // dernier couloir
    { type: 'slab', at: [14, -3, -81], size: [5, 6], surface: 'lav' }, // arrivée
    { type: 'wall', at: [14, -3, -84.15], size: [5.6, 0.3] },
  ],
  crystals: [
    [0, 0, -8],
    [2, 0, -17],
    [7, 0, -16],
    [14, 0, -24],
    [12, -3, -48],
    [16, -3, -67],
    [14, -3, -74],
  ],
  checkpoints: [
    [0, 0, -16],
    [14, 0, -32],
    [14, -3, -67],
  ],
  goal: [14, -3, -82],
  decorSeed: 7,
};
