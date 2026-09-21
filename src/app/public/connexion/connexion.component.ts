import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';

import { AuthService } from '../../theme/shared/service/auth.service';
import { InformationService } from '../../theme/shared/service/information.service';
import { SiteHeaderComponent } from '../site-header/site-header.component';

// Page de connexion des clientes : la methode de connexion reste a choisir.
@Component({
  selector: 'app-connexion',
  imports: [RouterModule, SiteHeaderComponent],
  templateUrl: './connexion.component.html',
  styleUrl: './connexion.component.scss'
})
export class ConnexionComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  nom = inject(InformationService).nom;

  ngOnInit(): void {
    if (this.auth.user()?.type === 'CLIENT') {
      this.router.navigate(['/mon-espace']);
    }
  }
}
