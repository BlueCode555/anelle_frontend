import { Component, inject } from '@angular/core';

import { TranslationService } from '../../service/i18n/translation.service';

@Component({
  selector: 'app-lang-switcher',
  standalone: true,
  template: `
    <button type="button" class="lang-switcher" (click)="i18n.basculer()" [attr.aria-label]="'Changer de langue / Switch language'">
      {{ i18n.langue() === 'fr' ? 'EN' : 'FR' }}
    </button>
  `,
  styles: [
    `
      .lang-switcher {
        border: 1px solid currentColor;
        background: transparent;
        color: inherit;
        border-radius: 999px;
        padding: 0.25rem 0.65rem;
        font-size: 0.75rem;
        font-weight: 600;
        letter-spacing: 0.03em;
        line-height: 1.4;
        cursor: pointer;
        transition:
          background-color 0.15s ease,
          color 0.15s ease;
      }

      .lang-switcher:hover {
        background-color: rgba(127, 127, 127, 0.15);
      }
    `
  ]
})
export class LangSwitcherComponent {
  i18n = inject(TranslationService);
}
