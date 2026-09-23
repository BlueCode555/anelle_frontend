import { Injectable, computed, effect, signal } from '@angular/core';

import { ProduitResponse } from './boutique.service';

export interface LignePanier {
  code: string;
  nom: string;
  prix: number;
  imageUrl: string | null;
  quantite: number;
  // Stock connu au moment de l'ajout : borne l'affichage, le serveur reste juge à la commande.
  stock: number;
}

const PANIER_KEY = 'anelle_panier';
const QUANTITE_MAX = 20;

// Panier du navigateur (localStorage) : il survit au rechargement et à la connexion Google, mais seul le serveur
// fait foi pour les prix et le stock quand la commande est passée.
@Injectable({ providedIn: 'root' })
export class PanierService {
  lignes = signal<LignePanier[]>(this.lire());

  nombreArticles = computed(() => this.lignes().reduce((n, l) => n + l.quantite, 0));
  total = computed(() => this.lignes().reduce((t, l) => t + l.prix * l.quantite, 0));

  constructor() {
    effect(() => {
      const contenu = JSON.stringify(this.lignes());
      try {
        localStorage.setItem(PANIER_KEY, contenu);
      } catch {
        // stockage indisponible : le panier reste valable pour la session en cours.
      }
    });
  }

  ajouter(produit: ProduitResponse, quantite = 1): void {
    const plafond = Math.min(QUANTITE_MAX, produit.stock);
    this.lignes.update((lignes) => {
      const existante = lignes.find((l) => l.code === produit.code);
      if (existante) {
        return lignes.map((l) =>
          l.code === produit.code ? { ...l, stock: produit.stock, quantite: Math.min(plafond, l.quantite + quantite) } : l
        );
      }
      return [
        ...lignes,
        {
          code: produit.code,
          nom: produit.nom,
          prix: produit.prix,
          imageUrl: produit.imageUrl,
          stock: produit.stock,
          quantite: Math.min(plafond, quantite)
        }
      ];
    });
  }

  quantiteDe(code: string): number {
    return this.lignes().find((l) => l.code === code)?.quantite ?? 0;
  }

  definirQuantite(code: string, quantite: number): void {
    if (quantite <= 0) {
      this.retirer(code);
      return;
    }
    this.lignes.update((lignes) =>
      lignes.map((l) => (l.code === code ? { ...l, quantite: Math.min(quantite, l.stock, QUANTITE_MAX) } : l))
    );
  }

  retirer(code: string): void {
    this.lignes.update((lignes) => lignes.filter((l) => l.code !== code));
  }

  vider(): void {
    this.lignes.set([]);
  }

  private lire(): LignePanier[] {
    try {
      const brut = localStorage.getItem(PANIER_KEY);
      const lignes = brut ? JSON.parse(brut) : [];
      return Array.isArray(lignes) ? lignes.filter((l) => l && typeof l.code === 'string' && l.quantite > 0) : [];
    } catch {
      return [];
    }
  }
}
