// Angular Import
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

// project import
import { CatalogueService } from 'src/app/theme/shared/service/catalogue.service';
import { CategorieResponse, ServiceResponse } from 'src/app/theme/shared/service/catalogue.model';

interface CategoryStat {
  libelle: string;
  count: number;
  percent: number;
}

@Component({
  selector: 'app-default',
  imports: [CommonModule, RouterModule],
  templateUrl: './default.component.html',
  styleUrl: './default.component.scss'
})
export class DefaultComponent implements OnInit {
  private catalogue = inject(CatalogueService);

  categories = signal<CategorieResponse[]>([]);
  services = signal<ServiceResponse[]>([]);
  loading = signal(true);
  error = signal(false);

  activeServices = computed(() => this.services().filter((s) => s.actif));

  averagePrice = computed(() => {
    const list = this.activeServices();
    if (!list.length) return 0;
    return list.reduce((sum, s) => sum + s.tarif, 0) / list.length;
  });

  averageDuration = computed(() => {
    const list = this.activeServices();
    if (!list.length) return 0;
    return Math.round(list.reduce((sum, s) => sum + s.dureeMinutes, 0) / list.length);
  });

  categoryStats = computed<CategoryStat[]>(() => {
    const services = this.services();
    const max = Math.max(1, ...this.categories().map((c) => services.filter((s) => s.categorieCode === c.code).length));
    return this.categories().map((c) => {
      const count = services.filter((s) => s.categorieCode === c.code).length;
      return { libelle: c.libelle, count, percent: Math.round((count / max) * 100) };
    });
  });

  latestServices = computed(() => [...this.services()].sort((a, b) => b.id - a.id).slice(0, 5));

  today = new Date().toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

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

  formatTarif(tarif: number): string {
    return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(tarif);
  }
}
