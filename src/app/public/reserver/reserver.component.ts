import { localeCourante } from 'src/app/theme/shared/_helpers/zoned-time';
import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';

import { SiteHeaderComponent } from '../site-header/site-header.component';
import { ChoixCreneau, SlotPickerComponent } from '../../theme/shared/components/slot-picker/slot-picker.component';
import { AuthService } from '../../theme/shared/service/auth.service';
import { InformationService } from '../../theme/shared/service/information.service';
import { RendezVous, RendezVousService } from '../../theme/shared/service/rendez-vous.service';
import { RETOUR_CLIENT_KEY } from '../../theme/shared/_helpers/token-storage';
import { formatHeure, formatJour } from '../../theme/shared/_helpers/zoned-time';
import { TranslatePipe } from 'src/app/theme/shared/_helpers/translate.pipe';
import { TranslationService } from 'src/app/theme/shared/service/i18n/translation.service';

@Component({
  selector: 'app-reserver',
  imports: [CommonModule, RouterModule, SiteHeaderComponent, SlotPickerComponent, TranslatePipe],
  templateUrl: './reserver.component.html',
  styleUrl: './reserver.component.scss'
})
export class ReserverComponent {
  private i18n = inject(TranslationService);
  private rendezVous = inject(RendezVousService);
  private informations = inject(InformationService);
  private auth = inject(AuthService);

  serviceInitial = inject(ActivatedRoute).snapshot.queryParamMap.get('service');

  private slotPicker = viewChild(SlotPickerComponent);

  choix = signal<ChoixCreneau | null>(null);
  // Autres rendez-vous deja mis de cote (jour different) avant l'envoi de la demande groupee.
  groupes = signal<ChoixCreneau[]>([]);
  note = signal('');
  envoi = signal(false);
  erreur = signal('');
  // Distingue une session expirée (bouton "Se reconnecter") d'une autre erreur (créneau déjà pris, etc.).
  sessionExpiree = signal(false);
  confirmations = signal<RendezVous[]>([]);

  zone = computed(() => this.informations.info()?.fuseauHoraire ?? 'America/Toronto');
  // Un seul soin choisi ne compte pas encore comme "autre rendez-vous" tant qu'un creneau n'est pas retenu.
  peutAjouterAutre = computed(() => this.choix() !== null);

  onChoix(choix: ChoixCreneau | null): void {
    this.choix.set(choix);
    this.erreur.set('');
    this.sessionExpiree.set(false);
  }

  onNote(event: Event): void {
    this.note.set((event.target as HTMLTextAreaElement).value);
  }

  // Met de cote le creneau en cours pour permettre a la cliente de choisir un autre soin un autre jour, dans
  // la meme demande (ex. gommage le lundi + soin du visage le samedi, envoyes ensemble).
  ajouterAutreRendezVous(): void {
    const choix = this.choix();
    if (!choix) return;
    this.groupes.update((liste) => [...liste, choix]);
    this.choix.set(null);
    this.slotPicker()?.reinitialiser();
  }

  retirerGroupe(index: number): void {
    this.groupes.update((liste) => liste.filter((_, i) => i !== index));
  }

  envoyer(): void {
    const demandes = [...this.groupes(), ...(this.choix() ? [this.choix()!] : [])];
    if (!demandes.length || this.envoi()) {
      return;
    }
    this.envoi.set(true);
    this.erreur.set('');
    this.sessionExpiree.set(false);
    this.envoyerSuivant(demandes, 0, []);
  }

  // Les rendez-vous sur des jours differents n'existent pas comme une seule entite cote serveur : on les
  // cree l'un apres l'autre et on presente le resultat comme une seule demande groupee.
  private envoyerSuivant(demandes: ChoixCreneau[], index: number, resultats: RendezVous[]): void {
    if (index >= demandes.length) {
      this.confirmations.set(resultats);
      this.envoi.set(false);
      this.groupes.set([]);
      this.choix.set(null);
      return;
    }
    const choix = demandes[index];
    this.rendezVous
      .creer({
        serviceCode: choix.serviceCode,
        serviceCodesSupplementaires: choix.serviceCodesSupplementaires,
        debut: choix.debut,
        note: this.note().trim() || undefined
      })
      .subscribe({
        next: (rdv) => this.envoyerSuivant(demandes, index + 1, [...resultats, rdv]),
        error: (err) => {
          this.envoi.set(false);
          // Les demandes deja envoyees avec succes restent valides cote serveur (pas besoin de les refaire).
          // Le creneau qui a echoue est abandonne (probablement plus disponible) ; les demandes pas encore
          // tentees restent en attente pour que la cliente puisse reessayer sans tout recommencer.
          this.groupes.set(demandes.slice(index + 1));
          this.choix.set(null);
          // 401 = jeton absent/invalide (vraie expiration) ; un 403 est un refus métier du serveur (message a
          // afficher tel quel), pas forcement une session expirée — sinon on induit la cliente en erreur.
          const expiree = err?.status === 401;
          this.sessionExpiree.set(expiree);
          const base = err?.error?.message ?? "Impossible d'enregistrer votre demande. Choisissez un autre créneau.";
          this.erreur.set(
            expiree
              ? this.i18n.t('reserver.sessionExpiree')
              : resultats.length
                ? `${resultats.length} rendez-vous sur ${demandes.length} ont été envoyés. ${base}`
                : base
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
    return new Intl.NumberFormat(localeCourante(), { style: 'currency', currency: 'CAD', currencyDisplay: 'code' }).format(tarif);
  }
}
