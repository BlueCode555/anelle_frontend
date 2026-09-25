import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { PaginationComponent } from 'src/app/theme/shared/components/pagination/pagination.component';

import { Commande, CommandeService, STATUT_COMMANDE_CLASSES } from 'src/app/theme/shared/service/boutique.service';
import { ConfirmationService } from 'src/app/theme/shared/service/confirmation.service';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { TranslationService } from 'src/app/theme/shared/service/i18n/translation.service';
import { TranslatePipe } from 'src/app/theme/shared/_helpers/translate.pipe';
import { localeCourante } from 'src/app/theme/shared/_helpers/zoned-time';

@Component({
  selector: 'app-commande-list',
  imports: [CommonModule, TranslatePipe, PaginationComponent],
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
  // Deux onglets : ce qui reste à faire, et l'historique (remises et annulées : rien à faire, gardées pour mémoire).
  onglet = signal<'cours' | 'historique'>('cours');
  page = signal(1);
  readonly taille = 10;
  enCours = computed(() => this.liste().filter((c) => c.statut === 'EN_ATTENTE_PAIEMENT' || c.statut === 'PAYEE' || c.statut === 'PRETE'));
  historique = computed(() => this.liste().filter((c) => c.statut === 'REMISE' || c.statut === 'ANNULEE'));
  affichees = computed(() => (this.onglet() === 'cours' ? this.enCours() : this.historique()));
  pagees = computed(() => this.affichees().slice((this.page() - 1) * this.taille, this.page() * this.taille));

  choisirOnglet(o: 'cours' | 'historique'): void {
    this.onglet.set(o);
    this.page.set(1);
  }
  aTraiter = computed(() => this.liste().filter((c) => c.statut === 'EN_ATTENTE_PAIEMENT' || c.statut === 'PAYEE' || c.statut === 'PRETE').length);

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

  prete(c: Commande): void {
    this.executer(this.commandes.prete(c.id));
  }

  // Liens d'contact : appel, SMS et courriel préremplis (ouvrent l'application du téléphone ou de messagerie).
  lienSms(c: Commande): string {
    return 'sms:' + c.telephone + '?&body=' + encodeURIComponent(this.i18n.t('cmd.smsTexte', { code: c.code }));
  }

  lienMail(c: Commande): string {
    return (
      'mailto:' + c.clientEmail + '?subject=' + encodeURIComponent(this.i18n.t('cmd.mailSujet', { code: c.code })) +
      '&body=' + encodeURIComponent(this.i18n.t('cmd.mailTexte', { code: c.code }))
    );
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
