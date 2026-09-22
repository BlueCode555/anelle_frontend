import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { LOGIN_FLOW_KEY, RETOUR_CLIENT_KEY, RETOUR_STAFF_KEY } from '../../theme/shared/_helpers/token-storage';
import { AuthService } from '../../theme/shared/service/auth.service';

// Retour de Keycloak après la connexion (personnel ou cliente) : échange le code reçu contre la session, puis
// renvoie chacun à sa propre destination.
@Component({
  selector: 'app-auth-callback',
  template: `<p class="text-center text-muted py-5">Connexion en cours...</p>`
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
    sessionStorage.removeItem(RETOUR_STAFF_KEY);
    const staffRoutes = ['/default', '/agenda', '/collaborateurs', '/profils', '/informations', '/categories', '/services'];
    const versEspaceDeGestion = !!retour && staffRoutes.some((r) => retour === r || retour.startsWith(r + '/'));
    this.router.navigateByUrl(versEspaceDeGestion ? retour! : '/default', { replaceUrl: true });
  }
}
