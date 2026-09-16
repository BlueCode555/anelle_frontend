import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { CatalogueService } from '../../theme/shared/service/catalogue.service';
import { CategorieResponse, ServiceResponse } from '../../theme/shared/service/catalogue.model';

@Component({
  selector: 'app-home',
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  private catalogue = inject(CatalogueService);

  categories = signal<CategorieResponse[]>([]);
  services = signal<ServiceResponse[]>([]);
  loading = signal(true);
  error = signal(false);
  activeCategory = signal<string | null>(null);

  filteredServices = computed(() => {
    const code = this.activeCategory();
    const actifs = this.services().filter((s) => s.actif);
    return code ? actifs.filter((s) => s.categorieCode === code) : actifs;
  });

  ngOnInit(): void {
    this.catalogue.listCategories().subscribe({
      next: (page) => this.categories.set(page.content),
      error: () => this.error.set(true)
    });

    this.catalogue.listServices().subscribe({
      next: (page) => {
        this.services.set(page.content);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      }
    });
  }

  currentYear = new Date().getFullYear();

  selectCategory(code: string | null): void {
    this.activeCategory.set(code);
  }

  formatTarif(tarif: number): string {
    return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(tarif);
  }
}
