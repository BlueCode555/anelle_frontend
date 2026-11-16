import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AuditService, Connexion } from 'src/app/theme/shared/service/audit.service';
import { TranslatePipe } from 'src/app/theme/shared/_helpers/translate.pipe';
import { localeCourante } from 'src/app/theme/shared/_helpers/zoned-time';

// Journal des connexions : evenements enregistres par Keycloak (connexion, echec, deconnexion, inscription, mot de passe).
// Keycloak ne donne pas de total : on charge par tranches avec un bouton « Voir plus ancien ».
@Component({
  selector: 'app-audit-connexions',
  imports: [CommonModule, TranslatePipe],
  templateUrl: './audit-connexions.component.html'
})
export class AuditConnexionsComponent {
  private audit = inject(AuditService);

  readonly taille = 20;
  readonly filtres = ['', 'connexion', 'echec', 'deconnexion', 'inscription', 'motdepasse'];
  filtre = signal('');

  evenements = signal<Connexion[]>([]);
  suite = signal(false);
  disponible = signal(true);
  message = signal<string | null>(null);
  loading = signal(true);
  error = signal(false);

  private recharger = effect(() => {
    this.charger(this.filtre(), 0, true);
  });

  changerFiltre(valeur: string): void {
    this.filtre.set(valeur);
  }

  plusAncien(): void {
    this.charger(this.filtre(), this.evenements().length, false);
  }

  private charger(filtre: string, decalage: number, remplacer: boolean): void {
    this.loading.set(true);
    this.error.set(false);
    this.audit.connexions(filtre, decalage, this.taille).subscribe({
      next: (page) => {
        this.disponible.set(page.disponible);
        this.message.set(page.message);
        this.suite.set(page.suite);
        this.evenements.set(remplacer ? page.evenements : [...this.evenements(), ...page.evenements]);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      }
    });
  }

  libelleType(type: string): string {
    return 'audit.conn.' + type;
  }

  estEchec(type: string): boolean {
    return type.endsWith('_ERROR') || type.startsWith('USER_DISABLED');
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString(localeCourante(), { dateStyle: 'short', timeStyle: 'medium' });
  }
}
