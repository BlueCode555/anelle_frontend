export const TOKEN_KEY = 'access_token';
export const REFRESH_KEY = 'refresh_token';
// Profil avec lequel le personnel travaille (envoye au serveur dans l'en-tete X-Profil)
export const PROFIL_KEY = 'anelle_profil_actif';
// Page voulue avant la connexion : on y revient une fois connecte.
export const RETOUR_KEY = 'anelle_retour';

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
