/** French UI strings. English arrives with the i18n work in phase 4. */
export const fr = {
  touchHint: 'Pose ton pouce et glisse pour pencher le parcours',
  tiltUnavailable:
    'Le capteur d’inclinaison n’est pas accessible depuis cette page. Contrôle au doigt activé : pose ton pouce et glisse.',
  tiltReady: 'Penche ton téléphone !',
  calibrated: 'Position neutre enregistrée',
  noTiltReading: 'Aucune mesure du capteur pour l’instant',
  allCrystals: 'Tous les cristaux ! Fonce vers l’anneau doré',
  checkpoint: 'Checkpoint !',
  fell: 'Oups !',
  missingCrystals: (n: number) => `Il manque encore ${n} cristal${n > 1 ? 'x' : ''} !`,
  hiddenGem: 'Gemme cachée trouvée !',
  shieldSaved: 'La bulle t’a rattrapé !',
  /** Toast when a bonus or malus goes off (zones: only the first time in a run). */
  modifiers: {
    hourglass: '−5 s au chrono !',
    magnet: 'Aimant : les cristaux viennent à toi',
    shield: 'Bulle-bouclier : ta prochaine chute est annulée',
    slowMo: 'Ralenti !',
    feather: 'Bille plume : tu sautes plus loin',
    heavy: 'Bille lourde !',
    ice: 'Glace : ça glisse !',
    sand: 'Sable : ça freine',
    wind: 'Attention au vent',
    conveyor: 'Tapis roulant',
    invert: 'Commandes inversées !',
    fog: 'Brouillard…',
  },
  /** Short names of the effects shown under the HUD. */
  effects: {
    magnet: 'Aimant',
    shield: 'Bulle',
    slowMo: 'Ralenti',
    feather: 'Plume',
    heavy: 'Lourde',
  },
  stars: { finished: 'Terminé', underPar: (par: number) => `Moins de ${par} s`, noFall: 'Sans chute' },
  gemFound: 'Gemme cachée trouvée',
  gemMissed: 'Une gemme cachée t’attend quelque part…',
} as const;
