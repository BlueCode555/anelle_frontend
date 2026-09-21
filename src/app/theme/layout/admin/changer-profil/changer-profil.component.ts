import { Component, computed, inject } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { AuthService, EcranCode, ProfilAcces } from '../../../shared/service/auth.service';

const LIBELLES_ECRANS: Record<EcranCode, string> = {
  AGENDA: 'Agenda',
  INFORMATIONS: 'Mon institut',
  CATEGORIES: 'Catégories',
  SERVICES: 'Services'
};

// Choix du profil avec lequel on travaille : chaque carte montre ce que le profil permet de faire.
@Component({
  selector: 'app-changer-profil',
  templateUrl: './changer-profil.component.html',
  styleUrl: './changer-profil.component.scss'
})
export class ChangerProfilComponent {
  private auth = inject(AuthService);
  activeModal = inject(NgbActiveModal);

  profils = computed(() => this.auth.user()?.profils ?? []);
  actuel = computed(() => this.auth.profilActif()?.code ?? null);

  ecrans(profil: ProfilAcces): string[] {
    return profil.permissions.filter((p) => p.lire).map((p) => LIBELLES_ECRANS[p.ecran]);
  }

  choisir(profil: ProfilAcces): void {
    this.auth.changerProfil(profil.code);
    this.activeModal.close(profil.code);
  }
}
