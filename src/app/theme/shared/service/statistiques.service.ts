import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from 'src/environments/environment';
import { ApiResponse } from './api.model';

export interface Classement {
  code: string;
  libelle: string;
  nombre: number;
  montant: number;
}

export interface Statistiques {
  chiffreAffairesTotal: number;
  chiffreAffairesServices: number;
  chiffreAffairesProduits: number;
  nombreRendezVous: number;
  nombreCommandes: number;
  servicesLesPlusDemandes: Classement[];
  produitsLesPlusVendus: Classement[];
}

// Statistiques de vente (chiffre d'affaires, services/produits les plus demandes) sur une periode donnee.
@Injectable({ providedIn: 'root' })
export class StatistiquesService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/statistiques`;

  calculer(du: string, au: string): Observable<Statistiques> {
    return this.http.get<ApiResponse<Statistiques>>(this.url, { params: { du, au } }).pipe(map((r) => r.data));
  }
}
