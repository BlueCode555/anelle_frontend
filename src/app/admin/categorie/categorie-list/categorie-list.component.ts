import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { CatalogueService } from 'src/app/theme/shared/service/catalogue.service';
import { CategorieResponse } from 'src/app/theme/shared/service/catalogue.model';

@Component({
  selector: 'app-categorie-list',
  imports: [CommonModule, RouterModule],
  templateUrl: './categorie-list.component.html',
  styleUrl: './categorie-list.component.scss'
})
export class CategorieListComponent implements OnInit {
  private catalogue = inject(CatalogueService);

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

  remove(categorie: CategorieResponse): void {
    if (!confirm(`Supprimer la categorie "${categorie.libelle}" ?`)) {
      return;
    }
    this.catalogue.deleteCategorie(categorie.id).subscribe(() => this.load());
  }
}
