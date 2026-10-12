import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

import { SiteHeaderComponent } from '../site-header/site-header.component';

@Component({
  selector: 'app-politique-confidentialite',
  imports: [RouterModule, SiteHeaderComponent],
  templateUrl: './politique-confidentialite.component.html',
  styleUrl: './page-legale.scss'
})
export class PolitiqueConfidentialiteComponent {}
