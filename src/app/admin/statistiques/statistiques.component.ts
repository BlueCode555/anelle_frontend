import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { localeCourante } from 'src/app/theme/shared/_helpers/zoned-time';
import { Statistiques, StatistiquesService } from 'src/app/theme/shared/service/statistiques.service';
import { TranslatePipe } from 'src/app/theme/shared/_helpers/translate.pipe';
import { EvolutionChartComponent } from './evolution-chart/evolution-chart.component';

// Toutes les minutes : assez frequent pour donner un effet "temps reel" sur le graphe d'evolution sans
// bombarder le serveur de requetes (ce n'est pas un flux pousse, juste un rechargement periodique discret).
const INTERVALLE_RAFRAICHISSEMENT_MS = 60_000;

// Statistiques de vente : chiffre d'affaires et classement des services/produits les plus demandes sur une
// periode choisie, pour reperer sur quoi faire une promotion. Reserve a la proprietaire (voir PermissionRules).
@Component({
  selector: 'app-statistiques',
  imports: [CommonModule, FormsModule, TranslatePipe, EvolutionChartComponent],
  templateUrl: './statistiques.component.html',
  styleUrl: './statistiques.component.scss'
})
export class StatistiquesComponent implements OnInit, OnDestroy {
  private service = inject(StatistiquesService);
  private minuteur: ReturnType<typeof setInterval> | null = null;

  loading = signal(true);
  // Rafraichissement discret en arriere-plan (pas le grand "chargement") : le graphe garde son dernier
  // rendu, juste un peu estompe le temps que les nouvelles donnees arrivent — jamais de flash ni de saut.
  rafraichissement = signal(false);
  error = signal(false);
  stats = signal<Statistiques | null>(null);

  du = this.ilYA(30);
  au = this.aujourdhui();
  readonly aujourdhuiStr = this.aujourdhui();

  ngOnInit(): void {
    this.charger();
    this.minuteur = setInterval(() => this.rafraichirSilencieusement(), INTERVALLE_RAFRAICHISSEMENT_MS);
  }

  ngOnDestroy(): void {
    if (this.minuteur) clearInterval(this.minuteur);
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

  // Rien a gagner a rafraichir une periode entierement passee : seule une periode qui inclut aujourd'hui
  // peut encore recevoir de nouvelles ventes entre deux rechargements.
  private rafraichirSilencieusement(): void {
    if (this.au !== this.aujourdhui() || this.du > this.au) return;
    this.rafraichissement.set(true);
    this.service.calculer(this.du, this.au).subscribe({
      next: (s) => {
        this.stats.set(s);
        this.rafraichissement.set(false);
      },
      error: () => this.rafraichissement.set(false)
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
