import { Component, computed, input, model } from '@angular/core';

import { TranslatePipe } from '../../_helpers/translate.pipe';

// Pagination côté navigateur : n'apparaît que si la liste dépasse une page. `page` est un modèle à deux sens :
// <app-pagination [total]="liste().length" [taille]="10" [(page)]="page" />
@Component({
  selector: 'app-pagination',
  imports: [TranslatePipe],
  template: `
    @if (pages().length > 1) {
      <nav class="pagination-nav" [attr.aria-label]="'pagination.aria' | t">
        <button type="button" class="pg-btn" [disabled]="page() === 1" (click)="aller(page() - 1)" [attr.aria-label]="'pagination.precedent' | t">
          <i class="ti ti-chevron-left"></i>
        </button>
        @for (p of pages(); track p) {
          @if (p === 0) {
            <span class="pg-ellipse">…</span>
          } @else {
            <button type="button" class="pg-btn" [class.is-active]="p === page()" [attr.aria-current]="p === page() ? 'page' : null" (click)="aller(p)">
              {{ p }}
            </button>
          }
        }
        <button type="button" class="pg-btn" [disabled]="page() === total_pages()" (click)="aller(page() + 1)" [attr.aria-label]="'pagination.suivant' | t">
          <i class="ti ti-chevron-right"></i>
        </button>
      </nav>
    }
  `,
  styles: [
    `
      .pagination-nav {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 0.35rem;
        margin-top: 1.5rem;
      }

      .pg-btn {
        min-width: 2.2rem;
        height: 2.2rem;
        padding: 0 0.6rem;
        border: 1px solid var(--ar-nude, #e6d9c3);
        border-radius: 999px;
        background: transparent;
        color: var(--ar-chocolat, #4a2e17);
        font-weight: 500;
        transition:
          background-color 0.15s ease,
          color 0.15s ease;
      }

      .pg-btn:hover:not(:disabled):not(.is-active) {
        background: rgba(232, 200, 116, 0.25);
      }

      .pg-btn.is-active {
        background: var(--ar-dore, #c9a227);
        border-color: var(--ar-dore, #c9a227);
        color: #3d2410;
      }

      .pg-btn:disabled {
        opacity: 0.4;
      }

      .pg-ellipse {
        padding: 0 0.2rem;
        color: var(--ar-texte-doux, #8a7a62);
      }
    `
  ]
})
export class PaginationComponent {
  total = input.required<number>();
  taille = input(10);
  page = model(1);

  total_pages = computed(() => Math.max(1, Math.ceil(this.total() / this.taille())));

  // 0 = points de suspension.
  pages = computed<number[]>(() => {
    const n = this.total_pages();
    if (n <= 7) return Array.from({ length: n }, (_, i) => i + 1);
    const p = Math.min(this.page(), n);
    const voisins = [1, p - 1, p, p + 1, n].filter((x) => x >= 1 && x <= n);
    const uniques = [...new Set(voisins)].sort((a, b) => a - b);
    const sortie: number[] = [];
    uniques.forEach((x, i) => {
      if (i > 0 && x - uniques[i - 1] > 1) sortie.push(0);
      sortie.push(x);
    });
    return sortie;
  });

  aller(p: number): void {
    this.page.set(Math.min(Math.max(1, p), this.total_pages()));
  }
}
