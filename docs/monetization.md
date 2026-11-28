# Skins, plumes, pubs et achats (phase 9)

## Économie

- **Plumes** : +10 par nouvelle étoile, +25 la première fois qu'on trouve la gemme cachée d'un niveau, +30 pour le défi du jour (le même pour tous les joueurs un jour donné : terminer sans tomber, sous le temps de référence, trouver une gemme ou terminer 3 niveaux).
- **Skins** : 12 billes dans `src/meta/skins.ts` (données validées par Zod), de 60 à 900 plumes. Purement esthétiques.
- Sauvegarde séparée `bille-celeste.wallet` (version 1, validée et réparée au chargement).

## Pubs (AdMob)

- **Récompensées, au choix du joueur** : « Continuer ici » après une chute (une fois par niveau, proposé 4,5 s) et « Doubler les plumes » sur l'écran de victoire.
- **Interstitielles** : au plus une toutes les 3 victoires, jamais dans les 5 premiers niveaux, jamais pendant une partie (seulement en quittant l'écran de victoire).
- **Consentement** : formulaire UMP de Google (RGPD) au premier passage sur la carte des mondes, puis la demande ATT d'Apple sur iPhone. En cas de refus : pubs non personnalisées, ou pas de pub du tout ; le jeu marche pareil.
- **Public** : 13 ans et plus, contenu des pubs limité à « tout public » (`MaxAdContentRating.General`). Voir PLAN.md § 10.5 : à confirmer avant la sortie.
- **Sans compte AdMob**, les apps utilisent les blocs de test publics de Google (`src/platform/ads.ts`) : tout le parcours est testable, rien n'est payé.

### Brancher le vrai compte AdMob

1. Créer les deux apps (iOS, Android) dans AdMob, et pour chacune un bloc « Avec récompense » et un bloc « Interstitiel ».
2. Remplacer les identifiants d'app de test : `GADApplicationIdentifier` dans `ios/App/App/Info.plist`, `com.google.android.gms.ads.APPLICATION_ID` dans `android/app/src/main/AndroidManifest.xml`.
3. Donner les blocs au build (`.env.local` ou secrets CI) :

```bash
VITE_ADMOB_IOS_REWARDED=ca-app-pub-xxx/yyy
VITE_ADMOB_IOS_INTERSTITIAL=ca-app-pub-xxx/yyy
VITE_ADMOB_ANDROID_REWARDED=ca-app-pub-xxx/yyy
VITE_ADMOB_ANDROID_INTERSTITIAL=ca-app-pub-xxx/yyy
```

4. Dans AdMob → Confidentialité et messages : créer le message RGPD (UMP) et le message IDFA.

## Achats intégrés (RevenueCat)

| Produit (id dans les stores) | Type | Effet |
|---|---|---|
| `bille_no_ads` | non consommable, droit RevenueCat `no_ads` | plus d'interstitielles, récompenses des pubs offertes |
| `bille_feathers_500` | consommable | +500 plumes |
| `bille_feathers_1500` | consommable | +1 500 plumes |

Bouton « Restaurer mes achats » dans la boutique (exigé par Apple). « Sans pub » est aussi vérifié à chaque lancement.

### Brancher RevenueCat

1. Créer les produits ci-dessus dans App Store Connect et la Play Console.
2. Dans RevenueCat : un projet, les deux apps, les produits, et le droit (*entitlement*) `no_ads` rattaché à `bille_no_ads`.
3. Donner les clés publiques au build :

```bash
VITE_REVENUECAT_IOS=appl_xxx
VITE_REVENUECAT_ANDROID=goog_xxx
```

4. Tester en sandbox (compte testeur Apple, testeurs de licence Google) avant la publication.

Sans ces clés, la boutique n'affiche que les skins (achetables en plumes), sans section « Achats ».
