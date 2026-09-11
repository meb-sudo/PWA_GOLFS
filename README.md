# PWA Réservation Membres

Portage de l'application WinDev Mobile `RESERVATION_ABONNE_PRESTIGIA_WM30`
vers une Progressive Web App, sans modification des API existantes.

```
pwa-golf/
├── packages/contracts/   Schémas Zod + types partagés (structures WinDev)
├── apps/bff/             Service intermédiaire Fastify
└── apps/web/             PWA React
```

## Démarrage

```bash
npm install
cp .env.example .env
npm run build --workspace=@golf/contracts
npm run dev
```

La PWA écoute sur `http://localhost:5180`, le BFF sur `http://localhost:3001`.
Vite proxifie `/api` vers le BFF : **la PWA n'appelle jamais que sa propre
origine**, ce qui rend l'absence de CORS sur l'API amont sans effet.

> `packages/contracts` doit être compilé avant `apps/bff` et `apps/web`.
> `npm run build` à la racine respecte cet ordre.

## Mode lecture seule

`READ_ONLY=true` (défaut) bloque **tout appel amont qui écrit** : réservation,
annulation, changement d'horaire, inscription en compétition, modification de
profil. À laisser actif tant qu'aucun environnement de recette n'est confirmé,
pour ne pas créer de vraies réservations en production.

Un appel bloqué renvoie `503 { "error": "read_only" }`.

## Changer de groupe ou de couleurs

Tout se passe dans le fichier `.env` a la racine du projet.

```env
DEFAULT_GROUP=CLUBS_GRP_MADAEF     # ce que renvoie l'API : clubs, competitions, connexion
THEME=CLUBS_GRP_PRESTIGIA          # l'apparence. Vide = les couleurs suivent le groupe
```

Les deux sont independants : on peut afficher les donnees d'un groupe avec la
palette d'un autre.

Valeurs acceptees, pour l'un comme pour l'autre :

| | |
|---|---|
| `CLUBS_GRP_PRESTIGIA` | `CLUBS_GRP_YAPO` |
| `CLUBS_GRP_MADAEF` | `CLUBS_GRP_RGAM` |
| `CLUBS_GRP_ALMAADEN` | `CLUBS_GRP_RGDES` |
| `CLUBS_GRP_OCEAN` | `CLUBS_GRP_RGM` |
| `CLUBS_GRP_MAROGOLF` | |

En developpement, le BFF **relit `DEFAULT_GROUP`, `THEME` et `GROUP_HOST_MAP`
a chaud** : enregistrez le `.env`, rechargez la page, la nouvelle valeur
s'applique — sans redemarrer le serveur. Le reste (ports, secrets) reste fige
au demarrage.

Deux precisions :

- **Une session deja ouverte garde son groupe** : il a ete fixe a la connexion.
  Pour qu'un changement de `DEFAULT_GROUP` s'y applique, deconnectez-vous et
  reconnectez-vous. La page de connexion, elle, reflete le nouveau groupe
  immediatement.
- Pour verifier ce qui est actif : `http://localhost:3001/api/context` renvoie
  `{"group":"...","theme":"..."}`.

> En production le fichier n'est lu qu'au demarrage : un redeploiement, ou un
> redemarrage du service, est necessaire.

> Un adherent doit etre membre d'un club du groupe choisi, sinon la connexion
> echoue. Une meme licence peut appartenir a plusieurs groupes, avec un club
> et des droits differents dans chacun.

## Se connecter en recette

Le code de double authentification est vérifié **côté serveur** : contrairement
à l'application WinDev, il n'est jamais transmis au navigateur et il n'existe
aucun code maître.

Pour tester sans accéder à la boîte mail du compte, mettez dans `.env` :

```env
DEV_LOG_AUTH_CODE=true
```

Le code s'affiche alors dans le terminal où tourne `npm run dev` :

```
[bff] "[RECETTE] Code de validation pour xyp@yapo.ma : 483027"
```

Ce n'est pas un contournement : le code affiché est le vrai code, il expire au
bout de 10 minutes et reste limité à 5 tentatives. Double verrou — il faut
l'opt-in explicite **et** `NODE_ENV` différent de `production`. Un `NODE_ENV`
oublié au déploiement ne suffit donc pas à l'activer.

## Multi-club

Le groupe n'est **jamais** une constante de compilation — contrairement aux
neuf configurations WinDev compilées séparément. Il est résolu à l'exécution
par le BFF depuis l'hôte appelant, avec repli sur `DEFAULT_GROUP` :

```env
GROUP_HOST_MAP=prestigia.golfs.ma:CLUBS_GRP_PRESTIGIA,yapo.golfs.ma:CLUBS_GRP_YAPO
DEFAULT_GROUP=CLUBS_GRP_PRESTIGIA
```

Les deux stratégies de déploiement fonctionnent avec le même code :

- **sous-domaines** — un hôte par groupe, via `GROUP_HOST_MAP` ;
- **domaine unique** — `DEFAULT_GROUP` seul, le groupe est porté par la session.

