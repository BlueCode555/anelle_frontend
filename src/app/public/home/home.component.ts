import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbCarouselModule } from '@ng-bootstrap/ng-bootstrap';

import { CatalogueService } from '../../theme/shared/service/catalogue.service';
import { CategorieResponse, ServiceResponse } from '../../theme/shared/service/catalogue.model';

interface GalleryImage {
  src: string;
  alt: string;
  caption: string;
}

@Component({
  selector: 'app-home',
  imports: [CommonModule, NgbCarouselModule],
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

  private readonly categoryIcons: Record<string, string> = {
    PEDICURE: 'ti-shoe',
    MANUCURE: 'ti-hand-stop',
    SOINS_CORPS: 'ti-massage'
  };

  categoryIcon(categorieCode: string): string {
    return this.categoryIcons[categorieCode] ?? 'ti-sparkles';
  }

  // Images par defaut, utilisees tant qu'aucune categorie/service n'a d'image (ou si l'API est injoignable).
  // TODO: remplacer par les vraies photos d'Arnelle Institut.
  private readonly defaultGallery: GalleryImage[] = [
    { src: 'assets/images/home/soin-visage.jpg', alt: 'Soin du visage chez Arnelle Institut', caption: 'Soins du visage' },
    { src: 'assets/images/home/manucure.jpg', alt: 'Manucure chez Arnelle Institut', caption: 'Manucure' },
    { src: 'assets/images/home/hero-portrait.jpg', alt: 'Ambiance Arnelle Institut', caption: "L'experience Arnelle" }
  ];

  // Le carrousel affiche les images envoyees depuis le back-office (categories puis services actifs).
  galleryImages = computed<GalleryImage[]>(() => {
    if (this.loading()) {
      return [];
    }
    const fromCategories = this.categories()
      .filter((c) => !!c.imageUrl)
      .map((c) => ({ src: this.catalogue.imageSrc(c.imageUrl) as string, alt: c.libelle, caption: c.libelle }));
    const fromServices = this.services()
      .filter((s) => s.actif && !!s.imageUrl)
      .map((s) => ({ src: this.catalogue.imageSrc(s.imageUrl) as string, alt: s.nomService, caption: s.nomService }));
    const dynamic = [...fromCategories, ...fromServices];
    return dynamic.length ? dynamic : this.defaultGallery;
  });
}
