import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom, map } from 'rxjs';

import { environment } from 'src/environments/environment';
import { chaineAleatoire, defiPkce } from '../_helpers/pkce';
import { ID_TOKEN_KEY, LOGIN_FLOW_KEY, PROFIL_KEY, REFRESH_KEY, TOKEN_KEY, isTokenExpired, millisAvantExpiration } from '../_helpers/token-storage';
import { ApiResponse } from './api.model';

const PKCE_KEY = 'anelle_pkce';

interface ReponseJeton {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
}

export interface CurrentUser {
  type: 'CLIENT' | 'PERSONNEL';
  email: string;
  nom?: string | null;
  prenom?: string | null;
  photoUrl?: string | null;
  roles: string[];
  clientCode?: string | null;
  // Personnel : l'esthéticienne a tous les droits ; les autres ont un ou plusieurs profils et travaillent avec l'un d'eux.
  superAdmin?: boolean;
  profils?: ProfilAcces[];
}

export interface ProfilAcces {
  code: string;
  libelle: string;
  description?: string | null;
  permissions: Permission[];
}

export type EcranCode = 'AGENDA' | 'INFORMATIONS' | 'CATEGORIES' | 'SERVICES';
export type ActionCode = 'lire' | 'creer' | 'modifier' | 'supprimer';

export interface Permission {
  ecran: EcranCode;
  lire: boolean;
  creer: boolean;
  modifier: boolean;
  supprimer: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  user = signal<CurrentUser | null>(null);
  // Profil avec lequel le collaborateur travaille (memorise dans le navigateur ; le premier par defaut)
  private profilChoisi = signal<string | null>(this.lireProfilChoisi());
  profilActif = computed<ProfilAcces | null>(() => {
    const u = this.user();
    if (!u || u.type !== 'PERSONNEL' || u.superAdmin) return null;
    const liste = u.profils ?? [];
    return liste.find((p) => p.code === this.profilChoisi()) ?? liste[0] ?? null;
  });
  // Un collaborateur qui a plusieurs profils peut en changer
  peutChangerProfil = computed(() => {
    const u = this.user();
    return !!u && u.type === 'PERSONNEL' && !u.superAdmin && (u.profils?.length ?? 0) > 1;
  });
  loading = signal(false);
  isLoggedIn = computed(() => this.user() !== null);
  displayName = computed(() => {
    const u = this.user();
    return u ? u.prenom || u.nom || u.email : '';
  });

  // Affichage seulement : le serveur refuse de toute façon ce que le profil n'autorise pas.
  // Sans profil chargé (page publique), rien n'est masqué : l'espace de gestion, lui, exige une connexion.
  peut(ecran: EcranCode, action: ActionCode = 'lire'): boolean {
    const u = this.user();
    if (!u) return true;
    if (u.type !== 'PERSONNEL') return false;
    if (u.superAdmin) return true;
    return !!this.profilActif()?.permissions.some((p) => p.ecran === ecran && p[action]);
  }

  changerProfil(code: string): void {
    this.profilChoisi.set(code);
    try {
      localStorage.setItem(PROFIL_KEY, code);
    } catch {
      // stockage indisponible : le choix vaut pour cette page seulement
    }
  }

  private lireProfilChoisi(): string | null {
    try {
      return localStorage.getItem(PROFIL_KEY);
    } catch {
      return null;
    }
  }

  // Ecrit le profil effectivement utilise (premier par defaut) pour que le serveur applique le meme que l'ecran.
  private memoriserProfilActif(): void {
    const actif = this.profilActif();
    try {
      if (actif) localStorage.setItem(PROFIL_KEY, actif.code);
      else localStorage.removeItem(PROFIL_KEY);
    } catch {
      // ignore
    }
  }

  // Écrans réservés à l'esthéticienne (collaborateurs, profils).
  estProprietaire(): boolean {
    const u = this.user();
    return !u || (u.type === 'PERSONNEL' && !!u.superAdmin);
  }

