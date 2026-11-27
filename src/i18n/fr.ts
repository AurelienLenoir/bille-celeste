/** French UI strings. English arrives with the i18n work in phase 4. */
export const fr = {
  touchHint: 'Pose ton pouce et glisse pour pencher le parcours',
  tiltUnavailable:
    'Le capteur d’inclinaison n’est pas accessible depuis cette page. Contrôle au doigt activé : pose ton pouce et glisse.',
  tiltReady: 'Penche ton téléphone !',
  calibrated: 'Position neutre enregistrée',
  allCrystals: 'Tous les cristaux ! Fonce vers l’anneau doré',
  checkpoint: 'Checkpoint !',
  fell: 'Oups !',
  missingCrystals: (n: number) => `Il manque encore ${n} cristal${n > 1 ? 'x' : ''} !`,
} as const;
