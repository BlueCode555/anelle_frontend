import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';

import { environment } from 'src/environments/environment';
import { ApiResponse } from './api.model';

import { ApiService } from './api.service';
import { PaginationCriteria } from './api.model';

// Mirrors bj.anelle.anelle_backend.dto.response.AuditEntryResponse.
export interface AuditEntry {
  revision: number;
  action: 'CREATION' | 'MODIFICATION' | 'SUPPRESSION';
  typeElement: string;
  libelle: string;
  auteurId: string | null;
  auteurNom: string | null;
  date: string;
  entiteId: number;
  tableAudit: string;
}

// Mirrors ConnexionResponse / ConnexionsPageResponse : evenements de connexion releves par Keycloak.
export interface Connexion {
  date: string;
  type: string;
  utilisateur: string;
  ip: string | null;
  erreur: string | null;
}

export interface ConnexionsPage {
  disponible: boolean;
  message: string | null;
  suite: boolean;
  evenements: Connexion[];
}

// Un champ modifie dans une revision : valeur avant / apres (null = vide).
export interface Changement {
  champ: string;
  avant: string | null;
  apres: string | null;
}

// Journal d'audit (lecture seule, réservé à l'esthéticienne) : qui a fait quoi, quand. Purgé automatiquement
// après 3 ans côté serveur (voir AuditPurgeJob).
@Injectable({ providedIn: 'root' })
export class AuditService {
  private api = inject(ApiService);
  private http = inject(HttpClient);

  // Filtres optionnels du journal : recherche libre (libelle ou type), type d'element, periode (AAAA-MM-JJ).
  list(criteria: PaginationCriteria & { q?: string; type?: string; du?: string; au?: string } = { size: 20 }) {
    return this.api.list<AuditEntry>('audit', criteria);
  }

  // Detail des changements d'une ligne du journal (champ, avant, apres).
  detail(entry: AuditEntry) {
    return this.api.findOne<Changement[]>(`audit/${entry.tableAudit}/${entry.entiteId}`, entry.revision);
  }

  // Journal des connexions (Keycloak) : filtre = connexion | echec | deconnexion | inscription | motdepasse.
  connexions(filtre: string, decalage: number, taille: number) {
    let params = new HttpParams().set('decalage', decalage).set('taille', taille);
    if (filtre) params = params.set('filtre', filtre);
    return this.http.get<ApiResponse<ConnexionsPage>>(`${environment.apiUrl}/audit/connexions`, { params }).pipe(map((res) => res.data));
  }
}
