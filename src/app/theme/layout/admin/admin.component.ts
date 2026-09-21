import { Component, HostListener, OnInit, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';

import { NavigationItem, NavigationItems } from './navigation/navigation';
import { ChangerProfilComponent } from './changer-profil/changer-profil.component';
import { AuthService } from '../../shared/service/auth.service';
import { ConfirmationService } from '../../shared/service/confirmation.service';
import { ToastService } from '../../shared/service/toast.service';
import { InformationService } from '../../shared/service/information.service';
import { RendezVousService } from '../../shared/service/rendez-vous.service';
import { ajouterJours, aujourdhui } from '../../shared/_helpers/zoned-time';

interface Miette {
  libelle: string;
  url?: string;
}

const COLLAPSE_KEY = 'arnelle.nav.collapsed';

// Coque du back-office : menu latéral repliable, barre du haut (fil d'Ariane, notifications, profil), contenu, pied de page.
@Component({
  selector: 'app-admin',
  imports: [CommonModule, RouterModule],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss'
})
export class AdminComponent implements OnInit {
  private router = inject(Router);
  private informations = inject(InformationService);
  private rendezVous = inject(RendezVousService);
  auth = inject(AuthService);
  private confirmation = inject(ConfirmationService);
  private modals = inject(NgbModal);
  toast = inject(ToastService);

  collapsed = signal(this.lireRepli());
  mobileOpen = signal(false);
  profilOuvert = signal(false);
  url = signal(this.router.url);
  // La section Administration est dépliée par défaut ; les autres s'ouvrent quand la page courante s'y trouve.
  ouverts = signal<string[]>(['administration']);
  demandes = signal(0);

  aujourdhuiTexte = new Intl.DateTimeFormat('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  // Menu filtré selon les droits (les sections vides disparaissent)
  menu = computed(() => this.filtrer(NavigationItems));

  nomAffiche = computed(() => (this.auth.user() ? this.auth.displayName() : 'Espace de gestion'));
  initiale = computed(() => this.nomAffiche().charAt(0).toUpperCase());
  role = computed(() => {
    const u = this.auth.user();
    if (!u) return 'Gestion';
    // Le collaborateur voit le nom du profil avec lequel il travaille en ce moment
    return u.superAdmin ? 'Esthéticienne' : (this.auth.profilActif()?.libelle ?? 'Collaborateur');
  });

  fil = computed<Miette[]>(() => {
    const courant = this.url().split(/[?#]/)[0];
    const fil: Miette[] = [{ libelle: 'Accueil', url: '/default' }];
    for (const item of NavigationItems) {
      if (item.url === courant) {
        if (courant !== '/default') fil.push({ libelle: item.title });
        return fil;
      }
      const enfant = item.children?.find((c) => c.url === courant);
      if (enfant) {
        fil.push({ libelle: item.title }, { libelle: enfant.title });
        return fil;
      }
    }
    return fil;
  });

  constructor() {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd), takeUntilDestroyed()).subscribe(() => {
      this.url.set(this.router.url);
      this.mobileOpen.set(false);
      this.profilOuvert.set(false);
      this.ouvrirSectionActive();
      this.chargerDemandes();
    });
    // Les demandes à traiter dépendent du fuseau de l'institut, connu une fois ses informations chargées.
    effect(() => {
      this.informations.info();
      this.chargerDemandes();
    });
  }

  ngOnInit(): void {
    this.informations.ensureLoaded();
    this.ouvrirSectionActive();
  }

  basculerMenu(): void {
    if (window.innerWidth < 992) {
      this.mobileOpen.update((v) => !v);
      return;
    }
    const valeur = !this.collapsed();
    this.collapsed.set(valeur);
    try {
      localStorage.setItem(COLLAPSE_KEY, valeur ? '1' : '0');
    } catch {
      // stockage indisponible (navigation privée) : le repli n'est simplement pas mémorisé
    }
  }

  fermerMobile(): void {
    this.mobileOpen.set(false);
  }

  basculerSection(id: string): void {
    // Un clic sur une section alors que le menu est replié le déplie d'abord.
    if (this.collapsed() && window.innerWidth >= 992) {
      this.collapsed.set(false);
    }
    this.ouverts.update((liste) => (liste.includes(id) ? liste.filter((x) => x !== id) : [...liste, id]));
  }

  estOuverte(id: string): boolean {
    return this.ouverts().includes(id);
  }

  estActif(url?: string): boolean {
    if (!url) return false;
    const courant = this.url().split(/[?#]/)[0];
    return courant === url || courant.startsWith(url + '/');
  }

  sectionActive(item: NavigationItem): boolean {
    return !!item.children?.some((c) => this.estActif(c.url));
  }

  basculerProfil(event: Event): void {
    event.stopPropagation();
    this.profilOuvert.update((v) => !v);
  }

  // « Changer de profil » : ouvre le choix parmi les profils du collaborateur, puis revient au tableau de bord.
  changerProfil(): void {
    this.profilOuvert.set(false);
    const ref = this.modals.open(ChangerProfilComponent, { centered: true });
    ref.result.then(
      () => this.router.navigate(['/default']),
      () => {}
    );
  }

  async deconnexion(): Promise<void> {
    const ok = await this.confirmation.demander({
      titre: 'Se déconnecter ?',
      message: "Vous allez quitter l'espace de gestion.",
      texteConfirmer: 'Se déconnecter',
      danger: true,
      icone: 'ti-logout-2'
    });
    if (ok) {
      this.auth.logout();
    }
  }

  @HostListener('document:click')
  fermerProfil(): void {
    this.profilOuvert.set(false);
  }

  @HostListener('document:keydown.escape')
  echap(): void {
    this.profilOuvert.set(false);
    this.mobileOpen.set(false);
  }

  private ouvrirSectionActive(): void {
    for (const item of NavigationItems) {
      if (item.type === 'collapse' && this.sectionActive(item) && !this.estOuverte(item.id)) {
        this.ouverts.update((liste) => [...liste, item.id]);
      }
    }
  }

  private filtrer(items: NavigationItem[]): NavigationItem[] {
    const visibles: NavigationItem[] = [];
    for (const item of items) {
      if (item.proprietaire && !this.auth.estProprietaire()) continue;
      if (item.ecran && !this.auth.peut(item.ecran)) continue;
      if (item.children) {
        const enfants = this.filtrer(item.children);
        if (enfants.length === 0) continue;
        visibles.push({ ...item, children: enfants });
      } else {
        visibles.push(item);
      }
    }
    return visibles;
  }

  // Cloche : demandes de rendez-vous en attente sur les 30 prochains jours (ignoré si l'agenda est inaccessible).
  private chargerDemandes(): void {
    if (!this.auth.peut('AGENDA')) {
      this.demandes.set(0);
      return;
    }
    const zone = this.informations.info()?.fuseauHoraire ?? 'America/Toronto';
    const debut = aujourdhui(zone);
    this.rendezVous.agenda(debut, ajouterJours(debut, 30)).subscribe({
      next: (liste) => this.demandes.set(liste.filter((r) => r.statut === 'DEMANDE').length),
      error: () => this.demandes.set(0)
    });
  }

  private lireRepli(): boolean {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  }
}
