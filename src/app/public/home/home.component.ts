import { localeCourante } from 'src/app/theme/shared/_helpers/zoned-time';
import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
  viewChild
} from '@angular/core';

import { Title } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { NgbCarouselModule } from '@ng-bootstrap/ng-bootstrap';

import { SiteHeaderComponent } from '../site-header/site-header.component';
import { CatalogueService } from '../../theme/shared/service/catalogue.service';
import { CategorieResponse, ServiceResponse } from '../../theme/shared/service/catalogue.model';
import { TranslationService } from '../../theme/shared/service/i18n/translation.service';
import { InformationService } from '../../theme/shared/service/information.service';
import { PaginationComponent } from 'src/app/theme/shared/components/pagination/pagination.component';
import { DureePipe } from 'src/app/theme/shared/_helpers/duree.pipe';
import { TranslatePipe } from 'src/app/theme/shared/_helpers/translate.pipe';

interface GalleryImage {
  // Identifiant de l'image (ex. "c:CODE"), pour la masquer si elle ne charge pas ; absent pour les images par defaut.
  cle?: string;
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
  imports: [RouterModule, NgbCarouselModule, SiteHeaderComponent, TranslatePipe, DureePipe, PaginationComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit, AfterViewInit {
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
  // Retombe sur le texte francais si aucune traduction anglaise n'a ete saisie dans "Mon institut".
  slogan = computed(() => (this.i18n.langue() === 'en' ? this.info()?.sloganEn : null) || this.info()?.slogan);
  description = computed(() => (this.i18n.langue() === 'en' ? this.info()?.descriptionEn : null) || this.info()?.description);

  // Meme logique de repli pour les noms de services/categories (saisis par l'institut, pas des textes d'interface).
  nomService(s: ServiceResponse): string {
    return (this.i18n.langue() === 'en' ? s.nomServiceEn : null) || s.nomService;
  }

  libelleCategorie(c: CategorieResponse): string {
    return (this.i18n.langue() === 'en' ? c.libelleEn : null) || c.libelle;
  }

  libelleCategorieDuService(s: ServiceResponse): string {
    return (this.i18n.langue() === 'en' ? s.categorieLibelleEn : null) || s.categorieLibelle;
  }

  categories = signal<CategorieResponse[]>([]);
  services = signal<ServiceResponse[]>([]);
  loading = signal(true);
  error = signal(false);
  activeCategory = signal<string | null>(null);

  // Soins : 4 par page sur mobile (liste plus courte et plus rapide à parcourir au doigt), 9 sur bureau.
  private ecranEtroit = window.matchMedia('(max-width: 767.98px)');

  // Catégories : une seule rangée qui défile horizontalement. Les flèches font défiler d'environ un écran, se
  // désactivent aux extrémités et disparaissent si tout tient à l'écran (sur téléphone, on glisse au doigt).
  piste = viewChild<ElementRef<HTMLElement>>('piste');
  defilable = signal(false);
  peutReculer = signal(false);
  peutAvancer = signal(false);

  // Images qui n'ont pas pu charger (lien cassé, fichier supprime...) : remplacees par l'icone par defaut.
  private imagesEnErreur = signal<ReadonlySet<string>>(new Set());

  // Vidéo du hero sur tous les écrans (cohérent partout), sauf si la personne a demandé moins de mouvement
  // à l'écran (réglage d'accessibilité du système) ; sinon la photo statique suffit comme fond.
  videoActif = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Les soins s'affichent 9 par page (4 sur mobile) : au-delà, une pagination apparaît.
  pageServices = signal(1);
  tailleServices = signal(this.ecranEtroit.matches ? 4 : 9);
  servicesPagees = computed(() =>
    this.filteredServices().slice((this.pageServices() - 1) * this.tailleServices(), this.pageServices() * this.tailleServices())
  );

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
      libelle: h.ouvert
        ? h.plages.map((p) => `${this.heure(p.heureDebut)} – ${this.heure(p.heureFin)}`).join(', ')
        : this.i18n.t('home.ferme')
    }));
  });

  constructor() {
    effect(() => this.title.setTitle(this.nom()));
    // La rangée de catégories n'existe qu'après le chargement : on recalcule l'état des flèches dès qu'elle change.
    effect(() => {
      this.categories();
      if (this.piste()) {
        setTimeout(() => this.majDefilement());
      }
    });
  }

  // Soins par page : suit le passage mobile / bureau quand la fenetre est redimensionnee ou pivotee.
  @HostListener('window:resize')
  majTailleServices(): void {
    this.tailleServices.set(this.ecranEtroit.matches ? 4 : 9);
  }

  @HostListener('window:resize')
  majDefilement(): void {
    const el = this.piste()?.nativeElement;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    this.defilable.set(max > 1);
    this.peutReculer.set(el.scrollLeft > 1);
    this.peutAvancer.set(el.scrollLeft < max - 1);
  }

  defiler(sens: -1 | 1): void {
    const el = this.piste()?.nativeElement;
    el?.scrollBy({ left: sens * el.clientWidth * 0.9, behavior: 'smooth' });
  }

  marquerImageErreur(cle?: string): void {
    if (cle) this.imagesEnErreur.update((s) => new Set(s).add(cle));
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
      next: (page) => this.categories.set(page.content.filter((c) => c.actif !== false)),
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
    this.pageServices.set(1);
  }

  // Choix depuis le carrousel de catégories : filtre puis amène la personne directement sur les services.
  choisirCategorie(code: string): void {
    this.activeCategory.set(code);
    document.getElementById('services')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  categorieImage(cat: CategorieResponse): string | null {
    return this.imagesEnErreur().has('c:' + cat.code) ? null : this.catalogue.imageSrc(cat.imageUrl ?? null);
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
    return this.imagesEnErreur().has('s:' + service.code) ? null : this.catalogue.imageSrc(service.imageUrl);
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
    const erreurs = this.imagesEnErreur();
    const fromCategories = this.categories()
      .filter((c) => !!c.imageUrl && !erreurs.has('c:' + c.code))
      .map((c) => ({ cle: 'c:' + c.code, src: this.catalogue.imageSrc(c.imageUrl) as string, alt: c.libelle, caption: c.libelle }));
    const fromServices = this.services()
      .filter((s) => s.actif && !!s.imageUrl && !erreurs.has('s:' + s.code))
      .map((s) => ({ cle: 's:' + s.code, src: this.catalogue.imageSrc(s.imageUrl) as string, alt: s.nomService, caption: s.nomService }));
    const dynamic = [...fromCategories, ...fromServices];
    return dynamic.length ? dynamic : this.defaultGallery();
  });
}
