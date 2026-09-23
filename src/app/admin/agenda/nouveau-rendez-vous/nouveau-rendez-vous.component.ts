import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { ChoixCreneau, SlotPickerComponent } from 'src/app/theme/shared/components/slot-picker/slot-picker.component';
import { RendezVousService } from 'src/app/theme/shared/service/rendez-vous.service';
import { TranslatePipe } from 'src/app/theme/shared/_helpers/translate.pipe';
import { TranslationService } from 'src/app/theme/shared/service/i18n/translation.service';

// Saisie d'un rendez-vous par le personnel (client au telephone ou au comptoir) : il est deja accepte.
@Component({
  selector: 'app-nouveau-rendez-vous',
  imports: [CommonModule, SlotPickerComponent, TranslatePipe],
  templateUrl: './nouveau-rendez-vous.component.html'
})
export class NouveauRendezVousComponent {
  private i18n = inject(TranslationService);
  private rendezVous = inject(RendezVousService);
  activeModal = inject(NgbActiveModal);

  choix = signal<ChoixCreneau | null>(null);
  contactNom = signal('');
  contactTelephone = signal('');
  contactEmail = signal('');
  note = signal('');
  envoi = signal(false);
  erreur = signal('');
  soumis = signal(false);

  champ(signalChamp: { set(v: string): void }, event: Event): void {
    signalChamp.set((event.target as HTMLInputElement | HTMLTextAreaElement).value);
  }

  enregistrer(): void {
    this.soumis.set(true);
    const choix = this.choix();
    if (!choix || !this.contactNom().trim() || this.envoi()) {
      return;
    }
    this.envoi.set(true);
    this.erreur.set('');
    this.rendezVous
      .creer({
        serviceCode: choix.serviceCode,
        debut: choix.debut,
        contactNom: this.contactNom().trim(),
        contactTelephone: this.contactTelephone().trim() || undefined,
        contactEmail: this.contactEmail().trim() || undefined,
        note: this.note().trim() || undefined
      })
      .subscribe({
        next: () => this.activeModal.close('saved'),
        error: (err) => {
          this.envoi.set(false);
          this.erreur.set(err?.error?.message ?? this.i18n.t('ts.nrdv.erreur'));
        }
      });
  }
}
