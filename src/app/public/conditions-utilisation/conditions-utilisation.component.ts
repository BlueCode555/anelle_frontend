import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

import { SiteHeaderComponent } from '../site-header/site-header.component';

@Component({
  selector: 'app-conditions-utilisation',
  imports: [RouterModule, SiteHeaderComponent],
  templateUrl: './conditions-utilisation.component.html',
  styleUrl: '../politique-confidentialite/page-legale.scss'
})
export class ConditionsUtilisationComponent {}
