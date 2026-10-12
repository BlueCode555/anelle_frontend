import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { localeCourante } from 'src/app/theme/shared/_helpers/zoned-time';
import { Statistiques, StatistiquesService } from 'src/app/theme/shared/service/statistiques.service';
import { TranslatePipe } from 'src/app/theme/shared/_helpers/translate.pipe';

// Statistiques de vente : chiffre d'affaires et classement des services/produits les plus demandes sur une
// periode choisie, pour reperer sur quoi faire une promotion. Reserve a la proprietaire (voir PermissionRules).
@Component({
  selector: 'app-statistiques',
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './statistiques.component.html',
  styleUrl: './statistiques.component.scss'
})
export class StatistiquesComponent implements OnInit {
  private service = inject(StatistiquesService);

  loading = signal(true);
  error = signal(false);
  stats = signal<Statistiques | null>(null);

  du = this.ilYA(30);
  au = this.aujourdhui();

  ngOnInit(): void {
    this.charger();
  }

  // Plages rapides : le 1er du mois courant jusqu'a aujourd'hui, les N derniers jours, etc.
  preset(jours: number): void {
    this.du = this.ilYA(jours);
    this.au = this.aujourdhui();
    this.charger();
  }

  presetMoisCourant(): void {
    const n = new Date();
    this.du = this.versIso(new Date(n.getFullYear(), n.getMonth(), 1));
    this.au = this.aujourdhui();
    this.charger();
  }

  charger(): void {
    if (!this.du || !this.au || this.du > this.au) {
      this.error.set(true);
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.error.set(false);
    this.service.calculer(this.du, this.au).subscribe({
      next: (s) => {
        this.stats.set(s);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      }
    });
  }

  // Plus grand nombre du classement (pour dimensionner les barres proportionnellement les unes aux autres).
  maxNombre(items: { nombre: number }[]): number {
    return Math.max(1, ...items.map((i) => i.nombre));
  }

  formatMontant(montant: number): string {
    return new Intl.NumberFormat(localeCourante(), { style: 'currency', currency: 'CAD' }).format(montant);
  }

  private aujourdhui(): string {
    return this.versIso(new Date());
  }

  private ilYA(jours: number): string {
    const d = new Date();
    d.setDate(d.getDate() - jours);
    return this.versIso(d);
  }

  private versIso(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
