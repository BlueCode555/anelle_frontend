import { Pipe, PipeTransform, inject } from '@angular/core';

import { TranslationService } from '../service/i18n/translation.service';

// Impur : doit se reevaluer quand la langue change alors meme que la cle passee au pipe, elle, ne change pas.
@Pipe({ name: 't', standalone: true, pure: false })
export class TranslatePipe implements PipeTransform {
  private i18n = inject(TranslationService);

  transform(cle: string, params?: Record<string, string | number>): string {
    return this.i18n.t(cle, params);
  }
}
