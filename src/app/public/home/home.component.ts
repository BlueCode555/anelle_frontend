import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { NgbCarouselModule } from '@ng-bootstrap/ng-bootstrap';

import { SiteHeaderComponent } from '../site-header/site-header.component';
import { CatalogueService } from '../../theme/shared/service/catalogue.service';
import { CategorieResponse, ServiceResponse } from '../../theme/shared/service/catalogue.model';
import { InformationService, JOURS_SEMAINE } from '../../theme/shared/service/information.service';

interface GalleryImage {
  src: string;
  alt: string;
  caption: string;
}

interface HoraireLigne {
  jour: string;
  libelle: string;
}

// Photos libres de droits (licence Pexels), chargees depuis leur lien en ligne : rien n'est stocke chez nous.
const pexels = (id: number, width: number): string =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${width}`;

@Component({
  selector: 'app-home',
  imports: [CommonModule, RouterModule, NgbCarouselModule, SiteHeaderComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  private catalogue = inject(CatalogueService);
  private informations = inject(InformationService);
  private title = inject(Title);

  readonly heroImage = pexels(4672653, 1000);

  info = this.informations.info;
  nom = this.informations.nom;

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

  // Adresse sur deux lignes : rue, puis ville / province / code postal / pays (seulement ce qui est renseigne).
  adresseLignes = computed(() => {
    const i = this.info();
    if (!i) return [];
    const ville = [i.ville, i.province, i.codePostal].filter((v) => !!v).join(', ');
    return [i.adresse, ville, i.pays].filter((l): l is string => !!l);
  });

  aDesCoordonnees = computed(() => {
    const i = this.info();
    return !!i && (this.adresseLignes().length > 0 || !!i.telephone || !!i.email);
  });

  // Les horaires n'apparaissent que si au moins un jour est ouvert.
  horaires = computed<HoraireLigne[]>(() => {
    const jours = this.info()?.horaires ?? [];
    if (!jours.some((h) => h.ouvert)) return [];
    return jours.map((h) => ({
      jour: JOURS_SEMAINE[h.jourSemaine - 1],
      libelle: h.ouvert && h.heureDebut && h.heureFin ? `${this.heure(h.heureDebut)} – ${this.heure(h.heureFin)}` : 'Fermé'
    }));
  });

  constructor() {
    effect(() => this.title.setTitle(this.nom()));
  }

  ngOnInit(): void {
    this.informations.ensureLoaded();

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

  // "09:30" -> "9 h 30", "19:00" -> "19 h"
  private heure(hhmm: string): string {
    const [h, m] = hhmm.split(':').map(Number);
    return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
  }

  private readonly categoryIcons: Record<string, string> = {
    PEDICURE: 'ti-shoe',
    MANUCURE: 'ti-hand-stop',
    SOINS_CORPS: 'ti-massage'
  };

  serviceImage(service: ServiceResponse): string | null {
    return this.catalogue.imageSrc(service.imageUrl);
  }

  categoryIcon(categorieCode: string): string {
    return this.categoryIcons[categorieCode] ?? 'ti-sparkles';
  }

  // Images par defaut du carrousel, utilisees tant qu'aucune categorie/service n'a d'image (ou si l'API est injoignable).
  private readonly defaultGallery: GalleryImage[] = [
    { src: pexels(35884502, 1600), alt: 'Cabine de soins avec serviette roulée et bougie', caption: 'Notre espace de soins' },
    { src: pexels(3738349, 1600), alt: 'Soin du visage par une esthéticienne', caption: 'Soins du visage' },
    { src: pexels(15491629, 1600), alt: 'Mains avec une manucure élégante', caption: 'Manucure' },
    { src: pexels(19695948, 1600), alt: 'Bain de pieds aux sels', caption: 'Pédicure' },
    { src: pexels(18120174, 1600), alt: 'Massage relaxant en cabine', caption: 'Soins du corps' }
  ];

  // Le carrousel affiche les images des categories puis des services actifs (fichier envoye ou lien en ligne).
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
