import { Component, OnInit, computed, inject, signal } from '@angular/core';
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

  // Code du profil retenu dans la liste deroulante (le premier par defaut, une fois les profils connus).
  codeChoisi = signal<string | null>(null);
  profilChoisi = computed<ProfilAcces | null>(() => {
    const liste = this.auth.user()?.profils ?? [];
    return liste.find((p) => p.code === this.codeChoisi()) ?? liste[0] ?? null;
  });

  async ngOnInit(): Promise<void> {
    await this.auth.pret();
    // Rien a choisir (un seul profil, ou esthéticienne) : on ne devrait pas arriver ici, on repart directement.
    if (!this.auth.peutChangerProfil()) {
      this.continuer();
      return;
    }
    this.codeChoisi.set(this.auth.user()?.profils?.[0]?.code ?? null);
  }

  ecrans(profil: ProfilAcces): string[] {
    return profil.permissions.filter((p) => p.lire).map((p) => p.ecran);
  }

  selectionner(event: Event): void {
    this.codeChoisi.set((event.target as HTMLSelectElement).value);
  }

  valider(): void {
    const profil = this.profilChoisi();
    if (!profil) return;
    this.auth.changerProfil(profil.code);
    this.continuer();
  }

  // Reprend la connexion a zero (utile pour se reconnecter avec un autre compte).
  revenir(): void {
    this.auth.logout();
  }

  private continuer(): void {
    const destination = sessionStorage.getItem(RETOUR_STAFF_KEY) || '/default';
    sessionStorage.removeItem(RETOUR_STAFF_KEY);
    this.router.navigateByUrl(destination, { replaceUrl: true });
  }
}
