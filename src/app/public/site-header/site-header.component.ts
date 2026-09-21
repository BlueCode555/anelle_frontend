import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { AuthService } from '../../theme/shared/service/auth.service';
import { InformationService } from '../../theme/shared/service/information.service';
import { ConfirmationService } from 'src/app/theme/shared/service/confirmation.service';

@Component({
  selector: 'app-site-header',
  imports: [CommonModule, RouterModule],
  templateUrl: './site-header.component.html',
  styleUrl: './site-header.component.scss'
})
export class SiteHeaderComponent {
  auth = inject(AuthService);
  private informations = inject(InformationService);
  private confirmation = inject(ConfirmationService);

  nom = this.informations.nom;
  menuOpen = signal(false);

  constructor() {
    this.informations.ensureLoaded();
  }

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  async logout(): Promise<void> {
    this.closeMenu();
    const ok = await this.confirmation.demander({
      titre: 'Se déconnecter ?',
      texteConfirmer: 'Se déconnecter',
      danger: true,
      icone: 'ti-logout-2'
    });
    if (ok) {
      this.auth.logout();
    }
  }
}
