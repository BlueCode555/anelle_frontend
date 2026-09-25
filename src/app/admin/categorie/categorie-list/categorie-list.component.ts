import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { CatalogueService } from 'src/app/theme/shared/service/catalogue.service';
import { CategorieResponse } from 'src/app/theme/shared/service/catalogue.model';
import { CategorieFormComponent } from '../categorie-form/categorie-form.component';
import { ConfirmationService } from 'src/app/theme/shared/service/confirmation.service';
import { ToastService } from 'src/app/theme/shared/service/toast.service';
import { TranslatePipe } from 'src/app/theme/shared/_helpers/translate.pipe';
import { TranslationService } from 'src/app/theme/shared/service/i18n/translation.service';
import { PaginationComponent } from 'src/app/theme/shared/components/pagination/pagination.component';

@Component({
  selector: 'app-categorie-list',
  imports: [CommonModule, TranslatePipe, PaginationComponent],
  templateUrl: './categorie-list.component.html',
  styleUrl: './categorie-list.component.scss'
})
export class CategorieListComponent implements OnInit {
  page = signal(1);
  readonly taille = 10;
  pagees = computed(() => this.categories().slice((this.page() - 1) * this.taille, this.page() * this.taille));

  private retourPage1 = effect(() => {
    this.categories();
    this.page.set(1);
  });
  private i18n = inject(TranslationService);
  private catalogue = inject(CatalogueService);
  private modalService = inject(NgbModal);
  private confirmation = inject(ConfirmationService);
  private toast = inject(ToastService);

  categories = signal<CategorieResponse[]>([]);
  loading = signal(true);
  error = signal(false);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.catalogue.listCategories().subscribe({
      next: (page) => {
        this.categories.set(page.content);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      }
    });
  }

  imageSrc(url?: string | null): string | null {
    return this.catalogue.imageSrc(url);
  }

  // Un clic : affiche ou masque la categorie sur la page d'accueil (sans ouvrir le formulaire).
  basculer(c: CategorieResponse, event: Event): void {
    const actif = (event.target as HTMLInputElement).checked;
    this.catalogue
      .updateCategorie(c.id, { libelle: c.libelle, description: c.description ?? '', imageUrl: c.imageUrl ?? '', actif })
      .subscribe({
        next: () => {
          this.categories.update((l) => l.map((x) => (x.id === c.id ? { ...x, actif } : x)));
          this.toast.succes(this.i18n.t(actif ? 'toggle.affiche' : 'toggle.masque'));
        },
        error: (err) => {
          (event.target as HTMLInputElement).checked = !actif;
          this.toast.erreur(err?.error?.message ?? this.i18n.t('ts.erreurGenerique'));
        }
      });
  }

  openCreate(): void {
    const ref = this.modalService.open(CategorieFormComponent, { centered: true });
    ref.result.then(
      (result) => {
        if (result === 'saved') {
          this.toast.succes(this.i18n.t('ts.cat.enregistree'));
          this.load();
        }
      },
      () => {}
    );
  }

  openEdit(categorie: CategorieResponse): void {
    const ref = this.modalService.open(CategorieFormComponent, { centered: true });
    ref.componentInstance.categorieId = categorie.id;
    ref.result.then(
      (result) => {
        if (result === 'saved') {
          this.toast.succes(this.i18n.t('ts.cat.enregistree'));
          this.load();
        }
      },
      () => {}
    );
  }

  async remove(categorie: CategorieResponse): Promise<void> {
    const ok = await this.confirmation.demander({
      titre: this.i18n.t('ts.cat.supprimer', { nom: categorie.libelle }),
      message: this.i18n.t('ts.definitive'),
      texteConfirmer: this.i18n.t('ts.supprimer'),
      danger: true
    });
    if (!ok) {
      return;
    }
    this.catalogue.deleteCategorie(categorie.id).subscribe({
      next: () => {
        this.toast.succes(this.i18n.t('ts.cat.supprimee'));
        this.load();
      },
      error: (err) => this.toast.erreur(err?.error?.message ?? this.i18n.t('ts.suppressionImpossible'))
    });
  }
}
