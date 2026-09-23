import { Component, computed, inject } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { AuthService, ProfilAcces } from '../../../shared/service/auth.service';


// Choix du profil avec lequel on travaille : chaque carte montre ce que le profil permet de faire.
import { TranslationService } from 'src/app/theme/shared/service/i18n/translation.service';
import { TranslatePipe } from 'src/app/theme/shared/_helpers/translate.pipe';

@Component({
  selector: 'app-changer-profil',
  imports: [TranslatePipe],
  templateUrl: './changer-profil.component.html',
  styleUrl: './changer-profil.component.scss'
})
export class ChangerProfilComponent {
  private auth = inject(AuthService);
  private i18n = inject(TranslationService);
  activeModal = inject(NgbActiveModal);

  profils = computed(() => this.auth.user()?.profils ?? []);
  actuel = computed(() => this.auth.profilActif()?.code ?? null);

  ecrans(profil: ProfilAcces): string[] {
    return profil.permissions.filter((p) => p.lire).map((p) => this.i18n.t('ecran.' + p.ecran));
  }

  choisir(profil: ProfilAcces): void {
    this.auth.changerProfil(profil.code);
    this.activeModal.close(profil.code);
  }
}
