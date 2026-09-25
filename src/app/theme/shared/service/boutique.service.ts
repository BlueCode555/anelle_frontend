import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from 'src/environments/environment';
import { ApiService } from './api.service';
import { ApiResponse, PaginationCriteria } from './api.model';

// Mirrors bj.anelle.anelle_backend.dto.response.{ProduitResponse,CommandeResponse}.

export interface ProduitResponse {
  id: number;
  code: string;
  nom: string;
  rayon: string | null;
  description: string | null;
  prix: number;
  stock: number;
  actif: boolean;
  imageUrl: string | null;
}

export interface ProduitForm {
  nom: string;
  rayon: string;
  description: string;
  prix: number | null;
  stock: number | null;
  actif: boolean;
  imageUrl: string;
}

export type StatutCommande = 'EN_ATTENTE_PAIEMENT' | 'PAYEE' | 'PRETE' | 'REMISE' | 'ANNULEE';

export interface LigneCommande {
  produitCode: string;
  nom: string;
  prixUnitaire: number;
  quantite: number;
  sousTotal: number;
  imageUrl: string | null;
}

export interface Commande {
  id: number;
  code: string;
  statut: StatutCommande;
  total: number;
  creeLe: string;
  payeLe: string | null;
  // Lien de paiement Square ; null si Square n'est pas configuré (paiement à régler avec l'institut).
  lienPaiement: string | null;
  note: string | null;
  telephone: string | null;
  clientNom: string;
  clientEmail: string;
  lignes: LigneCommande[];
}

export const STATUT_COMMANDE_CLASSES: Record<StatutCommande, string> = {
  EN_ATTENTE_PAIEMENT: 'text-bg-warning',
  PAYEE: 'text-bg-success',
  PRETE: 'text-bg-info',
  REMISE: 'text-bg-dark',
  ANNULEE: 'text-bg-secondary'
};

// Catalogue de la boutique (lecture publique ; écriture réservée à l'écran Produits du back-office).
@Injectable({ providedIn: 'root' })
export class ProduitService {
  private api = inject(ApiService);

  list(criteria: PaginationCriteria = { size: 200 }) {
    return this.api.list<ProduitResponse>('produits', criteria);
  }

  get(id: number) {
    return this.api.findOne<ProduitResponse>('produits', id);
  }

  create(form: ProduitForm) {
    return this.api.create<ProduitResponse>('produits', form);
  }

  update(id: number, form: ProduitForm) {
    return this.api.update<ProduitResponse>('produits', id, form);
  }

  delete(id: number) {
    return this.api.delete('produits', id);
  }

  uploadImage(file: File) {
    return this.api.upload<{ url: string }>('files', file);
  }

  imageSrc(url?: string | null): string | null {
    return url ? this.api.absoluteUrl(url) : null;
  }
}

@Injectable({ providedIn: 'root' })
export class CommandeService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  creer(lignes: { produitCode: string; quantite: number }[], telephone: string, note?: string): Observable<Commande> {
    return this.http.post<ApiResponse<Commande>>(`${this.base}/commandes`, { lignes, telephone, note: note || null }).pipe(map((r) => r.data));
  }

  mes(): Observable<Commande[]> {
    return this.http.get<ApiResponse<Commande[]>>(`${this.base}/commandes/mes`).pipe(map((r) => r.data));
  }

  toutes(): Observable<Commande[]> {
    return this.http.get<ApiResponse<Commande[]>>(`${this.base}/commandes`).pipe(map((r) => r.data));
  }

  annuler(id: number): Observable<Commande> {
    return this.action(id, 'annuler');
  }

  marquerPaye(id: number, reference?: string): Observable<Commande> {
    return this.action(id, 'marquer-paye', { reference: reference ?? null });
  }

  // Commande préparée : le serveur prévient la cliente par courriel.
  prete(id: number): Observable<Commande> {
    return this.action(id, 'prete');
  }

  remettre(id: number): Observable<Commande> {
    return this.action(id, 'remettre');
  }

  private action(id: number, nom: string, body: unknown = {}): Observable<Commande> {
    return this.http.post<ApiResponse<Commande>>(`${this.base}/commandes/${id}/${nom}`, body).pipe(map((r) => r.data));
  }
}
