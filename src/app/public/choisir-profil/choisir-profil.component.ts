import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService, ProfilAcces } from '../../theme/shared/service/auth.service';
import { InformationService } from '../../theme/shared/service/information.service';
import { RETOUR_STAFF_KEY } from '../../theme/shared/_helpers/token-storage';
import { SiteHeaderComponent } from '../site-header/site-header.component';
import { TranslatePipe } from 'src/app/theme/shared/_helpers/translate.pipe';

// Etape affichee juste apres la connexion du personnel quand la personne a plusieurs profils : elle choisit
// avec lequel elle travaille avant d'entrer dans l'espace de gestion (au lieu du premier profil pris par defaut
// en silence). Voir auth-callback.component.ts, qui redirige ici plutot que vers la destination finale.
@Component({
  selector: 'app-choisir-profil',
  imports: [SiteHeaderComponent, TranslatePipe],
  templateUrl: './choisir-profil.component.html',
  styleUrls: ['../connexion/connexion.component.scss', './choisir-profil.component.scss']
})
export class ChoisirProfilComponent implements OnInit {
  auth = inject(AuthService);
  nom = inject(InformationService).nom;
  private router = inject(Router);

  async ngOnInit(): Promise<void> {
    await this.auth.pret();
    // Rien a choisir (un seul profil, ou esthéticienne) : on ne devrait pas arriver ici, on repart directement.
    if (!this.auth.peutChangerProfil()) {
      this.continuer();
    }
  }

  ecrans(profil: ProfilAcces): string[] {
    return profil.permissions.filter((p) => p.lire).map((p) => p.ecran);
  }

  choisir(profil: ProfilAcces): void {
    this.auth.changerProfil(profil.code);
    this.continuer();
  }

  private continuer(): void {
    const destination = sessionStorage.getItem(RETOUR_STAFF_KEY) || '/default';
    sessionStorage.removeItem(RETOUR_STAFF_KEY);
    this.router.navigateByUrl(destination, { replaceUrl: true });
  }
}
