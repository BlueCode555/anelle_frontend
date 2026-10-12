import { Injectable, inject } from '@angular/core';

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
}

// Journal d'audit (lecture seule, réservé à l'esthéticienne) : qui a fait quoi, quand. Purgé automatiquement
// après 3 ans côté serveur (voir AuditPurgeJob).
@Injectable({ providedIn: 'root' })
export class AuditService {
  private api = inject(ApiService);

  list(criteria: PaginationCriteria = { size: 20 }) {
    return this.api.list<AuditEntry>('audit', criteria);
  }
}
