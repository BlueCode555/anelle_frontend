import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';

import { SiteHeaderComponent } from '../site-header/site-header.component';
import { ChoixCreneau, SlotPickerComponent } from '../../theme/shared/components/slot-picker/slot-picker.component';
import { AuthService } from '../../theme/shared/service/auth.service';
import { InformationService } from '../../theme/shared/service/information.service';
import { RendezVous, RendezVousService } from '../../theme/shared/service/rendez-vous.service';
import { RETOUR_CLIENT_KEY } from '../../theme/shared/_helpers/token-storage';
import { formatHeure, formatJour } from '../../theme/shared/_helpers/zoned-time';

@Component({
  selector: 'app-reserver',
  imports: [CommonModule, RouterModule, SiteHeaderComponent, SlotPickerComponent],
  templateUrl: './reserver.component.html',
  styleUrl: './reserver.component.scss'
})
export class ReserverComponent {
  private rendezVous = inject(RendezVousService);
  private informations = inject(InformationService);
  private auth = inject(AuthService);

  serviceInitial = inject(ActivatedRoute).snapshot.queryParamMap.get('service');

  choix = signal<ChoixCreneau | null>(null);
  note = signal('');
  envoi = signal(false);
  erreur = signal('');
  // Distingue une session expirée (bouton "Se reconnecter") d'une autre erreur (créneau déjà pris, etc.).
  sessionExpiree = signal(false);
  confirmation = signal<RendezVous | null>(null);

  zone = computed(() => this.informations.info()?.fuseauHoraire ?? 'America/Toronto');

  onChoix(choix: ChoixCreneau | null): void {
    this.choix.set(choix);
    this.erreur.set('');
    this.sessionExpiree.set(false);
  }

  onNote(event: Event): void {
    this.note.set((event.target as HTMLTextAreaElement).value);
  }

  envoyer(): void {
    const choix = this.choix();
    if (!choix || this.envoi()) {
      return;
    }
    this.envoi.set(true);
    this.erreur.set('');
    this.sessionExpiree.set(false);
    this.rendezVous.creer({ serviceCode: choix.serviceCode, debut: choix.debut, note: this.note().trim() || undefined }).subscribe({
      next: (rdv) => {
        this.confirmation.set(rdv);
        this.envoi.set(false);
      },
      error: (err) => {
        this.envoi.set(false);
        this.choix.set(null);
        const expiree = err?.status === 401 || err?.status === 403;
        this.sessionExpiree.set(expiree);
        this.erreur.set(
          expiree
            ? 'Votre session a expiré pendant que vous choisissiez votre créneau.'
            : (err?.error?.message ?? "Impossible d'enregistrer votre demande. Choisissez un autre créneau.")
        );
      }
    });
  }

  // Renvoie vers la connexion Google puis, une fois reconnectée, directement sur cette page — il ne restera
  // qu'à re-choisir le créneau (perdu, comme toute selection non confirmee lors d'une reconnexion).
  reconnecter(): void {
    const retour = this.serviceInitial ? `/reserver?service=${encodeURIComponent(this.serviceInitial)}` : '/reserver';
    sessionStorage.setItem(RETOUR_CLIENT_KEY, retour);
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
