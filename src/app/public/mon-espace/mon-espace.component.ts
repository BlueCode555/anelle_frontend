import { localeCourante } from 'src/app/theme/shared/_helpers/zoned-time';
import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

import { AuthService } from '../../theme/shared/service/auth.service';
import { InformationService } from '../../theme/shared/service/information.service';
import { Commande, CommandeService, STATUT_COMMANDE_CLASSES } from '../../theme/shared/service/boutique.service';
import { RendezVous, RendezVousService, STATUT_CLASSES, STATUT_LIBELLES } from '../../theme/shared/service/rendez-vous.service';
import { formatHeure, formatJour } from '../../theme/shared/_helpers/zoned-time';
import { RETOUR_CLIENT_KEY } from '../../theme/shared/_helpers/token-storage';
import { SiteHeaderComponent } from '../site-header/site-header.component';
import { ConfirmationService } from 'src/app/theme/shared/service/confirmation.service';
import { TranslatePipe } from 'src/app/theme/shared/_helpers/translate.pipe';
import { TranslationService } from 'src/app/theme/shared/service/i18n/translation.service';

@Component({
  selector: 'app-mon-espace',
  imports: [CommonModule, RouterModule, SiteHeaderComponent, TranslatePipe],
  templateUrl: './mon-espace.component.html',
  styleUrl: './mon-espace.component.scss'
})
export class MonEspaceComponent implements OnInit {
  private i18n = inject(TranslationService);
  auth = inject(AuthService);
  private router = inject(Router);
  private informations = inject(InformationService);
  private rendezVous = inject(RendezVousService);
  private commandesApi = inject(CommandeService);
  private confirmation = inject(ConfirmationService);

  readonly libelles = STATUT_LIBELLES;
  readonly classes = STATUT_CLASSES;
  readonly classesCommande = STATUT_COMMANDE_CLASSES;

  commandes = signal<Commande[]>([]);

  rdvs = signal<RendezVous[]>([]);
  chargement = signal(true);
  erreur = signal('');
  sessionExpiree = signal(false);

  zone = computed(() => this.informations.info()?.fuseauHoraire ?? 'America/Toronto');
  paiements = computed(() => this.rdvs().filter((r) => !!r.payeLe && r.statut !== 'ANNULE'));

  constructor() {
    // Session refusee par le serveur (token expire, deconnexion) : retour a la page de connexion.
    effect(() => {
      if (!this.auth.loading() && !this.auth.user()) {
        this.router.navigate(['/connexion']);
      }
    });
  }

  ngOnInit(): void {
    this.informations.ensureLoaded();
    this.charger();
    this.chargerCommandes();
  }

  charger(): void {
    this.chargement.set(true);
    this.rendezVous.mes().subscribe({
      next: (liste) => {
        this.rdvs.set(liste);
        this.chargement.set(false);
      },
      error: () => {
        this.erreur.set(this.i18n.t('espace.erreurChargement'));
        this.chargement.set(false);
      }
    });
  }

  chargerCommandes(): void {
    // Non bloquant : un souci sur la boutique ne doit pas masquer les rendez-vous.
    this.commandesApi.mes().subscribe({ next: (liste) => this.commandes.set(liste), error: () => this.commandes.set([]) });
  }

  async annulerCommande(c: Commande): Promise<void> {
    const ok = await this.confirmation.demander({
      titre: this.i18n.t('espace.annulerCommandeTitre', { code: c.code }),
      texteConfirmer: this.i18n.t('cmd.annulerConfirmer'),
      texteAnnuler: this.i18n.t('espace.garder'),
      danger: true
    });
    if (!ok) {
      return;
    }
    this.erreur.set('');
    this.commandesApi.annuler(c.id).subscribe({
      next: () => this.chargerCommandes(),
      error: (err) => this.erreur.set(err?.status === 401 ? this.i18n.t('espace.sessionExpiree') : (err?.error?.message ?? this.i18n.t('espace.erreurAnnuler')))
    });
  }

  formatDate(iso: string): string {
    return new Intl.DateTimeFormat(localeCourante(), { dateStyle: 'medium' }).format(new Date(iso));
  }

  peutAnnuler(rdv: RendezVous): boolean {
    return ['DEMANDE', 'ACCEPTE', 'CONFIRME'].includes(rdv.statut) && new Date(rdv.debut).getTime() > Date.now();
  }

  async annuler(rdv: RendezVous): Promise<void> {
    const ok = await this.confirmation.demander({
      titre: this.i18n.t('espace.annulerTitre'),
      message: rdv.serviceNom,
      texteConfirmer: this.i18n.t('espace.annulerConfirmer'),
      texteAnnuler: this.i18n.t('espace.garder'),
      danger: true
    });
    if (!ok) {
      return;
    }
    this.erreur.set('');
    this.sessionExpiree.set(false);
    this.rendezVous.annuler(rdv.id).subscribe({
      next: () => this.charger(),
      error: (err) => {
        // 401 = jeton absent/invalide (vraie expiration) ; un 403 est un refus métier du serveur (message a
        // afficher tel quel), pas forcement une session expirée.
        const expiree = err?.status === 401;
        this.sessionExpiree.set(expiree);
        this.erreur.set(expiree ? this.i18n.t('espace.sessionExpiree') : (err?.error?.message ?? this.i18n.t('espace.erreurAnnuler')));
      }
    });
  }

  reconnecter(): void {
    sessionStorage.setItem(RETOUR_CLIENT_KEY, '/mon-espace');
    this.auth.loginClient();
  }

  jour(iso: string): string {
    return formatJour(iso, this.zone());
  }

  heure(iso: string): string {
    return formatHeure(iso, this.zone());
  }

  formatTarif(tarif: number): string {
    return new Intl.NumberFormat(localeCourante(), { style: 'currency', currency: 'CAD' }).format(tarif);
  }

  // Collaborateur affecté, sinon l'institut lui-même s'en occupe.
  avecQui(rdv: RendezVous): string {
    return rdv.collaborateurNom ?? this.informations.info()?.nom ?? '';
  }

  afficherAvecQui(rdv: RendezVous): boolean {
    return ['DEMANDE', 'ACCEPTE', 'CONFIRME'].includes(rdv.statut);
  }
}
