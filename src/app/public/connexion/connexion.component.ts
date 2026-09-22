import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { AuthService } from '../../theme/shared/service/auth.service';
import { InformationService } from '../../theme/shared/service/information.service';
import { SiteHeaderComponent } from '../site-header/site-header.component';

// Page de connexion des clientes : un seul bouton, "Continuer avec Google" (Keycloak gere la connexion Google).
@Component({
  selector: 'app-connexion',
  imports: [RouterModule, SiteHeaderComponent],
  templateUrl: './connexion.component.html',
  styleUrl: './connexion.component.scss'
})
export class ConnexionComponent implements OnInit {
  auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  nom = inject(InformationService).nom;

  // Vrai si on revient d'une tentative de connexion qui a echoue (voir auth-callback.component).
  echec = signal(false);
  connexionEnCours = signal(false);

  ngOnInit(): void {
    if (this.auth.user()?.type === 'CLIENT') {
      this.router.navigate(['/mon-espace']);
      return;
    }
    this.echec.set(this.route.snapshot.queryParamMap.get('erreur') === '1');
  }

  connecter(): void {
    this.connexionEnCours.set(true);
    this.auth.loginClient();
  }
}
