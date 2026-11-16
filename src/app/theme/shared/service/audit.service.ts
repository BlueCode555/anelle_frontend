import { HttpClient } from '@angular/common/http';
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

// Journal d'audit (lecture réservée à l'esthéticienne ou au profil ayant le droit sur cet écran) : qui a fait
// quoi, quand. Purgé automatiquement après 3 ans côté serveur (voir AuditPurgeJob).
@Injectable({ providedIn: 'root' })
export class AuditService {
  private api = inject(ApiService);
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  list(criteria: PaginationCriteria = { size: 20 }) {
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
}
