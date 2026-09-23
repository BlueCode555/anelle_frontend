import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { AuthService } from '../../theme/shared/service/auth.service';
import { InformationService } from '../../theme/shared/service/information.service';
import { SiteHeaderComponent } from '../site-header/site-header.component';
import { TranslatePipe } from 'src/app/theme/shared/_helpers/translate.pipe';

// Page de connexion du personnel (esthéticienne et collaborateurs) : le mot de passe se saisit chez Keycloak, jamais ici.
@Component({
  selector: 'app-personnel',
  imports: [RouterModule, SiteHeaderComponent, TranslatePipe],
  templateUrl: './personnel.component.html',
  styleUrl: '../connexion/connexion.component.scss'
})
export class PersonnelComponent implements OnInit {
  auth = inject(AuthService);
  nom = inject(InformationService).nom;
  private router = inject(Router);
  erreur = inject(ActivatedRoute).snapshot.queryParamMap.get('erreur');

  async ngOnInit(): Promise<void> {
    await this.auth.pret();
    if (this.auth.user()?.type === 'PERSONNEL') {
      this.router.navigate(['/default']);
    }
  }

  connexion(): void {
    this.auth.loginPersonnel();
  }
}
