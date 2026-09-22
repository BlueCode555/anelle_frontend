export const TOKEN_KEY = 'access_token';
export const REFRESH_KEY = 'refresh_token';
// Jeton d'identite (id_token) : sert uniquement a fermer la session Keycloak en silence a la deconnexion
// (parametre id_token_hint), sans quoi Keycloak affiche son propre ecran de confirmation de deconnexion.
export const ID_TOKEN_KEY = 'id_token';
// Profil avec lequel le personnel travaille (envoye au serveur dans l'en-tete X-Profil)
export const PROFIL_KEY = 'anelle_profil_actif';
// Page voulue avant la connexion : on y revient une fois connecte. Deux cles distinctes : sans ca, une page
// client demandee avant de se connecter (ex. /reserver) pouvait etre reutilisee par erreur comme destination
// apres une connexion du PERSONNEL faite juste apres par un autre chemin (ex. lien "Espace administration").
export const RETOUR_CLIENT_KEY = 'anelle_retour_client';
export const RETOUR_STAFF_KEY = 'anelle_retour_staff';
// Quel bouton de connexion a ete utilise (client ou personnel) : permet à auth-callback de savoir, meme en cas
// d'echec de connexion (donc sans jeton pour le dire), vers quelle page d'erreur renvoyer la personne.
export const LOGIN_FLOW_KEY = 'anelle_login_flow';

// Lit la date d'expiration (claim "exp") d'un JWT sans verifier sa signature : le serveur reste juge.
export function isTokenExpired(token: string, margeSecondes = 0): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp !== 'number' || payload.exp * 1000 - margeSecondes * 1000 <= Date.now();
  } catch {
    return true;
  }
}

// Millisecondes avant l'expiration du token (0 s'il est illisible ou deja expire).
export function millisAvantExpiration(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return Math.max(0, payload.exp * 1000 - Date.now());
  } catch {
    return 0;
  }
}
