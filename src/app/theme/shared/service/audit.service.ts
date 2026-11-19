import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from 'src/environments/environment';
import { ApiResponse } from './api.model';
import { ApiService } from './api.service';
import { PaginationCriteria } from './api.model';

// Mirrors bj.anelle.anelle_backend.dto.response.AuditEntryResponse.
export interface AuditEntry {
  revision: number;
  action: 'CREATION' | 'MODIFICATION' | 'SUPPRESSION' | 'CONNEXION' | 'DECONNEXION';
  typeElement: string;
  libelle: string;
  auteurId: string | null;
  auteurNom: string | null;
  date: string;
  table: string;
  entiteId: number;
  detailDisponible: boolean;
}

// Mirrors bj.anelle.anelle_backend.dto.response.AuditDiffChamp.
export interface AuditDiffChamp {
  champ: string;
  avant: string | null;
  apres: string | null;
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

// Journal d'audit (lecture réservée à l'esthéticienne ou au profil ayant le droit sur cet écran) : qui a fait
// quoi, quand. Purgé automatiquement après 3 ans côté serveur (voir AuditPurgeJob).
@Injectable({ providedIn: 'root' })
export class AuditService {
  private api = inject(ApiService);
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  // Filtres optionnels : recherche libre (libelle ou type), type d'element, periode (AAAA-MM-JJ), auteur (nom) et action (CREATION, MODIFICATION, SUPPRESSION).
  list(criteria: PaginationCriteria & { q?: string; type?: string; du?: string; au?: string; auteur?: string; action?: string } = { size: 20 }) {
    return this.api.list<AuditEntry>('audit', criteria);
  }

  detail(entry: AuditEntry): Observable<AuditDiffChamp[]> {
    return this.http
      .get<ApiResponse<AuditDiffChamp[]>>(`${this.base}/audit/${entry.table}/${entry.entiteId}/${entry.revision}/detail`)
      .pipe(map((r) => r.data));
  }

  // Appelé juste après une connexion réussie puis juste avant une déconnexion (voir AuthService) : ces deux
  // événements ne touchent aucune entité métier, donc Envers ne les voit pas — on les trace explicitement.
  // Volontairement silencieux (l'échec de cette trace ne doit jamais bloquer une connexion/déconnexion).
  enregistrerEvenement(type: 'CONNEXION' | 'DECONNEXION'): Observable<void> {
    return this.http.post<ApiResponse<void>>(`${this.base}/audit/evenements`, { type }).pipe(map(() => undefined));
  }

  // Journal des connexions (Keycloak) : filtre = connexion | echec | deconnexion | inscription | motdepasse.
  connexions(filtre: string, decalage: number, taille: number) {
    let params = new HttpParams().set('decalage', decalage).set('taille', taille);
    if (filtre) params = params.set('filtre', filtre);
    return this.http.get<ApiResponse<ConnexionsPage>>(`${this.base}/audit/connexions`, { params }).pipe(map((res) => res.data));
  }
}
