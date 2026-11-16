import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AuditEntry, AuditService, Changement } from 'src/app/theme/shared/service/audit.service';
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

  // Filtres (OBS-15) : la saisie libre est appliquee apres une courte pause pour ne pas interroger le serveur a chaque touche.
  readonly types = ['Client', 'Collaborateur', 'Commande', 'Rendez-vous', 'Service', 'Produit', 'Categorie', 'Rayon', 'Profil', "Informations de l'institut"];
  recherche = signal('');
  type = signal('');
  du = signal('');
  au = signal('');
  private rechercheAppliquee = signal('');
  private minuteur: ReturnType<typeof setTimeout> | null = null;

  private recharger = effect(() => {
    this.charger(this.page(), this.rechercheAppliquee(), this.type(), this.du(), this.au());
  });

  saisirRecherche(valeur: string): void {
    this.recherche.set(valeur);
    if (this.minuteur) clearTimeout(this.minuteur);
    this.minuteur = setTimeout(() => {
      this.page.set(1);
      this.rechercheAppliquee.set(valeur.trim());
    }, 350);
  }

  changerFiltre(cible: 'type' | 'du' | 'au', valeur: string): void {
    this.page.set(1);
    this[cible].set(valeur);
  }

  get filtreActif(): boolean {
    return !!(this.recherche() || this.type() || this.du() || this.au());
  }

  reinitialiser(): void {
    if (this.minuteur) clearTimeout(this.minuteur);
    this.page.set(1);
    this.recherche.set('');
    this.rechercheAppliquee.set('');
    this.type.set('');
    this.du.set('');
    this.au.set('');
  }

  readonly actionClasses: Record<AuditEntry['action'], string> = {
    CREATION: 'text-bg-success',
    MODIFICATION: 'text-bg-warning',
    SUPPRESSION: 'text-bg-danger'
  };

  private charger(page: number, q: string, type: string, du: string, au: string): void {
    this.loading.set(true);
    this.error.set(false);
    this.audit.list({ page, size: this.taille, q: q || undefined, type: type || undefined, du: du || undefined, au: au || undefined }).subscribe({
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

  // Detail (champ / avant / apres) d'une ligne, charge a la demande puis garde pour la page affichee.
  ouverte = signal<string | null>(null);
  details = signal<Record<string, Changement[] | 'chargement' | 'erreur'>>({});

  cle(e: AuditEntry): string {
    return `${e.tableAudit}:${e.entiteId}:${e.revision}`;
  }

  basculerDetail(e: AuditEntry): void {
    const cle = this.cle(e);
    if (this.ouverte() === cle) {
      this.ouverte.set(null);
      return;
    }
    this.ouverte.set(cle);
    if (this.details()[cle] && this.details()[cle] !== 'erreur') return;
    this.details.update((d) => ({ ...d, [cle]: 'chargement' }));
    this.audit.detail(e).subscribe({
      next: (liste) => this.details.update((d) => ({ ...d, [cle]: liste })),
      error: () => this.details.update((d) => ({ ...d, [cle]: 'erreur' }))
    });
  }

  contenuDetail(e: AuditEntry): Changement[] | 'chargement' | 'erreur' | undefined {
    return this.details()[this.cle(e)];
  }

  valeur(v: string | null): string {
    return v === null || v === '' ? '—' : v;
  }

  formatDate(iso: string): string {
    return new Intl.DateTimeFormat(localeCourante(), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  }

  libelleAction(action: AuditEntry['action']): string {
    return this.i18n.t('audit.action.' + action);
  }
}
