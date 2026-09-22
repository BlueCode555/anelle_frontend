import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from 'src/environments/environment';
import { ApiResponse } from './api.model';
import { RendezVous } from './rendez-vous.service';

// Mirrors bj.anelle.anelle_backend.dto.response.ClientResponse.
export interface ClientAdmin {
  id: number;
  code: string;
  email: string;
  nom: string | null;
  prenom: string | null;
  photoUrl: string | null;
  telephone: string | null;
  derniereConnexion: string | null; // LocalDateTime, sans fuseau
  nombreRendezVous: number;
}

// Consultation des clientes par le personnel (lecture seule : cree via la connexion Google, jamais ici).
@Injectable({ providedIn: 'root' })
export class ClientService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  lister(): Observable<ClientAdmin[]> {
    return this.http.get<ApiResponse<ClientAdmin[]>>(`${this.base}/clients`).pipe(map((r) => r.data));
  }

  rendezVous(id: number): Observable<RendezVous[]> {
    return this.http.get<ApiResponse<RendezVous[]>>(`${this.base}/clients/${id}/rendez-vous`).pipe(map((r) => r.data));
  }
}
