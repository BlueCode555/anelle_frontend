import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';

import { Commande, CommandeService, STATUT_COMMANDE_CLASSES } from 'src/app/theme/shared/service/boutique.service';
import { ConfirmationService } from 'src/app/theme/shared/service/confirmation.service';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { TranslationService } from 'src/app/theme/shared/service/i18n/translation.service';
import { TranslatePipe } from 'src/app/theme/shared/_helpers/translate.pipe';
import { localeCourante } from 'src/app/theme/shared/_helpers/zoned-time';

@Component({
  selector: 'app-commande-list',
  imports: [CommonModule, TranslatePipe],
  templateUrl: './commande-list.component.html',
  styleUrl: './commande-list.component.scss'
})
export class CommandeListComponent implements OnInit {
  private i18n = inject(TranslationService);
  private commandes = inject(CommandeService);
  private confirmation = inject(ConfirmationService);
  private auth = inject(AuthService);

  readonly classes = STATUT_COMMANDE_CLASSES;

  liste = signal<Commande[]>([]);
  chargement = signal(true);
  erreur = signal('');
  ouverte = signal<number | null>(null);
  aTraiter = computed(() => this.liste().filter((c) => c.statut === 'EN_ATTENTE_PAIEMENT' || c.statut === 'PAYEE').length);

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.commandes.toutes().subscribe({
      next: (liste) => {
        this.liste.set(liste);
        this.chargement.set(false);
      },
      error: () => {
        this.erreur.set(this.i18n.t('cmd.erreurCharger'));
        this.chargement.set(false);
      }
    });
  }

  basculer(id: number): void {
    this.ouverte.update((o) => (o === id ? null : id));
  }

  formatPrix(prix: number): string {
    return new Intl.NumberFormat(localeCourante(), { style: 'currency', currency: 'CAD' }).format(prix);
  }

  formatDate(iso: string): string {
    return new Intl.DateTimeFormat(localeCourante(), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  }

  marquerPaye(c: Commande): void {
    const reference = prompt(this.i18n.t('cmd.promptPaiement', { montant: this.formatPrix(c.total) }), '');
    if (reference === null) return;
    this.executer(this.commandes.marquerPaye(c.id, reference));
  }

  remettre(c: Commande): void {
    this.executer(this.commandes.remettre(c.id));
  }

  async annuler(c: Commande): Promise<void> {
    const ok = await this.confirmation.demander({
      titre: this.i18n.t('cmd.annulerTitre', { code: c.code }),
      message: this.i18n.t('cmd.annulerMsg'),
      texteConfirmer: this.i18n.t('cmd.annulerConfirmer'),
      texteAnnuler: this.i18n.t('espace.garder'),
      danger: true
    });
    if (ok) {
      this.executer(this.commandes.annuler(c.id));
    }
  }

  // Marquer payé / remise : droit de modification de l'écran Commandes ; l'annulation est ouverte à toute personne connectée côté API.
  peutModifier(): boolean {
    return this.auth.peut('COMMANDES', 'modifier');
  }

  private executer(action: Observable<Commande>): void {
    this.erreur.set('');
    action.subscribe({
      next: () => this.charger(),
      error: (err) => this.erreur.set(err?.error?.message ?? this.i18n.t('ts.agenda.actionEchec'))
    });
  }
}
