import { Injectable, effect, signal } from '@angular/core';

import { EN } from './en';
import { FR } from './fr';

export type Langue = 'fr' | 'en';

const LANGUE_KEY = 'anelle_langue';

// Traduction cote client, sans rechargement de page : la cliente, le collaborateur ou l'estheticienne bascule
// FR/EN a tout moment depuis l'en-tete (voir LangSwitcherComponent), le choix est retenu dans ce navigateur.
@Injectable({ providedIn: 'root' })
export class TranslationService {
  private readonly dictionnaires: Record<Langue, Record<string, string>> = { fr: FR, en: EN };

  langue = signal<Langue>(this.detecter());

  constructor() {
    document.documentElement.lang = this.langue();
    effect(() => {
      const l = this.langue();
      document.documentElement.lang = l;
      try {
        localStorage.setItem(LANGUE_KEY, l);
      } catch {
        // stockage indisponible (navigation privee...) : la langue reste valide pour la session en cours.
      }
    });
  }

  definir(l: Langue): void {
    // <html lang> d'abord : les formats de dates/montants (localeCourante) le lisent pendant le rendu qui suit.
    document.documentElement.lang = l;
    this.langue.set(l);
  }

  basculer(): void {
    this.definir(this.langue() === 'fr' ? 'en' : 'fr');
  }

  /** Traduit une cle ; retombe sur le francais puis sur la cle elle-meme si elle manque au dictionnaire. */
  t(cle: string, params?: Record<string, string | number>): string {
    const texte = this.dictionnaires[this.langue()][cle] ?? this.dictionnaires.fr[cle] ?? cle;
    return params ? texte.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? '')) : texte;
  }

  private detecter(): Langue {
    try {
      const sauvegardee = localStorage.getItem(LANGUE_KEY);
      if (sauvegardee === 'fr' || sauvegardee === 'en') {
        return sauvegardee;
      }
    } catch {
      // ignore, on retombe sur la langue du navigateur.
    }
    return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'fr';
  }
}
