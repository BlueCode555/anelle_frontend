import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AuditEntry, AuditService } from 'src/app/theme/shared/service/audit.service';
import { TranslatePipe } from 'src/app/theme/shared/_helpers/translate.pipe';
import { TranslationService } from 'src/app/theme/shared/service/i18n/translation.service';
import { localeCourante } from 'src/app/theme/shared/_helpers/zoned-time';
import { PaginationComponent } from 'src/app/theme/shared/components/pagination/pagination.component';

// Journal d'audit : qui a créé, modifié ou supprimé quoi, et quand (schéma "audit", purgé après 3 ans
// automatiquement côté serveur). Pagination côté serveur (le journal peut devenir volumineux).
@Component({
  selector: 'app-audit-list',
  imports: [CommonModule, TranslatePipe, PaginationComponent],
  templateUrl: './audit-list.component.html',
  styleUrl: './audit-list.component.scss'
})
export class AuditListComponent {
  private i18n = inject(TranslationService);
  private audit = inject(AuditService);

  readonly taille = 20;
  page = signal(1);

  entrees = signal<AuditEntry[]>([]);
  totalElements = signal(0);
  loading = signal(true);
  error = signal(false);

  private recharger = effect(() => {
    this.charger(this.page());
  });

  readonly actionClasses: Record<AuditEntry['action'], string> = {
    CREATION: 'text-bg-success',
    MODIFICATION: 'text-bg-warning',
    SUPPRESSION: 'text-bg-danger'
  };

  private charger(page: number): void {
    this.loading.set(true);
    this.error.set(false);
    this.audit.list({ page, size: this.taille }).subscribe({
      next: (res) => {
        this.entrees.set(res.content);
        this.totalElements.set(res.meta.totalElements);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      }
    });
  }

  formatDate(iso: string): string {
    return new Intl.DateTimeFormat(localeCourante(), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  }

  libelleAction(action: AuditEntry['action']): string {
    return this.i18n.t('audit.action.' + action);
  }
}
