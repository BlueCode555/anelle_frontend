import { AfterViewInit, Component, ElementRef, OnDestroy, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

import { AuthService } from '../../theme/shared/service/auth.service';
import { InformationService } from '../../theme/shared/service/information.service';
import { ConfirmationService } from 'src/app/theme/shared/service/confirmation.service';
import { PanierService } from 'src/app/theme/shared/service/panier.service';
import { TranslationService } from 'src/app/theme/shared/service/i18n/translation.service';
import { TranslatePipe } from 'src/app/theme/shared/_helpers/translate.pipe';
import { LangSwitcherComponent } from 'src/app/theme/shared/component/lang-switcher/lang-switcher.component';

@Component({
  selector: 'app-site-header',
  imports: [RouterModule, TranslatePipe, LangSwitcherComponent],
  templateUrl: './site-header.component.html',
  styleUrl: './site-header.component.scss'
})
export class SiteHeaderComponent implements AfterViewInit, OnDestroy {
  auth = inject(AuthService);
  private informations = inject(InformationService);
  private confirmation = inject(ConfirmationService);
  private i18n = inject(TranslationService);
  panier = inject(PanierService);
  private router = inject(Router);
  private location = inject(Location);
  private hote = inject<ElementRef<HTMLElement>>(ElementRef);
  private observateur: ResizeObserver | null = null;

  nom = this.informations.nom;
  menuOpen = signal(false);
  // La photo Google est parfois refusee (limite de requetes) : on retombe sur l'initiale.
  photoErreur = signal(false);

  constructor() {
    this.informations.ensureLoaded();
  }

  // Publie la hauteur reelle de l'en-tete dans --ar-header-h : l'accueil s'en sert pour que la zone d'accueil (hero)
  // remplisse exactement l'ecran sous l'en-tete, quelle que soit la taille de la fenetre (aucune bande de la section
  // suivante ne depasse en bas). La valeur suit le redimensionnement (telephone, zoom, retour a la ligne du menu).
  ngAfterViewInit(): void {
    const entete = this.hote.nativeElement.querySelector<HTMLElement>('.site-header');
    if (!entete) return;
    const publier = () => document.documentElement.style.setProperty('--ar-header-h', `${entete.offsetHeight}px`);
    publier();
    if (typeof ResizeObserver !== 'undefined') {
      this.observateur = new ResizeObserver(publier);
      this.observateur.observe(entete);
    }
  }

  ngOnDestroy(): void {
    this.observateur?.disconnect();
    document.documentElement.style.removeProperty('--ar-header-h');
  }

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  // « Accueil » : déjà sur l'accueil, on remonte en douceur tout en haut (sans passer par une ancre, qui provoquait
  // des sauts de défilement) ; ailleurs, la navigation normale ramène en haut de l'accueil.
  accueil(event: Event): void {
    this.closeMenu();
    if (this.router.url.split(/[?#]/)[0] === '/accueil') {
      event.preventDefault();
      if (this.router.url.includes('#')) {
        this.location.replaceState('/accueil');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  async logout(): Promise<void> {
    this.closeMenu();
    const ok = await this.confirmation.demander({
      titre: this.i18n.t('header.confirmerDeconnexion.titre'),
      texteConfirmer: this.i18n.t('header.confirmerDeconnexion.bouton'),
      danger: true,
      icone: 'ti-logout-2'
    });
    if (ok) {
      this.auth.logout();
    }
  }
}
