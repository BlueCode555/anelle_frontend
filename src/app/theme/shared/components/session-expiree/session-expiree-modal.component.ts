import { Component, inject } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { TranslatePipe } from '../../_helpers/translate.pipe';

// Fenêtre affichée après une déconnexion automatique pour inactivité (voir auth.service.ts) : un seul bouton,
// pas de "fermer" ni de clic en dehors — la personne doit explicitement accuser réception avant de revenir
// à l'écran de connexion (pas de reprise de session en re-bougeant simplement la souris).
@Component({
  selector: 'app-session-expiree-modal',
  imports: [TranslatePipe],
  template: `
    <div class="modal-body text-center p-4">
      <span class="sess-icone"><i class="ti ti-alert-triangle"></i></span>
      <h5 class="mt-3 mb-2">{{ 'connexion.sessionExpireeTitre' | t }}</h5>
      <p class="text-muted mb-0">{{ 'connexion.sessionExpiree' | t }}</p>
    </div>
    <div class="modal-footer justify-content-center border-0 pt-0 pb-4">
      <button type="button" class="btn btn-primary px-4" (click)="activeModal.close()">{{ 'connexion.deconnecter' | t }}</button>
    </div>
  `,
  styles: `
    .sess-icone {
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
  `
})
export class SessionExpireeModalComponent {
  activeModal = inject(NgbActiveModal);
}
