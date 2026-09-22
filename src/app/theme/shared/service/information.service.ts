import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';

import { environment } from 'src/environments/environment';
import { ApiResponse } from './api.model';

// Mirrors bj.anelle.anelle_backend.dto.response.{InformationResponse,HoraireResponse}.
export interface Horaire {
  jourSemaine: number; // 1 = lundi ... 7 = dimanche
  ouvert: boolean;
  heureDebut: string | null; // "HH:mm"
  heureFin: string | null;
}

export interface Information {
  nom: string;
  slogan: string | null;
  description: string | null;
  adresse: string | null;
  ville: string | null;
  province: string | null;
  codePostal: string | null;
  pays: string | null;
  telephone: string | null;
  email: string | null;
  siteWeb: string | null;
  lienInstagram: string | null;
  lienFacebook: string | null;
  bannierePromo: string | null;
  fuseauHoraire: string | null;
  // Compte Gmail des notifications de nouvelle demande de rendez-vous (le mot de passe n'est jamais renvoyé
  // par le serveur : `courrielNotifConfigure` dit seulement s'il y en a un d'enregistré).
  courrielNotifExpediteur: string | null;
  courrielNotifConfigure: boolean;
  horaires: Horaire[];
}

// Champs du formulaire "Mon institut" : comme Information, mais avec un mot de passe en écriture (jamais lu).
export type InformationForm = Omit<Information, 'courrielNotifConfigure'> & { courrielNotifMotDePasse: string };

export const JOURS_SEMAINE = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

// Informations de l'institut (nom, coordonnees, horaires...) saisies par l'estheticienne et affichees sur le site.
@Injectable({ providedIn: 'root' })
export class InformationService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/informations`;

  info = signal<Information | null>(null);
  loadFailed = signal(false);

  nom = computed(() => this.info()?.nom ?? 'Arnelle Institut');

  private requested = false;

  // Charge une seule fois par visite ; les composants lisent le signal `info`.
  ensureLoaded(): void {
    if (this.requested) {
      return;
    }
    this.requested = true;
    this.fetch().subscribe({ error: () => this.loadFailed.set(true) });
  }

  fetch(): Observable<Information> {
    return this.http.get<ApiResponse<Information>>(this.url).pipe(
      map((res) => res.data),
      tap((info) => {
        this.info.set(info);
        this.loadFailed.set(false);
      })
    );
  }

  update(form: InformationForm): Observable<Information> {
    return this.http.put<ApiResponse<Information>>(this.url, form).pipe(
      map((res) => res.data),
      tap((info) => this.info.set(info))
    );
  }
}
