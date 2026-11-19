import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AuditDiffChamp, AuditEntry, AuditService } from 'src/app/theme/shared/service/audit.service';
import { TranslatePipe } from 'src/app/theme/shared/_helpers/translate.pipe';
import { TranslationService } from 'src/app/theme/shared/service/i18n/translation.service';
import { localeCourante } from 'src/app/theme/shared/_helpers/zoned-time';
import { AuditConnexionsComponent } from '../audit-connexions/audit-connexions.component';
import { PaginationComponent } from 'src/app/theme/shared/components/pagination/pagination.component';

// Journal d'audit : qui a créé, modifié ou supprimé quoi, et quand (schéma "audit", purgé après 3 ans
// automatiquement côté serveur). Pagination côté serveur (le journal peut devenir volumineux).
@Component({
  selector: 'app-audit-list',
  imports: [CommonModule, TranslatePipe, PaginationComponent, AuditConnexionsComponent],
  templateUrl: './audit-list.component.html',
  styleUrl: './audit-list.component.scss'
})
export class AuditListComponent {
  private i18n = inject(TranslationService);
  private audit = inject(AuditService);

  readonly taille = 20;
  page = signal(1);
  onglet = signal<'donnees' | 'connexions'>('donnees');

  entrees = signal<AuditEntry[]>([]);
  totalElements = signal(0);
  loading = signal(true);
  error = signal(false);

  // Filtres (OBS-15) : la saisie libre est appliquee apres une courte pause pour ne pas interroger le serveur a chaque touche.
  readonly types = ['Client', 'Collaborateur', 'Commande', 'Rendez-vous', 'Service', 'Produit', 'Categorie', 'Rayon', 'Profil', "Informations de l'institut"];
  recherche = signal('');
  readonly actions: AuditEntry['action'][] = ['CREATION', 'MODIFICATION', 'SUPPRESSION'];
  type = signal('');
  action = signal('');
  du = signal('');
  au = signal('');
  auteur = signal('');
  private rechercheAppliquee = signal('');
  private auteurApplique = signal('');
  private minuteur: ReturnType<typeof setTimeout> | null = null;
  private minuteurAuteur: ReturnType<typeof setTimeout> | null = null;

  private recharger = effect(() => {
    this.charger(this.page(), this.rechercheAppliquee(), this.type(), this.du(), this.au(), this.auteurApplique(), this.action());
  });

  saisirAuteur(valeur: string): void {
    this.auteur.set(valeur);
    if (this.minuteurAuteur) clearTimeout(this.minuteurAuteur);
    this.minuteurAuteur = setTimeout(() => {
      this.page.set(1);
      this.auteurApplique.set(valeur.trim());
    }, 350);
  }

  saisirRecherche(valeur: string): void {
    this.recherche.set(valeur);
    if (this.minuteur) clearTimeout(this.minuteur);
    this.minuteur = setTimeout(() => {
      this.page.set(1);
      this.rechercheAppliquee.set(valeur.trim());
    }, 350);
  }

  changerFiltre(cible: 'type' | 'action' | 'du' | 'au', valeur: string): void {
    this.page.set(1);
    this[cible].set(valeur);
  }

  get filtreActif(): boolean {
    return !!(this.recherche() || this.auteur() || this.type() || this.action() || this.du() || this.au());
  }

  reinitialiser(): void {
    if (this.minuteur) clearTimeout(this.minuteur);
    this.page.set(1);
    this.recherche.set('');
    this.rechercheAppliquee.set('');
    if (this.minuteurAuteur) clearTimeout(this.minuteurAuteur);
    this.auteur.set('');
    this.auteurApplique.set('');
    this.type.set('');
    this.action.set('');
    this.du.set('');
    this.au.set('');
  }

  readonly actionClasses: Record<AuditEntry['action'], string> = {
    CREATION: 'text-bg-success',
    MODIFICATION: 'text-bg-warning',
    SUPPRESSION: 'text-bg-danger',
    CONNEXION: 'text-bg-info',
    DECONNEXION: 'text-bg-secondary'
  };

  // Detail (avant/apres) d'une ligne, charge a la demande au clic ; une seule ligne ouverte a la fois.
  ligneOuverte = signal<AuditEntry | null>(null);
  detail = signal<AuditDiffChamp[]>([]);
  detailChargement = signal(false);

  basculerDetail(entree: AuditEntry): void {
    if (this.ligneOuverte() === entree) {
      this.ligneOuverte.set(null);
      return;
    }
    this.ligneOuverte.set(entree);
    this.detail.set([]);
    this.detailChargement.set(true);
    this.audit.detail(entree).subscribe({
      next: (champs) => {
        this.detail.set(champs);
        this.detailChargement.set(false);
      },
      error: () => this.detailChargement.set(false)
    });
  }

  private charger(page: number, q: string, type: string, du: string, au: string, auteur: string, action: string): void {
    this.loading.set(true);
    this.error.set(false);
    this.audit.list({ page, size: this.taille, q: q || undefined, type: type || undefined, du: du || undefined, au: au || undefined, auteur: auteur || undefined, action: action || undefined }).subscribe({
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
