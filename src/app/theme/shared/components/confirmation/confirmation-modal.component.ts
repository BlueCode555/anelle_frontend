import { Component, inject } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

// Fenetre de confirmation (remplace les boites du navigateur) : ouverte par ConfirmationService.
@Component({
  selector: 'app-confirmation-modal',
  template: `
    <div class="modal-body text-center p-4">
      <span class="conf-icone" [class.is-danger]="danger">
        <i class="ti" [class]="icone"></i>
      </span>
      <h5 class="mt-3 mb-2">{{ titre }}</h5>
      @if (message) {
        <p class="text-muted mb-0">{{ message }}</p>
      }
    </div>
    <div class="modal-footer justify-content-center border-0 pt-0 pb-4 gap-2">
      <button type="button" class="btn btn-outline-secondary px-4" (click)="activeModal.close(false)">{{ texteAnnuler }}</button>
      <button type="button" class="btn px-4" [class.btn-primary]="!danger" [class.btn-danger]="danger" (click)="activeModal.close(true)">
        {{ texteConfirmer }}
      </button>
    </div>
  `,
  styles: `
    .conf-icone {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      font-size: 1.8rem;
      color: var(--ar-dore);
      background: rgba(232, 200, 116, 0.25);
    }
    .conf-icone.is-danger {
      color: #b3372b;
      background: #fbe9e6;
    }
  `
})
export class ConfirmationModalComponent {
  activeModal = inject(NgbActiveModal);

  // Renseignes par ConfirmationService avant l'affichage
  titre = '';
  message = '';
  texteConfirmer = 'Confirmer';
  texteAnnuler = 'Annuler';
  danger = false;
  icone = 'ti-help-circle';
}
