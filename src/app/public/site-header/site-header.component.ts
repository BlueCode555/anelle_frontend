import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { AuthService } from '../../theme/shared/service/auth.service';
import { InformationService } from '../../theme/shared/service/information.service';
import { ConfirmationService } from 'src/app/theme/shared/service/confirmation.service';
import { PanierService } from 'src/app/theme/shared/service/panier.service';
import { TranslationService } from 'src/app/theme/shared/service/i18n/translation.service';
import { TranslatePipe } from 'src/app/theme/shared/_helpers/translate.pipe';
import { LangSwitcherComponent } from 'src/app/theme/shared/component/lang-switcher/lang-switcher.component';

@Component({
  selector: 'app-site-header',
  imports: [CommonModule, RouterModule, TranslatePipe, LangSwitcherComponent],
  templateUrl: './site-header.component.html',
  styleUrl: './site-header.component.scss'
})
export class SiteHeaderComponent {
  auth = inject(AuthService);
  private informations = inject(InformationService);
  private confirmation = inject(ConfirmationService);
  private i18n = inject(TranslationService);
  panier = inject(PanierService);

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
      titre: this.i18n.t('header.confirmerDeconnexion.titre'),
      texteConfirmer: this.i18n.t('header.confirmerDeconnexion.bouton'),
      danger: true,
      icone: 'ti-logout-2'
    });
    if (ok) {
      this.auth.logout();
    }
  }
}
