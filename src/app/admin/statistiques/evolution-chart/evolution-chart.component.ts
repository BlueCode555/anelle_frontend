import { Component, computed, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { localeCourante } from 'src/app/theme/shared/_helpers/zoned-time';
import { PointEvolution } from 'src/app/theme/shared/service/statistiques.service';
import { TranslatePipe } from 'src/app/theme/shared/_helpers/translate.pipe';

interface PointPositionne extends PointEvolution {
  x: number;
  y: number;
}

// Graphe en aire de l'evolution du chiffre d'affaires jour par jour : une seule serie (pas de legende
// necessaire, le titre de la carte dit deja ce qui est trace), avec reticule au survol et repli en tableau.
// Voir la skill "dataviz" : marque 2px, aire a ~10% d'opacite, grille discrete, point de fin + etiquette.
@Component({
  selector: 'app-evolution-chart',
  imports: [CommonModule, TranslatePipe],
  templateUrl: './evolution-chart.component.html',
  styleUrl: './evolution-chart.component.scss'
})
export class EvolutionChartComponent {
  points = input<PointEvolution[]>([]);

  readonly largeur = 760;
  readonly hauteur = 220;
  private readonly marge = { haut: 16, bas: 28, gauche: 8, droite: 8 };

  vueTableau = signal(false);
  indexSurvole = signal<number | null>(null);

  private max = computed(() => Math.max(1, ...this.points().map((p) => p.montant)));
  private tick = computed(() => this.niceStep(this.max()));
  private plafond = computed(() => Math.ceil(this.max() / this.tick()) * this.tick());

  ticksY = computed(() => {
    const plafond = this.plafond();
    const pas = this.tick();
    const valeurs: number[] = [];
    for (let v = 0; v <= plafond; v += pas) valeurs.push(v);
    return valeurs.map((v) => ({ valeur: v, y: this.versY(v) }));
  });

  positions = computed<PointPositionne[]>(() => {
    const pts = this.points();
    const largeurUtile = this.largeur - this.marge.gauche - this.marge.droite;
    return pts.map((p, i) => ({
      ...p,
      x: this.marge.gauche + (pts.length <= 1 ? largeurUtile / 2 : (i / (pts.length - 1)) * largeurUtile),
      y: this.versY(p.montant)
    }));
  });

  lignePath = computed(() => this.positions().map((p, i) => (i === 0 ? 'M' : 'L') + p.x + ' ' + p.y).join(' '));

  airePath = computed(() => {
    const pts = this.positions();
    if (!pts.length) return '';
    const base = this.hauteur - this.marge.bas;
    return `M${pts[0].x} ${base} ` + pts.map((p) => `L${p.x} ${p.y}`).join(' ') + ` L${pts[pts.length - 1].x} ${base} Z`;
  });

  dernierPoint = computed(() => {
    const pts = this.positions();
    return pts.length ? pts[pts.length - 1] : null;
  });

  pointSurvole = computed<PointPositionne | null>(() => {
    const i = this.indexSurvole();
    return i === null ? null : (this.positions()[i] ?? null);
  });

  onPointerMove(event: PointerEvent): void {
    const rect = (event.currentTarget as Element).getBoundingClientRect();
    this.survolerXY(event.clientX, rect);
  }

  survolerXY(clientX: number, hoteRect: DOMRect): void {
    const pts = this.positions();
    if (!pts.length) return;
    const xRelative = ((clientX - hoteRect.left) / hoteRect.width) * this.largeur;
    let plusProche = 0;
    let distanceMin = Infinity;
    pts.forEach((p, i) => {
      const d = Math.abs(p.x - xRelative);
      if (d < distanceMin) {
        distanceMin = d;
        plusProche = i;
      }
    });
    this.indexSurvole.set(plusProche);
  }

  arreterSurvol(): void {
    this.indexSurvole.set(null);
  }

  formatMontant(montant: number): string {
    return new Intl.NumberFormat(localeCourante(), { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(montant);
  }

  formatDateCourte(iso: string): string {
    return new Intl.DateTimeFormat(localeCourante(), { day: 'numeric', month: 'short' }).format(new Date(iso + 'T00:00:00'));
  }

  formatDateLongue(iso: string): string {
    return new Intl.DateTimeFormat(localeCourante(), { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso + 'T00:00:00'));
  }

  // Une etiquette d'axe sur environ 6 points pour eviter que les dates s'empilent sur une longue periode.
  afficherEtiquette(index: number, total: number): boolean {
    if (total <= 7) return true;
    const pas = Math.ceil(total / 6);
    return index % pas === 0 || index === total - 1;
  }

  private versY(valeur: number): number {
    const haut = this.marge.haut;
    const bas = this.hauteur - this.marge.bas;
    const plafond = this.plafond() || 1;
    return bas - (valeur / plafond) * (bas - haut);
  }

  // Un pas "rond" (1, 2 ou 5 x une puissance de 10) pour obtenir 3 a 5 graduations lisibles sur l'axe Y.
  private niceStep(max: number): number {
    const approx = max / 4;
    const puissance = Math.pow(10, Math.floor(Math.log10(Math.max(approx, 1))));
    const candidats = [1, 2, 5, 10];
    const facteur = candidats.find((c) => c * puissance >= approx) ?? 10;
    return facteur * puissance;
  }
}
