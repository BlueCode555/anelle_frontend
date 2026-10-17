import { Component, OnInit, inject, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { FormField, form, required } from '@angular/forms/signals';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { RayonForm, RayonResponse, RayonService } from 'src/app/theme/shared/service/boutique.service';
import { ConfirmationService } from 'src/app/theme/shared/service/confirmation.service';
import { TranslatePipe } from 'src/app/theme/shared/_helpers/translate.pipe';
import { TranslationService } from 'src/app/theme/shared/service/i18n/translation.service';

@Component({
  selector: 'app-rayon-form',
  imports: [FormsModule, FormField, TranslatePipe],
  templateUrl: './rayon-form.component.html'
})
export class RayonFormComponent implements OnInit {
  private i18n = inject(TranslationService);
  private rayons = inject(RayonService);
  activeModal = inject(NgbActiveModal);
  private confirmation = inject(ConfirmationService);

  // Renseigné par la liste (via componentInstance) avant l'affichage ; null = création.
  // La liste étant déjà chargée côté client, on reçoit directement l'objet (pas besoin d'un appel réseau de plus).
  rayon: RayonResponse | null = null;
  get rayonId(): number | null {
    return this.rayon?.id ?? null;
  }

  chargement = signal(false);
  submitted = signal(false);
  saving = signal(false);
  serverError = signal('');

  rayonModel = signal<RayonForm>({ libelle: '', actif: true });

  rayonForm = form(this.rayonModel, (schemaPath) => {
    required(schemaPath.libelle, { message: this.i18n.t('ts.ray.libelleObligatoire') });
  });

  ngOnInit(): void {
    if (this.rayon) {
      this.rayonModel.set({ libelle: this.rayon.libelle, actif: this.rayon.actif });
    }
  }

  async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.submitted.set(true);
    this.serverError.set('');

    if (this.rayonForm().invalid()) {
      return;
    }

    const ok = await this.confirmation.demander({
      titre: this.rayonId ? this.i18n.t('ts.form.modifs') : this.i18n.t('ts.ray.enregistrer'),
      message: this.rayonModel().libelle,
      texteConfirmer: this.i18n.t('ts.enregistrer')
    });
    if (!ok) return;

    this.saving.set(true);
    const value = this.rayonModel();
    const request = this.rayonId ? this.rayons.update(this.rayonId, value) : this.rayons.create(value);

    request.subscribe({
      next: () => this.activeModal.close('saved'),
      error: (err) => {
        this.saving.set(false);
        this.serverError.set(
          err?.status === 401 || err?.status === 403
            ? this.i18n.t('ts.form.actionRefusee')
            : (err?.error?.message ?? this.i18n.t('ts.erreurGenerique'))
        );
      }
    });
  }
}
