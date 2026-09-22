import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

import { AuthService } from '../../theme/shared/service/auth.service';
import { InformationService } from '../../theme/shared/service/information.service';
import { RendezVous, RendezVousService, STATUT_CLASSES, STATUT_LIBELLES } from '../../theme/shared/service/rendez-vous.service';
import { formatHeure, formatJour } from '../../theme/shared/_helpers/zoned-time';
import { RETOUR_CLIENT_KEY } from '../../theme/shared/_helpers/token-storage';
import { SiteHeaderComponent } from '../site-header/site-header.component';
import { ConfirmationService } from 'src/app/theme/shared/service/confirmation.service';

@Component({
  selector: 'app-mon-espace',
  imports: [CommonModule, RouterModule, SiteHeaderComponent],
  templateUrl: './mon-espace.component.html',
  styleUrl: './mon-espace.component.scss'
})
export class MonEspaceComponent implements OnInit {
  auth = inject(AuthService);
  private router = inject(Router);
  private informations = inject(InformationService);
  private rendezVous = inject(RendezVousService);
  private confirmation = inject(ConfirmationService);

  readonly libelles = STATUT_LIBELLES;
  readonly classes = STATUT_CLASSES;

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
  }

  charger(): void {
    this.chargement.set(true);
    this.rendezVous.mes().subscribe({
      next: (liste) => {
        this.rdvs.set(liste);
        this.chargement.set(false);
      },
      error: () => {
        this.erreur.set('Impossible de charger vos rendez-vous pour le moment.');
        this.chargement.set(false);
      }
    });
  }

  peutAnnuler(rdv: RendezVous): boolean {
    return ['DEMANDE', 'ACCEPTE', 'CONFIRME'].includes(rdv.statut) && new Date(rdv.debut).getTime() > Date.now();
  }

  async annuler(rdv: RendezVous): Promise<void> {
    const ok = await this.confirmation.demander({
      titre: 'Annuler votre rendez-vous ?',
      message: rdv.serviceNom,
      texteConfirmer: 'Annuler le rendez-vous',
      texteAnnuler: 'Garder',
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
        this.erreur.set(expiree ? 'Votre session a expiré.' : (err?.error?.message ?? "Impossible d'annuler ce rendez-vous."));
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
    return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(tarif);
  }
}