Basculer de l'une à l'autre est un changement de configuration.
Le thème (couleurs, logo) suit le groupe résolu : `apps/web/src/theme/groups.ts`
reprend les couleurs des neuf configurations WinDev sous forme de jetons CSS.

## Ce que le BFF corrige

Repris de l'audit de sécurité. Aucun de ces points n'exige de modifier l'API
amont — mais le BFF protège la PWA, **pas l'API**, qui reste ouverte en direct.

| Constat | Traitement |
|---|---|
| C-01 code maître `124816` | Non porté. La vérification est serveur, il n'existe aucun contournement. |
| C-02 code 2FA renvoyé au client | Le code reste dans `session/store.ts`, haché ; le navigateur ne reçoit qu'un verdict. 5 tentatives, 10 minutes. |
| C-03 aucune authentification | Session en cookie `httpOnly`+`Secure`+signé. Chaque réservation est vérifiée comme appartenant à la session avant lecture ou écriture. |
| C-04 HTTP en clair | `upstream/http.ts` force `https://` même si la configuration demande `http://`. |
| E-05 énumération des licences | Message d'erreur générique, limitation de débit sur `/auth/login` et `/auth/verify`. |
| E-06 `sMDP_Web` dans la réponse | Absent du schéma `Member` : ne franchit jamais le BFF. |
| E-07 données personnelles en URL | Recherche de joueurs en `POST`. Journaux sans query string. |
| M-08 fuite d'informations techniques | Aucun message amont relayé ; erreurs normalisées. |
| M-09 suppression sur `GET` | Exposé en `DELETE` côté PWA. |
| M-10 en-têtes de sécurité | `@fastify/helmet` : HSTS, `X-Content-Type-Options`, `X-Frame-Options`. |

## Conventions de l'API amont, absorbées une seule fois

Formats relevés sur l'API réelle, transposés dans `packages/contracts` :

| Élément | Format amont | Exposé par le BFF |
|---|---|---|
| Date en paramètre | `AAAAMMJJ` | `AAAA-MM-JJ` |
| Heure en réponse | `HH:MM:SS.mmm` | `HH:MM` |
| Heure de départ joueur | `HHMM` (`"1032"`) | `HH:MM` |
| Résultat d'appel | `sMessage` en HTTP 200 | Vrai code HTTP |
| Groupe inconnu | ligne `- SANS CLUB -` | Liste vide |

`GET_ALL_INFOS_CLUB` est l'appel pivot : règles de réservation, parcours,
tarifs, pays. Il est mis en cache 5 minutes plutôt que rappelé à chaque écran.

## Règle métier

`Date_Heure_Valide_Resa` est la seule règle calculée côté client dans WinDev.
Elle est transposée dans `packages/contracts/src/rules.ts` (`bookingWindow`,
`clampToWindow`, `canCancel`, `isDayAllowed`) et utilisée par l'écran de
critères. Tout le reste est décidé par le serveur.

## Écrans

Parcours de réservation, en cinq étapes, brouillon persistant en
`sessionStorage` — il survit à un rafraîchissement, à une perte de réseau et au
retour depuis la page de paiement :

```
/reserver → /reserver/creneaux → /reserver/joueurs
          → /reserver/prestations → /reserver/recapitulatif
          → /reserver/confirmee   ou paiement en ligne
```

Reste : `/`, `/reservations`, `/reservations/:id`, `/competitions`,
`/actualites`, `/actualites/:id`, `/notifications`, `/profil`, `/profil/carte`,
`/profil/carnets`, `/menu`, `/connexion`, `/connexion/code`,
`/connexion/identifiants`.

## État de vérification

Vérifié :

- les trois paquets compilent sans erreur TypeScript ;
- le BFF démarre, sert `/api/health`, refuse les requêtes sans session (401),
  pose ses en-têtes de sécurité et n'autorise le CORS que pour `WEB_ORIGIN` ;
- la connexion a été testée de bout en bout contre l'API de production avec
  des identifiants fictifs : le message d'énumération amont est bien remplacé
  par un message générique.

Non vérifié, faute de compte de test :

- réponse de connexion réelle, et donc si `sMDP_Web` porte une valeur ;
- si l'e-mail est réellement contrôlé contre la licence côté amont ;
- tout appel qui écrit (`READ_ONLY=true` les bloque).

## Reste à faire

- **Web Push** — `SET_TOKEN_AUTH` attend une chaîne, un abonnement navigateur
  est un objet. Prévoir des clés VAPID et un stockage des abonnements côté BFF.
- **Sessions** — `session/store.ts` est en mémoire. Pour plusieurs instances
  de BFF, remplacer par Redis en gardant la même interface.
- **Retour de paiement** — définir l'URL de retour et la notification serveur
  du résultat.
- **Anglais** — les structures portent des libellés `_FR` et `_EN` ;
  l'interface est aujourd'hui en français seul.
