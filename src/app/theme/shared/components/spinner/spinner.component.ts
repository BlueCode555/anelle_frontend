// Angular import
import { Component, OnDestroy, ViewEncapsulation, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Router, NavigationStart, NavigationEnd, NavigationCancel, NavigationError } from '@angular/router';

import { TranslatePipe } from '../../_helpers/translate.pipe';

// Voile de chargement affiché pendant les changements de page (navigation du routeur) : un spinner circulaire
// aux couleurs de l'institut, un texte, et un fond semi-transparent qui empêche d'interagir pendant ce temps.
@Component({
  selector: 'app-spinner',
  imports: [TranslatePipe],
  templateUrl: './spinner.component.html',
  styleUrl: './spinner.component.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SpinnerComponent implements OnDestroy {
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  isSpinnerVisible = true;

  constructor() {
    this.router.events.subscribe(
      (event) => {
        if (event instanceof NavigationStart) {
          this.isSpinnerVisible = true;
          this.cdr.markForCheck();
        } else if (event instanceof NavigationEnd || event instanceof NavigationCancel || event instanceof NavigationError) {
          this.isSpinnerVisible = false;
          this.cdr.markForCheck();
        }
      },
      () => {
        this.isSpinnerVisible = false;
        this.cdr.markForCheck();
      }
    );
  }

  ngOnDestroy(): void {
    this.isSpinnerVisible = false;
  }
}
