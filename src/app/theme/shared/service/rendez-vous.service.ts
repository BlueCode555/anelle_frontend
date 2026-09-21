import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from 'src/environments/environment';
import { ApiResponse } from './api.model';

// Mirrors bj.anelle.anelle_backend.dto.response.{RendezVousResponse,CreneauxResponse,IndisponibiliteResponse}.

export type StatutRendezVous = 'DEMANDE' | 'ACCEPTE' | 'CONFIRME' | 'REFUSE' | 'ANNULE' | 'EXPIRE' | 'TERMINE';

export interface RendezVous {
  id: number;
  code: string;
  statut: StatutRendezVous;
  debut: string; // ISO avec decalage, dans le fuseau de l'institut
  fin: string;
  dureeMinutes: number;
  prix: number;
  serviceCode: string;
  serviceNom: string;
  clientNom: string | null;
  clientEmail: string | null;
  clientTelephone: string | null;
  expireLe: string | null;
  payeLe: string | null;
  note: string | null;
  motifRefus: string | null;
}

export interface Creneau {
  debut: string;
  fin: string;
}

export interface Creneaux {
  fuseau: string;
  date: string;
  dureeMinutes: number;
  creneaux: Creneau[];
}

export interface RendezVousForm {
  serviceCode: string;
  debut: string;
  note?: string;
  contactNom?: string;
  contactEmail?: string;
  contactTelephone?: string;
}

export interface Indisponibilite {
  id: number;
  code: string;
  debut: string;
  fin: string;
  motif: string | null;
}

export const STATUT_LIBELLES: Record<StatutRendezVous, string> = {
  DEMANDE: 'En attente de réponse',
  ACCEPTE: 'Acceptée, à payer',
  CONFIRME: 'Confirmée',
  REFUSE: 'Refusée',
  ANNULE: 'Annulée',
  EXPIRE: 'Expirée',
  TERMINE: 'Terminée'
};

export const STATUT_CLASSES: Record<StatutRendezVous, string> = {
  DEMANDE: 'text-bg-warning',
  ACCEPTE: 'text-bg-info',
  CONFIRME: 'text-bg-success',
  REFUSE: 'text-bg-danger',
  ANNULE: 'text-bg-secondary',
  EXPIRE: 'text-bg-secondary',
  TERMINE: 'text-bg-dark'
};

@Injectable({ providedIn: 'root' })
export class RendezVousService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  creneaux(service: string, date: string): Observable<Creneaux> {
    const params = new HttpParams().set('service', service).set('date', date);
    return this.http.get<ApiResponse<Creneaux>>(`${this.base}/disponibilites/creneaux`, { params }).pipe(map((r) => r.data));
  }

  creer(form: RendezVousForm): Observable<RendezVous> {
    return this.http.post<ApiResponse<RendezVous>>(`${this.base}/rendez-vous`, form).pipe(map((r) => r.data));
  }

  mes(): Observable<RendezVous[]> {
    return this.http.get<ApiResponse<RendezVous[]>>(`${this.base}/rendez-vous/mes`).pipe(map((r) => r.data));
  }

  annuler(id: number): Observable<RendezVous> {
    return this.action(id, 'annuler');
  }

  agenda(du: string, au: string): Observable<RendezVous[]> {
    const params = new HttpParams().set('du', du).set('au', au);
    return this.http.get<ApiResponse<RendezVous[]>>(`${this.base}/rendez-vous`, { params }).pipe(map((r) => r.data));
  }

  accepter(id: number): Observable<RendezVous> {
    return this.action(id, 'accepter');
  }

  refuser(id: number, motif?: string): Observable<RendezVous> {
    return this.action(id, 'refuser', { motif: motif ?? null });
  }

  marquerPaye(id: number, reference?: string): Observable<RendezVous> {
    return this.action(id, 'marquer-paye', { reference: reference ?? null });
  }

  terminer(id: number): Observable<RendezVous> {
    return this.action(id, 'terminer');
  }

  indisponibilites(): Observable<Indisponibilite[]> {
    return this.http.get<ApiResponse<Indisponibilite[]>>(`${this.base}/indisponibilites`).pipe(map((r) => r.data));
  }

  creerIndisponibilite(form: { debut: string; fin: string; motif?: string }): Observable<Indisponibilite> {
    return this.http.post<ApiResponse<Indisponibilite>>(`${this.base}/indisponibilites`, form).pipe(map((r) => r.data));
  }

  supprimerIndisponibilite(id: number): Observable<boolean> {
    return this.http.delete<ApiResponse<boolean>>(`${this.base}/indisponibilites/${id}`).pipe(map((r) => r.data));
  }

  private action(id: number, nom: string, body: unknown = {}): Observable<RendezVous> {
    return this.http.post<ApiResponse<RendezVous>>(`${this.base}/rendez-vous/${id}/${nom}`, body).pipe(map((r) => r.data));
  }
}
