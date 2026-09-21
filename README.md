# anelle-front

Frontend du projet ANELLE — site vitrine + back-office pour **Arnelle Institut** (soins esthetiques :
pedicure, manucure, soins du corps). Angular 22 + Bootstrap 5, construit sur le template Berry Admin.

## Prerequis

- Node.js
- Le backend [`anelle_back`](../anelle_back) lance en local (voir son README pour la configuration Postgres)

## Lancer le projet

```powershell
npm install
npm start
```

Le site est servi sur `http://localhost:4200`.

- `/accueil` — vitrine publique (services + tarifs, dynamique via l'API backend)
- `/connexion` — connexion des clientes (methode a choisir) ; `/personnel` — connexion du personnel via Keycloak
- `/mon-espace` — espace du client connecte (profil, historique des rendez-vous et paiements)
- `/default`, `/categories`, `/services` — back-office (pas encore protege par une connexion cote interface ;
  le serveur, lui, refuse deja toute ecriture sans role du personnel)
- `/login`, `/register` — restes du template Berry, inutilises

## Informations de l'institut

Le nom, la phrase d'accroche, la description, l'adresse, le telephone, l'e-mail, les liens (site, Instagram,
Facebook), la banniere promo et les horaires ne sont plus ecrits dans le code : ils viennent de la base
(`GET /informations`) et sont modifiables dans le back-office, menu **Institut > Informations** (`/informations`,
reserve au role `ESTHETICIENNE`). La banniere promo et la rubrique « Horaires » n'apparaissent sur l'accueil que
si elles sont renseignees.

## Images du site

Les photos de l'accueil (portrait et carrousel par defaut) sont chargees par lien en ligne depuis Pexels
(licence libre, usage commercial autorise) : rien n'est stocke dans le projet ni en base. Dans le back-office,
une categorie ou un service peut recevoir une image soit par envoi de fichier, soit en collant un lien
`https://` vers une image en ligne ; ces images alimentent le carrousel de l'accueil.

## Connexion des clientes

La methode de connexion des clientes reste a choisir : la page `/connexion` l'indique en attendant.

## Structure

- `src/app/public/` — pages publiques du site vitrine (page d'accueil pour l'instant)
- `src/app/theme/layout/admin/` — coquille du back-office (sidebar, header, menu)
- `src/app/theme/layout/guest/` — coquille des pages sans sidebar (accueil, login, register)
- `src/app/theme/shared/service/` — clients HTTP generiques (`ApiService`) et specifiques
  (`CatalogueService` pour categories/services), calques sur `MasterController` cote backend
- `src/app/demo/` — reste du template Berry ; les pages de demo inutiles (Typography, Colors, Sample Page,
  widgets factices du dashboard) ont ete retirees

## Palette de couleurs

Definie dans `src/scss/settings/bootstrap-variables.scss` et `theme-variables.scss` :

- Creme `#fbf6ec` — fond du contenu
- Beige nude `#e6d9c3` — bordures, surfaces douces
- Brun chocolat `#6b4423` (clair) / `#4a2e17` (fonce) — couleur primaire, header/sidebar
- Dore `#c9a227` / `#e8c874` — couleur secondaire, accents

## Etat actuel / prochaines etapes

Fait :
- Page d'accueil publique dynamique (categories + services depuis l'API, filtre par categorie)
- Carrousel d'accueil alimente par les images envoyees sur les categories/services (photos par defaut sinon)
- Theme applique (couleurs, header/sidebar, nettoyage des elements du template Berry)
- Dashboard avec statistiques reelles (categories, services actifs, tarif moyen, services par categorie)
- Ecrans de gestion Categorie et Service en popup, avec envoi d'image

A faire :
- Authentification reelle via Keycloak : sans token, creer/modifier/supprimer et l'envoi d'images sont refuses (401).
  Les pages `/login` et `/register` sont des restes du template et ne sont pas branchees.
- Entites/ecrans Estheticienne, Assistante, Disponibilite, Notification
- Logo definitif (en attente de validation avec la cliente)
