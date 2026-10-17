import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { LOGIN_FLOW_KEY, RETOUR_CLIENT_KEY, RETOUR_STAFF_KEY } from '../../theme/shared/_helpers/token-storage';
import { TranslatePipe } from '../../theme/shared/_helpers/translate.pipe';
import { AuthService } from '../../theme/shared/service/auth.service';

// Retour de Keycloak après la connexion (personnel ou cliente) : échange le code reçu contre la session, puis
// renvoie chacun à sa propre destination.
@Component({
  selector: 'app-auth-callback',
  imports: [TranslatePipe],
  template: `<div class="text-center py-5"><img src="assets/images/logo/monogramme.png" alt="" width="72" height="72" style="animation: pouls 1.4s ease-in-out infinite" /><p class="text-muted mt-3">{{ 'auth.encours' | t }}</p></div>`,
  styles: ['@keyframes pouls { 0%, 100% { opacity: 0.45; transform: scale(0.95); } 50% { opacity: 1; transform: scale(1.05); } }']
})
export class AuthCallbackComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  async ngOnInit(): Promise<void> {
    const params = this.route.snapshot.queryParamMap;
    const code = params.get('code');
    const state = params.get('state');
    // Quel bouton a ete utilise (connexion.component pour une cliente, personnel.component pour le personnel) :
    // sert a savoir ou renvoyer en cas d'echec, avant meme de connaitre le type de compte obtenu.
    const flux = sessionStorage.getItem(LOGIN_FLOW_KEY);
    sessionStorage.removeItem(LOGIN_FLOW_KEY);

    const ok = !!code && !!state && (await this.auth.terminerLogin(code, state));
    if (!ok) {
      this.router.navigate([flux === 'client' ? '/connexion' : '/personnel'], { queryParams: { erreur: '1' } });
      return;
    }

    if (this.auth.user()?.type === 'CLIENT') {
      // Retour a la page voulue avant la connexion (ex. "Prendre rendez-vous"), sinon son espace.
      const retour = sessionStorage.getItem(RETOUR_CLIENT_KEY);
      sessionStorage.removeItem(RETOUR_CLIENT_KEY);
      this.router.navigateByUrl(retour || '/mon-espace', { replaceUrl: true });
      return;
    }

    // Personnel : uniquement la destination demandee par le PERSONNEL (staffGuard) : jamais celle d'une cliente,
    // meme si elle a ete enregistree juste avant sur cet appareil (ex. clic sur "Prendre rendez-vous" sans etre connectee).
    const retour = sessionStorage.getItem(RETOUR_STAFF_KEY);
    const staffRoutes = [
      '/default',
      '/agenda',
      '/collaborateurs',
      '/profils',
      '/clients',
      '/informations',
      '/audit',
      '/statistiques',
      '/categories',
      '/services',
      '/produits',
      '/rayons',
      '/commandes'
    ];
    const versEspaceDeGestion = !!retour && staffRoutes.some((r) => retour === r || retour.startsWith(r + '/'));
    const destination = versEspaceDeGestion ? retour! : '/default';

    if (this.auth.peutChangerProfil()) {
      // Plusieurs profils : on demande lequel avant d'entrer ; la destination est reprise juste apres (voir
      // choisir-profil.component.ts), au lieu de prendre le premier profil en silence.
      sessionStorage.setItem(RETOUR_STAFF_KEY, destination);
      this.router.navigateByUrl('/choisir-profil', { replaceUrl: true });
      return;
    }

    sessionStorage.removeItem(RETOUR_STAFF_KEY);
    this.router.navigateByUrl(destination, { replaceUrl: true });
  }
}
