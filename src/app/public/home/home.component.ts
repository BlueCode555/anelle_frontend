import { localeCourante } from 'src/app/theme/shared/_helpers/zoned-time';
import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { NgbCarouselModule } from '@ng-bootstrap/ng-bootstrap';

import { SiteHeaderComponent } from '../site-header/site-header.component';
import { CatalogueService } from '../../theme/shared/service/catalogue.service';
import { CategorieResponse, ServiceResponse } from '../../theme/shared/service/catalogue.model';
import { TranslationService } from '../../theme/shared/service/i18n/translation.service';
import { InformationService } from '../../theme/shared/service/information.service';
import { TranslatePipe } from 'src/app/theme/shared/_helpers/translate.pipe';

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
  imports: [CommonModule, RouterModule, NgbCarouselModule, SiteHeaderComponent, TranslatePipe],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {
  // Filet de sécurité : certains navigateurs/SPA "manquent" l'autoplay déclaratif d'une vidéo insérée
  // dynamiquement (ex. via @if) ; un appel explicite à .play() une fois la vue prête rattrape ce cas. Sans
  // effet si la vidéo n'est pas affichée (mobile / mouvement réduit) ou si l'autoplay a déjà démarré seul.
  @ViewChild('heroVideo') private heroVideoRef?: ElementRef<HTMLVideoElement>;
  private catalogue = inject(CatalogueService);
  private informations = inject(InformationService);
  private title = inject(Title);
  private i18n = inject(TranslationService);

  // Photo d'accueil (repli tant que la vidéo n'a pas chargé, et affichée seule sur mobile / mouvement réduit /
  // si la vidéo échoue a charger).
  readonly heroImage = pexels(5938648, 1600);
  // Vidéo de fond du hero : massage en institut, en rapport avec l'activité. Hébergée par Pexels (licence
  // libre), comme les autres visuels du site. Volontairement courte et légère (~5 Mo, 8 s en boucle) pour
  // demarrer vite et ne jamais accrocher/bufferer en pleine lecture.
  readonly heroVideoSrc = 'https://videos.pexels.com/video-files/6750874/6750874-hd_1920_1080_25fps.mp4';
  // Vrai si la vidéo a échoué à charger (réseau, format...) : on revient alors silencieusement à la photo fixe.
  videoErreur = signal(false);

  info = this.informations.info;
  nom = this.informations.nom;

  categories = signal<CategorieResponse[]>([]);
  services = signal<ServiceResponse[]>([]);
  loading = signal(true);
  error = signal(false);
  activeCategory = signal<string | null>(null);

  // Carrousel des catégories : 3 cartes par page sur mobile, 6 sur bureau (2 rangées de 3).
  private ecranEtroit = window.matchMedia('(max-width: 767.98px)');
  private ecouteurEcran = (e: MediaQueryListEvent) => this.itemsParPage.set(e.matches ? 3 : 6);
  itemsParPage = signal(this.ecranEtroit.matches ? 3 : 6);

  // Vidéo du hero seulement sur grand écran (poids de la vidéo, data mobile) et si la personne n'a pas
  // demandé moins de mouvement à l'écran ; sinon la photo statique suffit comme fond.
  videoActif = !window.matchMedia('(max-width: 767.98px)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  categorieSlides = computed(() => {
    const parPage = this.itemsParPage();
    const cats = this.categories();
    const pages: CategorieResponse[][] = [];
    for (let i = 0; i < cats.length; i += parPage) {
      pages.push(cats.slice(i, i + parPage));
    }
    return pages;
  });

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
      jour: this.i18n.t('jour.' + h.jourSemaine),
      libelle: h.ouvert && h.heureDebut && h.heureFin ? `${this.heure(h.heureDebut)} – ${this.heure(h.heureFin)}` : this.i18n.t('home.ferme')
    }));
  });

  constructor() {
    effect(() => this.title.setTitle(this.nom()));
    this.ecranEtroit.addEventListener('change', this.ecouteurEcran);
  }

  ngOnDestroy(): void {
    this.ecranEtroit.removeEventListener('change', this.ecouteurEcran);
  }

  ngAfterViewInit(): void {
    this.heroVideoRef?.nativeElement.play().catch(() => {
      // Autoplay refusé par le navigateur (rare pour une vidéo muette) : le poster reste affiché, sans erreur visible.
    });
  }

  // Echec de chargement de la vidéo (réseau, format non supporté...) : jamais de cadre cassé ou figé a l'écran,
  // on repasse simplement sur la photo fixe.
  onVideoErreur(): void {
    this.videoErreur.set(true);
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

  // Choix depuis le carrousel de catégories : filtre puis amène la personne directement sur les services.
  choisirCategorie(code: string): void {
    this.activeCategory.set(code);
    document.getElementById('services')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  categorieImage(cat: CategorieResponse): string | null {
    return this.catalogue.imageSrc(cat.imageUrl ?? null);
  }

  formatTarif(tarif: number): string {
    return new Intl.NumberFormat(localeCourante(), { style: 'currency', currency: 'CAD' }).format(tarif);
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

  // Images par defaut du carrousel (clientes claires et foncees representees), utilisees tant qu'aucune
  // categorie/service n'a d'image (ou si l'API est injoignable).
  private defaultGallery(): GalleryImage[] {
    const t = (k: string) => this.i18n.t(k);
    return [
    { src: pexels(6945567, 1600), alt: t('home.gallery.espace.alt'), caption: t('home.gallery.espace') },
    { src: pexels(3738349, 1600), alt: t('home.gallery.visage.alt'), caption: t('home.gallery.visage') },
    { src: pexels(7755296, 1600), alt: t('home.gallery.manucure.alt'), caption: t('home.gallery.manucure') },
    { src: pexels(8312896, 1600), alt: t('home.gallery.pedicure.alt'), caption: t('home.gallery.pedicure') },
    { src: pexels(6186764, 1600), alt: t('home.gallery.corps.alt'), caption: t('home.gallery.corps') }
    ];
  }

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
    return dynamic.length ? dynamic : this.defaultGallery();
  });
}
