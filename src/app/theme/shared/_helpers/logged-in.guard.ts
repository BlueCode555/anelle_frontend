import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService, EcranCode } from '../service/auth.service';
import { RETOUR_CLIENT_KEY, RETOUR_STAFF_KEY, TOKEN_KEY, isTokenExpired } from './token-storage';

// Laisse passer uniquement une personne avec un token non expire ; sinon renvoie vers la page de connexion
// en gardant la page voulue : apres la connexion la personne y revient (ex. la reservation d'un soin).
// Confort d'affichage seulement : la vraie protection des donnees est faite par le serveur.
export const loggedInGuard: CanActivateFn = (_route, state) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token && !isTokenExpired(token)) {
    return true;
  }
  sessionStorage.setItem(RETOUR_CLIENT_KEY, state.url);
  return inject(Router).createUrlTree(['/connexion']);
};

// Espace de gestion : reserve au personnel connecte (compte Keycloak). Les autres vont a la page de connexion du personnel.
// Confort d'affichage : le serveur refuse de toute facon les appels sans les droits.
export const staffGuard: CanActivateFn = async (_route, state) => {
  // inject() n'est utilisable qu'avant le premier await
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.pret();
  if (auth.user()?.type === 'PERSONNEL') {
    return true;
  }
  sessionStorage.setItem(RETOUR_STAFF_KEY, state.url);
  return router.createUrlTree(['/personnel']);
};

// Ecran reserve a un droit : un profil qui n'a pas le droit de lire l'ecran (ou qui n'est pas la proprietaire pour les
// ecrans d'administration) est renvoye au tableau de bord meme s'il tape l'adresse a la main. Le serveur refuse de toute facon.
export const droitGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const ecran = route.data['ecran'] as EcranCode | undefined;
  if (route.data['proprietaire'] === true && !auth.estProprietaire()) {
    return router.createUrlTree(['/default']);
  }
  if (ecran && !auth.peut(ecran)) {
    return router.createUrlTree(['/default']);
  }
  return true;
};
