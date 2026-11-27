import type { Entity, PieceType } from '../../src/levels/schema';

/** French labels of the editor (a development tool, so French only). */
export const PIECE_LABELS: Record<PieceType, string> = {
  platform: 'Plateforme',
  straight: 'Ligne droite',
  curve: 'Virage',
  ramp: 'Rampe',
  halfPipe: 'Demi-tube',
  funnel: 'Entonnoir',
  bridge: 'Pont étroit',
  gap: 'Trou + tremplin',
  wall: 'Mur',
  stairs: 'Escalier',
  movingPlatform: 'Plateforme mobile',
  rotatingPlatform: 'Plateau tournant',
  fallingTile: 'Dalle qui tombe',
  seesaw: 'Bascule',
};

export const ENTITY_LABELS: Record<Entity['type'], string> = {
  crystal: 'Cristal',
  checkpoint: 'Checkpoint',
  hiddenGem: 'Gemme cachée',
  goal: 'Arrivée',
};

export const FIELD_LABELS: Record<string, string> = {
  size: 'Taille (cases)',
  length: 'Longueur (cases)',
  width: 'Largeur',
  rails: 'Rambardes',
  surface: 'Couleur',
  radius: 'Rayon (cases)',
  angle: 'Angle',
  dir: 'Sens',
  drop: 'Dénivelé (pas de 0,5)',
  diameter: 'Diamètre (cases)',
  height: 'Hauteur',
  steps: 'Marches',
  speed: 'Vitesse',
  pause: 'Pause (s)',
  delay: 'Délai (s)',
  rot: 'Rotation (°)',
  world: 'Monde',
  theme: 'Thème',
};

export const OPTION_LABELS: Record<string, string> = {
  wide: 'large',
  normal: 'normale',
  narrow: 'étroite',
  rail: 'rail',
  none: 'aucune',
  left: 'gauche',
  right: 'droite',
  both: 'les deux',
  cream: 'crème',
  mint: 'menthe',
  rose: 'rose',
  lav: 'lavande',
  wood: 'bois',
  garden: 'jardin',
  sunset: 'couchant',
  glacier: 'glacier',
  factory: 'usine',
};
