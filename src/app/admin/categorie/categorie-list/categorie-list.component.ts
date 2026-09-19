import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { CatalogueService } from 'src/app/theme/shared/service/catalogue.service';
import { CategorieResponse } from 'src/app/theme/shared/service/catalogue.model';
import { CategorieFormComponent } from '../categorie-form/categorie-form.component';

@Component({
  selector: 'app-categorie-list',
  imports: [CommonModule],
  templateUrl: './categorie-list.component.html',
  styleUrl: './categorie-list.component.scss'
})
export class CategorieListComponent implements OnInit {
  private catalogue = inject(CatalogueService);
  private modalService = inject(NgbModal);

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

  openCreate(): void {
    const ref = this.modalService.open(CategorieFormComponent, { centered: true });
    ref.result.then(
      (result) => {
        if (result === 'saved') this.load();
      },
      () => {}
    );
  }

  openEdit(categorie: CategorieResponse): void {
    const ref = this.modalService.open(CategorieFormComponent, { centered: true });
    ref.componentInstance.categorieId = categorie.id;
    ref.result.then(
      (result) => {
        if (result === 'saved') this.load();
      },
      () => {}
    );
  }

  remove(categorie: CategorieResponse): void {
    if (!confirm(`Supprimer la categorie "${categorie.libelle}" ?`)) {
      return;
    }
    this.catalogue.deleteCategorie(categorie.id).subscribe(() => this.load());
  }
}
