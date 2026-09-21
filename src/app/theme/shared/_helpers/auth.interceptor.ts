import { HttpInterceptorFn } from '@angular/common/http';
import { Injector, inject } from '@angular/core';
import { from, switchMap } from 'rxjs';

import { environment } from 'src/environments/environment';
import { AuthService } from '../service/auth.service';
import { PROFIL_KEY, REFRESH_KEY, TOKEN_KEY, isTokenExpired } from './token-storage';

// Attache le token de connexion (Keycloak) aux requetes vers l'API anelle seulement.
// Un token du personnel expire est renouvele avec son jeton de rafraichissement avant l'envoi ;
// sinon il est retire et jamais envoye : le serveur repondrait 401 meme sur les pages publiques.
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiUrl)) {
    return next(req);
  }
  const injector = inject(Injector);
  const token = localStorage.getItem(TOKEN_KEY);
  const profil = localStorage.getItem(PROFIL_KEY);
  const avecToken = (t: string) =>
    req.clone({ setHeaders: profil ? { Authorization: `Bearer ${t}`, 'X-Profil': profil } : { Authorization: `Bearer ${t}` } });

  if (!token) {
    return next(req);
  }
  if (!isTokenExpired(token)) {
    return next(avecToken(token));
  }
  if (localStorage.getItem(REFRESH_KEY)) {
    // AuthService est demande a ce moment seulement (il utilise lui-meme HttpClient).
    return from(injector.get(AuthService).rafraichir()).pipe(
      switchMap((nouveau) => next(nouveau ? avecToken(nouveau) : req))
    );
  }
  localStorage.removeItem(TOKEN_KEY);
  return next(req);
};
