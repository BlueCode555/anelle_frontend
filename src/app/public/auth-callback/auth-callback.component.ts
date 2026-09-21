import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { RETOUR_KEY } from '../../theme/shared/_helpers/token-storage';
import { AuthService } from '../../theme/shared/service/auth.service';

// Retour de Keycloak après la connexion : échange le code reçu contre la session, puis ouvre l'espace de gestion.
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
    const ok = !!code && !!state && (await this.auth.terminerLoginPersonnel(code, state));
    if (!ok) {
      this.router.navigate(['/personnel'], { queryParams: { erreur: '1' } });
      return;
    }
    const retour = sessionStorage.getItem(RETOUR_KEY);
    sessionStorage.removeItem(RETOUR_KEY);
    this.router.navigateByUrl(retour && retour.startsWith('/') ? retour : '/default', { replaceUrl: true });
  }
}
