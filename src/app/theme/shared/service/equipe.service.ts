import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from 'src/environments/environment';
import { ApiResponse } from './api.model';
import { EcranCode, Permission } from './auth.service';

export interface Profil {
  id: number;
  code: string;
  libelle: string;
  description: string | null;
  actif: boolean;
  permissions: Permission[];
  nombreCollaborateurs: number;
}

export interface ProfilForm {
  libelle: string;
  description?: string;
  actif: boolean;
  permissions: Permission[];
}

export interface Collaborateur {
  id: number;
  code: string;
  email: string;
  nom: string;
  prenom: string;
  profils: { code: string; libelle: string }[];
  actif: boolean;
  compteCree: boolean;
  // Renseigne seulement juste apres la creation ou une reinitialisation : a transmettre a la personne, jamais reaffiche.
  motDePasseProvisoire: string | null;
}

export interface CollaborateurForm {
  email: string;
  nom: string;
  prenom: string;
  profilCodes: string[];
}

export interface CollaborateurUpdateForm {
  nom: string;
  prenom: string;
  profilCodes: string[];
  actif: boolean;
}

export interface EcranInfo {
  code: EcranCode;
  libelle: string;
}

// Profils, droits par écran et comptes du personnel : réservé à l'esthéticienne.
@Injectable({ providedIn: 'root' })
export class EquipeService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  ecrans(): Observable<EcranInfo[]> {
    return this.http.get<ApiResponse<EcranInfo[]>>(`${this.base}/profils/ecrans`).pipe(map((r) => r.data));
  }

  profils(): Observable<Profil[]> {
    return this.http.get<ApiResponse<Profil[]>>(`${this.base}/profils`).pipe(map((r) => r.data));
  }

  creerProfil(form: ProfilForm): Observable<Profil> {
    return this.http.post<ApiResponse<Profil>>(`${this.base}/profils`, form).pipe(map((r) => r.data));
  }

  modifierProfil(id: number, form: ProfilForm): Observable<Profil> {
    return this.http.put<ApiResponse<Profil>>(`${this.base}/profils/${id}`, form).pipe(map((r) => r.data));
  }

  supprimerProfil(id: number): Observable<boolean> {
    return this.http.delete<ApiResponse<boolean>>(`${this.base}/profils/${id}`).pipe(map((r) => r.data));
  }

  collaborateurs(): Observable<Collaborateur[]> {
    return this.http.get<ApiResponse<Collaborateur[]>>(`${this.base}/collaborateurs`).pipe(map((r) => r.data));
  }

  creerCollaborateur(form: CollaborateurForm): Observable<Collaborateur> {
    return this.http.post<ApiResponse<Collaborateur>>(`${this.base}/collaborateurs`, form).pipe(map((r) => r.data));
  }

  creerCompte(id: number): Observable<Collaborateur> {
    return this.http.post<ApiResponse<Collaborateur>>(`${this.base}/collaborateurs/${id}/compte`, {}).pipe(map((r) => r.data));
  }

  reinitialiserMotDePasse(id: number): Observable<Collaborateur> {
    return this.http.post<ApiResponse<Collaborateur>>(`${this.base}/collaborateurs/${id}/mot-de-passe`, {}).pipe(map((r) => r.data));
  }

  modifierCollaborateur(id: number, form: CollaborateurUpdateForm): Observable<Collaborateur> {
    return this.http.put<ApiResponse<Collaborateur>>(`${this.base}/collaborateurs/${id}`, form).pipe(map((r) => r.data));
  }

  supprimerCollaborateur(id: number): Observable<boolean> {
    return this.http.delete<ApiResponse<boolean>>(`${this.base}/collaborateurs/${id}`).pipe(map((r) => r.data));
  }
}
