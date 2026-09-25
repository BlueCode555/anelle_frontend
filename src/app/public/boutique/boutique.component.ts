import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PaginationComponent } from 'src/app/theme/shared/components/pagination/pagination.component';

import { ProduitResponse, ProduitService } from 'src/app/theme/shared/service/boutique.service';
import { PanierService } from 'src/app/theme/shared/service/panier.service';
import { TranslatePipe } from 'src/app/theme/shared/_helpers/translate.pipe';
import { localeCourante } from 'src/app/theme/shared/_helpers/zoned-time';
import { SiteHeaderComponent } from '../site-header/site-header.component';

@Component({
  selector: 'app-boutique',
  imports: [CommonModule, RouterModule, SiteHeaderComponent, TranslatePipe, PaginationComponent],
  templateUrl: './boutique.component.html',
  styleUrl: './boutique.component.scss'
})
export class BoutiqueComponent implements OnInit {
  private produits = inject(ProduitService);
  panier = inject(PanierService);

  liste = signal<ProduitResponse[]>([]);
  chargement = signal(true);
  erreur = signal(false);
  recherche = signal('');
  rayonActif = signal<string | null>(null);
  // Produit qui vient d'être ajouté : affiche brièvement « Ajouté ✓ » sur son bouton.
  ajoute = signal<string | null>(null);
  tri = signal<'defaut' | 'prixAsc' | 'prixDesc' | 'nom'>('defaut');
  // Produit dont la photo est agrandie (fenêtre de zoom).
  zoom = signal<ProduitResponse | null>(null);

  visibles = computed(() => this.liste().filter((p) => p.actif));
  rayons = computed(() => [...new Set(this.visibles().map((p) => p.rayon).filter((r): r is string => !!r))].sort((a, b) => a.localeCompare(b)));
  filtres = computed(() => {
    const q = this.recherche().trim().toLowerCase();
    const rayon = this.rayonActif();
    const liste = this.visibles().filter(
      (p) =>
        (!rayon || p.rayon === rayon) &&
        (!q || p.nom.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q))
    );
    switch (this.tri()) {
      case 'prixAsc':
        return [...liste].sort((a, b) => a.prix - b.prix);
      case 'prixDesc':
        return [...liste].sort((a, b) => b.prix - a.prix);
      case 'nom':
        return [...liste].sort((a, b) => a.nom.localeCompare(b.nom));
      default:
        return liste;
    }
  });

  page = signal(1);
  readonly taille = 12;
  pagees = computed(() => this.filtres().slice((this.page() - 1) * this.taille, this.page() * this.taille));

  ngOnInit(): void {
    this.produits.list().subscribe({
      next: (page) => {
        this.liste.set(page.content);
        this.chargement.set(false);
      },
      error: () => {
        this.erreur.set(true);
        this.chargement.set(false);
      }
    });
  }

  imageSrc(p: ProduitResponse): string | null {
    return this.produits.imageSrc(p.imageUrl);
  }

  formatPrix(prix: number): string {
    return new Intl.NumberFormat(localeCourante(), { style: 'currency', currency: 'CAD' }).format(prix);
  }

  ajouter(p: ProduitResponse): void {
    this.panier.ajouter(p);
    this.ajoute.set(p.code);
    setTimeout(() => this.ajoute.update((c) => (c === p.code ? null : c)), 1400);
  }

  // Le panier ne peut pas dépasser le stock connu du produit.
  peutAjouter(p: ProduitResponse): boolean {
    return p.stock > 0 && this.panier.quantiteDe(p.code) < Math.min(p.stock, 20);
  }

  @HostListener('document:keydown.escape')
  fermerZoom(): void {
    this.zoom.set(null);
  }

  onTri(event: Event): void {
    this.tri.set((event.target as HTMLSelectElement).value as 'defaut' | 'prixAsc' | 'prixDesc' | 'nom');
    this.page.set(1);
  }

  onRayon(event: Event): void {
    this.rayonActif.set((event.target as HTMLSelectElement).value || null);
    this.page.set(1);
  }

  onRecherche(event: Event): void {
    this.recherche.set((event.target as HTMLInputElement).value);
    this.page.set(1);
  }
}
