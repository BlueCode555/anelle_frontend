import { localeCourante } from 'src/app/theme/shared/_helpers/zoned-time';
import { Component, HostListener, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';

import { LangSwitcherComponent } from 'src/app/theme/shared/component/lang-switcher/lang-switcher.component';
import { TranslatePipe } from 'src/app/theme/shared/_helpers/translate.pipe';
import { TranslationService } from 'src/app/theme/shared/service/i18n/translation.service';
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
import { RendezVous, RendezVousService } from '../../shared/service/rendez-vous.service';
import { CommandeService } from '../../shared/service/boutique.service';
import { ThemeService } from '../../shared/service/theme.service';
import { ajouterJours, aujourdhui } from '../../shared/_helpers/zoned-time';

interface Miette {
  libelle: string;
  url?: string;
}

const COLLAPSE_KEY = 'arnelle.nav.collapsed';
const NOTIFS_LUES_KEY = 'arnelle.notifs.lues';

// Une ligne du panneau de la cloche : une demande de rendez-vous en attente ou une commande payee a preparer.
export interface Notification {
  id: string;
  type: 'rdv' | 'commande';
  titre: string;
  sous: string;
  date: string;
  url: string;
}

// Coque du back-office : menu latéral repliable, barre du haut (fil d'Ariane, notifications, profil), contenu, pied de page.
@Component({
  selector: 'app-admin',
  imports: [RouterModule, TranslatePipe, LangSwitcherComponent],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss'
})
export class AdminComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private i18n = inject(TranslationService);
  private informations = inject(InformationService);
  nom = this.informations.nom;
  private rendezVous = inject(RendezVousService);
  private commandes = inject(CommandeService);
  auth = inject(AuthService);
  private confirmation = inject(ConfirmationService);
  private modals = inject(NgbModal);
  toast = inject(ToastService);
  theme = inject(ThemeService);

  collapsed = signal(this.lireRepli());
  mobileOpen = signal(false);
  profilOuvert = signal(false);
  url = signal(this.router.url);
  // La section Administration est dépliée par défaut ; les autres s'ouvrent quand la page courante s'y trouve.
  ouverts = signal<string[]>(['administration']);
  demandes = signal(0);

  // Cloche : panneau des notifications recentes (demandes de rendez-vous, commandes a preparer), marquables comme lues.
  notifsOuvertes = signal(false);
  private demandesListe = signal<RendezVous[]>([]);
  private commandesAPreparer = signal<Notification[]>([]);
  private lues = signal<string[]>(this.lireLues());
  notifications = computed<Notification[]>(() => {
    const rdvs: Notification[] = this.demandesListe().map((r) => ({
      id: 'rdv:' + r.code,
      type: 'rdv',
      titre: r.libelleServices,
      sous: r.clientNom ?? '',
      date: r.debut,
      url: '/agenda'
    }));
    return [...rdvs, ...this.commandesAPreparer()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
  });
  nonLues = computed(() => this.notifications().filter((n) => !this.lues().includes(n.id)).length);

  aujourdhuiTexte = computed(() => {
    this.i18n.langue();
    return new Intl.DateTimeFormat(localeCourante(), { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  });

  // Menu filtré selon les droits (les sections vides disparaissent)
  menu = computed(() => this.filtrer(NavigationItems));

  nomAffiche = computed(() => (this.auth.user() ? this.auth.displayName() : this.i18n.t('admin.espaceGestion')));
  initiale = computed(() => this.nomAffiche().charAt(0).toUpperCase());
  role = computed(() => {
    const u = this.auth.user();
    if (!u) return this.i18n.t('admin.role.gestion');
    // Le collaborateur voit le nom du profil avec lequel il travaille en ce moment
    return u.superAdmin
      ? this.i18n.t('admin.role.esthéticienne')
      : (this.auth.profilActif()?.libelle ?? this.i18n.t('admin.role.collaborateur'));
  });

  fil = computed<Miette[]>(() => {
    const courant = this.url().split(/[?#]/)[0];
    const fil: Miette[] = [{ libelle: this.i18n.t('admin.crumb.accueil'), url: '/default' }];
    for (const item of NavigationItems) {
      if (item.url === courant) {
        if (courant !== '/default') fil.push({ libelle: this.i18n.t('nav.' + item.id) });
        return fil;
      }
      const enfant = item.children?.find((c) => c.url === courant);
      if (enfant) {
        fil.push({ libelle: this.i18n.t('nav.' + item.id) }, { libelle: this.i18n.t('nav.' + enfant.id) });
        return fil;
      }
    }
    return fil;
  });

  constructor() {
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe(() => {
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
    // Le mode sombre est pose sur <body> (pas seulement .ad-shell) car les fenetres modales sont ajoutees
    // par ng-bootstrap en dehors de la coque : c'est le seul moyen de les faire passer sombres aussi.
    // Retire au OnDestroy pour ne jamais deborder sur le site public.
    effect(() => {
      document.body.setAttribute('data-theme', this.theme.sombre() ? 'dark' : 'light');
    });
  }

  ngOnInit(): void {
    this.informations.ensureLoaded();
    this.ouvrirSectionActive();
  }

  ngOnDestroy(): void {
    document.body.removeAttribute('data-theme');
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
    this.notifsOuvertes.set(false);
    this.profilOuvert.update((v) => !v);
  }

  // « Changer de profil » : ouvre le choix parmi les profils du collaborateur, puis revient au tableau de bord.
  changerProfil(): void {
    this.profilOuvert.set(false);
    const ref = this.modals.open(ChangerProfilComponent, { scrollable: true, centered: true });
    ref.result.then(
      () => this.router.navigate(['/default']),
      () => {}
    );
  }

  async deconnexion(): Promise<void> {
    const ok = await this.confirmation.demander({
      titre: this.i18n.t('header.confirmerDeconnexion.titre'),
      message: "Vous allez quitter l'espace de gestion.",
      texteConfirmer: this.i18n.t('header.confirmerDeconnexion.bouton'),
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
    this.notifsOuvertes.set(false);
  }

  @HostListener('document:keydown.escape')
  echap(): void {
    this.profilOuvert.set(false);
    this.notifsOuvertes.set(false);
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
      next: (liste) => {
        const demandes = liste.filter((r) => r.statut === 'DEMANDE');
        this.demandes.set(demandes.length);
        this.demandesListe.set(demandes);
      },
      error: () => {
        this.demandes.set(0);
        this.demandesListe.set([]);
      }
    });
    this.chargerCommandes();
  }

  // Commandes payees a preparer (uniquement pour un profil qui a acces a l'ecran Commandes).
  private chargerCommandes(): void {
    if (!this.auth.peut('COMMANDES')) {
      this.commandesAPreparer.set([]);
      return;
    }
    this.commandes.toutes().subscribe({
      next: (liste) =>
        this.commandesAPreparer.set(
          liste
            .filter((c) => c.statut === 'PAYEE')
            .map((c) => ({
              id: 'cmd:' + c.code,
              type: 'commande' as const,
              titre: c.lignes.map((l) => l.quantite + ' × ' + l.nom).join(', '),
              sous: c.clientNom,
              date: c.payeLe ?? c.creeLe,
              url: '/commandes'
            }))
        ),
      error: () => this.commandesAPreparer.set([])
    });
  }

  basculerNotifs(event: Event): void {
    event.stopPropagation();
    this.profilOuvert.set(false);
    this.notifsOuvertes.update((v) => !v);
  }

  estLue(n: Notification): boolean {
    return this.lues().includes(n.id);
  }

  toutMarquerLu(): void {
    this.lues.set(Array.from(new Set([...this.lues(), ...this.notifications().map((n) => n.id)])).slice(-200));
    try {
      localStorage.setItem(NOTIFS_LUES_KEY, JSON.stringify(this.lues()));
    } catch {
      // stockage indisponible : elles restent lues pour la session en cours.
    }
  }

  private lireLues(): string[] {
    try {
      const brut = JSON.parse(localStorage.getItem(NOTIFS_LUES_KEY) ?? '[]');
      return Array.isArray(brut) ? brut.filter((x) => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }

  private lireRepli(): boolean {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  }
}