  private pretResolve: () => void = () => undefined;
  private pretPromise = new Promise<void>((resolve) => (this.pretResolve = resolve));
  private rafraichissement: Promise<string | null> | null = null;
  private minuteur: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.restoreSession();
  }

  // Se resout quand la restauration de la session (lecture du profil) est terminee : les gardes de routes l'attendent.
  pret(): Promise<void> {
    return this.pretPromise;
  }

  restoreSession(): void {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token && !isTokenExpired(token)) {
      this.planifierRenouvellement(token);
      this.fetchProfile();
      return;
    }
    if (localStorage.getItem(REFRESH_KEY)) {
      // Personnel dont le jeton d'acces a expire : on le renouvelle en silence.
      this.rafraichir().then((nouveau) => (nouveau ? this.fetchProfile() : this.pretResolve()));
      return;
    }
    localStorage.removeItem(TOKEN_KEY);
    this.user.set(null);
    this.pretResolve();
  }

  logout(): void {
    const idToken = localStorage.getItem(ID_TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(ID_TOKEN_KEY);
    localStorage.removeItem(PROFIL_KEY);
    if (this.minuteur) clearTimeout(this.minuteur);
    this.user.set(null);
    if (environment.keycloak.url) {
      // Ferme aussi la session chez Keycloak (personnel ET clientes), puis revient sur le site. Indispensable
      // pour une cliente : sinon Keycloak la reconnecte en silence (SSO) au meme compte Google au prochain
      // "Continuer avec Google", sans jamais lui laisser la main pour en choisir un autre.
      // id_token_hint prouve a Keycloak qui se deconnecte : sans lui, Keycloak affiche son propre ecran
      // de confirmation ("Vous etes deconnecte") meme si la session locale est deja terminee.
      const params = new URLSearchParams({
        client_id: environment.keycloak.clientId,
        post_logout_redirect_uri: `${window.location.origin}/accueil`
      });
      if (idToken) params.set('id_token_hint', idToken);
      window.location.href = `${this.urlKeycloak()}/logout?${params.toString()}`;
      return;
    }
    this.router.navigate(['/accueil']);
  }

  // ── Connexion (Keycloak, flux code d'autorisation + PKCE) — personnel et clientes ─────

  get keycloakConfigure(): boolean {
    return !!environment.keycloak.url;
  }

  private urlKeycloak(): string {
    return `${environment.keycloak.url}/realms/${environment.keycloak.realm}/protocol/openid-connect`;
  }

  private urlRetour(): string {
    return `${window.location.origin}/auth/callback`;
  }

  // Envoie la personne sur la page de connexion de Keycloak (adresse e-mail + mot de passe du personnel).
  async loginPersonnel(): Promise<void> {
    await this.demarrerLogin('personnel', {});
  }

  // Envoie directement vers "Se connecter avec Google" (kc_idp_hint saute l'ecran de connexion de Keycloak
  // lui-meme) : les clientes n'ont jamais de mot de passe Keycloak a retenir.
  async loginClient(): Promise<void> {
    await this.demarrerLogin('client', { kc_idp_hint: 'google' });
  }

  private async demarrerLogin(flux: 'client' | 'personnel', extra: Record<string, string>): Promise<void> {
    const verifier = chaineAleatoire(64);
    const state = chaineAleatoire(24);
    sessionStorage.setItem(PKCE_KEY, JSON.stringify({ verifier, state }));
    sessionStorage.setItem(LOGIN_FLOW_KEY, flux);
    const params = new URLSearchParams({
      client_id: environment.keycloak.clientId,
      redirect_uri: this.urlRetour(),
      response_type: 'code',
      scope: 'openid profile email',
      code_challenge: await defiPkce(verifier),
      code_challenge_method: 'S256',
      state,
      // prompt=login force une vraie reconnexion a chaque fois, meme si Keycloak a deja une session ouverte
      // (SSO) pour quelqu'un d'autre sur cet appareil (ex. tester la connexion cliente puis personnel de
      // suite) : sans ca, Keycloak reconnecte en silence la session existante, quel que soit le bouton clique.
      prompt: 'login',
      ...extra
    });
    window.location.href = `${this.urlKeycloak()}/auth?${params.toString()}`;
  }

  // Appele au retour de Keycloak (personnel ou cliente) : echange le code contre les jetons, puis lit le profil.
  // Renvoie vrai si la connexion a abouti, quel que soit le type de compte obtenu.
  async terminerLogin(code: string, state: string): Promise<boolean> {
    const brut = sessionStorage.getItem(PKCE_KEY);
    sessionStorage.removeItem(PKCE_KEY);
    if (!brut) return false;
    const { verifier, state: attendu } = JSON.parse(brut) as { verifier: string; state: string };
    if (state !== attendu) return false;

    try {
      const jetons = await this.demanderJetons({
        grant_type: 'authorization_code',
        client_id: environment.keycloak.clientId,
        code,
        redirect_uri: this.urlRetour(),
        code_verifier: verifier
      });
      this.enregistrerJetons(jetons);
    } catch {
      return false;
    }
    return new Promise<boolean>((resolve) => this.fetchProfile(() => resolve(true), () => resolve(false)));
  }

  // Renouvelle le jeton d'acces avec le jeton de rafraichissement ; renvoie le nouveau jeton ou null (session terminee).
  rafraichir(): Promise<string | null> {
    if (this.rafraichissement) return this.rafraichissement;
    const refresh = localStorage.getItem(REFRESH_KEY);
    if (!refresh) return Promise.resolve(null);
    this.rafraichissement = this.demanderJetons({
      grant_type: 'refresh_token',
      client_id: environment.keycloak.clientId,
      refresh_token: refresh
    })
      .then((jetons) => {
        this.enregistrerJetons(jetons);
        return jetons.access_token;
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_KEY);
        localStorage.removeItem(ID_TOKEN_KEY);
        this.user.set(null);
        return null;
      })
      .finally(() => (this.rafraichissement = null));
    return this.rafraichissement;
  }

  private demanderJetons(champs: Record<string, string>): Promise<ReponseJeton> {
    return firstValueFrom(
      this.http.post<ReponseJeton>(`${this.urlKeycloak()}/token`, new URLSearchParams(champs).toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      })
    );
  }

  private enregistrerJetons(jetons: ReponseJeton): void {
    localStorage.setItem(TOKEN_KEY, jetons.access_token);
    if (jetons.refresh_token) localStorage.setItem(REFRESH_KEY, jetons.refresh_token);
    if (jetons.id_token) localStorage.setItem(ID_TOKEN_KEY, jetons.id_token);
    this.planifierRenouvellement(jetons.access_token);
  }

  // Renouvelle le jeton une minute avant son expiration pour ne jamais interrompre le travail en cours.
  private planifierRenouvellement(token: string): void {
    if (this.minuteur) clearTimeout(this.minuteur);
    if (!localStorage.getItem(REFRESH_KEY)) return;
    const delai = Math.max(5000, millisAvantExpiration(token) - 60000);
    this.minuteur = setTimeout(() => this.rafraichir(), delai);
  }

  private fetchProfile(onSuccess?: () => void, onError?: () => void): void {
    this.loading.set(true);
    this.http
      .get<ApiResponse<CurrentUser>>(`${environment.apiUrl}/me`)
      .pipe(map((res) => res.data))
      .subscribe({
        next: (user) => {
          this.user.set(user);
          this.memoriserProfilActif();
          this.loading.set(false);
          this.pretResolve();
          onSuccess?.();
        },
        error: (err) => {
          // Token refuse par le serveur (expire, mauvaise audience...) : on repart d'une session vide.
          // Une simple panne du serveur (pas de reponse) ne deconnecte pas.
          if (err?.status === 401 || err?.status === 403) {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(REFRESH_KEY);
            localStorage.removeItem(ID_TOKEN_KEY);
          }
          this.user.set(null);
          this.loading.set(false);
          this.pretResolve();
          onError?.();
        }
      });
  }

}
