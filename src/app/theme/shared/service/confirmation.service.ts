import { Injectable, inject } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { TranslationService } from './i18n/translation.service';
import { ConfirmationModalComponent } from '../components/confirmation/confirmation-modal.component';

export interface OptionsConfirmation {
  titre: string;
  message?: string;
  texteConfirmer?: string;
  texteAnnuler?: string;
  // Action destructrice (suppression, deconnexion...) : bouton rouge
  danger?: boolean;
  icone?: string;
}

// Demande une confirmation dans une fenetre aux couleurs du site : `if (!(await confirmation.demander({...}))) return;`
@Injectable({ providedIn: 'root' })
export class ConfirmationService {
  private modals = inject(NgbModal);
  private i18n = inject(TranslationService);

  async demander(options: OptionsConfirmation): Promise<boolean> {
    const ref = this.modals.open(ConfirmationModalComponent, { centered: true, size: 'sm', backdrop: 'static' });
    Object.assign(ref.componentInstance, {
      titre: options.titre,
      message: options.message ?? '',
      texteConfirmer: options.texteConfirmer ?? this.i18n.t('confirm.confirmer'),
      texteAnnuler: options.texteAnnuler ?? this.i18n.t('a.annuler'),
      danger: options.danger ?? false,
      icone: options.icone ?? (options.danger ? 'ti-alert-triangle' : 'ti-help-circle')
    });
    try {
      return (await ref.result) === true;
    } catch {
      return false;
    }
  }
}
