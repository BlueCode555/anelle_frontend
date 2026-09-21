import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  type: 'succes' | 'erreur';
  texte: string;
}

// Petits messages qui confirment une action (« Enregistré », « Supprimé »...) et disparaissent tout seuls.
@Injectable({ providedIn: 'root' })
export class ToastService {
  messages = signal<Toast[]>([]);
  private compteur = 0;

  succes(texte: string): void {
    this.ajouter('succes', texte, 3500);
  }

  erreur(texte: string): void {
    this.ajouter('erreur', texte, 6000);
  }

  fermer(id: number): void {
    this.messages.update((liste) => liste.filter((t) => t.id !== id));
  }

  private ajouter(type: Toast['type'], texte: string, dureeMs: number): void {
    const id = ++this.compteur;
    this.messages.update((liste) => [...liste, { id, type, texte }]);
    setTimeout(() => this.fermer(id), dureeMs);
  }
}
