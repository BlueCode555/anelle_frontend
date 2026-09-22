import { Injectable, effect, signal } from '@angular/core';

const CLE = 'anelle_theme_sombre';

// Mode sombre de l'espace de gestion uniquement (le site public et la connexion ne sont pas concernes).
// Le menu latéral chocolat ne change pas : seul le contenu (cartes, tableaux, formulaires) passe en sombre.
@Injectable({ providedIn: 'root' })
export class ThemeService {
  sombre = signal(this.lire());

  constructor() {
    effect(() => {
      try {
        localStorage.setItem(CLE, this.sombre() ? '1' : '0');
      } catch {
        // stockage indisponible (navigation privée) : le choix vaut pour cette page seulement
      }
    });
  }

  basculer(): void {
    this.sombre.update((v) => !v);
  }

  private lire(): boolean {
    try {
      return localStorage.getItem(CLE) === '1';
    } catch {
      return false;
    }
  }
}
