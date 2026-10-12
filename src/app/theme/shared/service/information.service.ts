import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';

import { environment } from 'src/environments/environment';
import { ApiResponse } from './api.model';

// Mirrors bj.anelle.anelle_backend.dto.{request.PlageHoraireForm,response.PlageHoraireResponse}.
export interface PlageHoraire {
  heureDebut: string; // "HH:mm"
  heureFin: string;
}

// Mirrors bj.anelle.anelle_backend.dto.response.{InformationResponse,HoraireResponse}.
export interface Horaire {
  jourSemaine: number; // 1 = lundi ... 7 = dimanche
  ouvert: boolean;
  // Une ou plusieurs plages dans la journée (ex. 9h-15h et 16h-18h, pour une pause) ; vide si fermé.
  plages: PlageHoraire[];
}

export interface Information {
  nom: string;
  slogan: string | null;
  // Version anglaise ; vide = on retombe sur `slogan` meme en anglais (voir home.component.ts).
  sloganEn: string | null;
  description: string | null;
  descriptionEn: string | null;
  adresse: string | null;
  ville: string | null;
  province: string | null;
  codePostal: string | null;
  pays: string | null;
  telephone: string | null;
  email: string | null;
  // Adresses qui reçoivent les notifications internes (nouvelle demande de rendez-vous...), distinctes du
  // champ email ci-dessus (contact public affiché sur le site).
  emailsNotification: string[];
  siteWeb: string | null;
  lienInstagram: string | null;
  lienFacebook: string | null;
  bannierePromo: string | null;
  fuseauHoraire: string | null;
  horaires: Horaire[];
}

// Champs du formulaire "Mon institut" : identiques à Information (le compte courriel de notification est
// désormais configuré côté serveur, voir application.properties / anelle.courriel.*).
export type InformationForm = Information;

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
