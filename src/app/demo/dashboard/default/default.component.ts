// Angular Import
import { Component, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

// project import
import { CatalogueService } from 'src/app/theme/shared/service/catalogue.service';
import { CategorieResponse, ServiceResponse } from 'src/app/theme/shared/service/catalogue.model';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { InformationService } from 'src/app/theme/shared/service/information.service';
import { RendezVous, RendezVousService, STATUT_CLASSES, STATUT_LIBELLES } from 'src/app/theme/shared/service/rendez-vous.service';
import { ajouterJours, aujourdhui, cleJour, formatHeure, formatJourCourt } from 'src/app/theme/shared/_helpers/zoned-time';

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
  private rendezVous = inject(RendezVousService);
  private informations = inject(InformationService);
  auth = inject(AuthService);

  readonly libelles = STATUT_LIBELLES;
  readonly classes = STATUT_CLASSES;

  categories = signal<CategorieResponse[]>([]);
  services = signal<ServiceResponse[]>([]);
  agenda = signal<RendezVous[]>([]);
  agendaIndisponible = signal(false);
  loading = signal(true);
  error = signal(false);

  zone = computed(() => this.informations.info()?.fuseauHoraire ?? 'America/Toronto');

  // ── Rendez-vous des 7 prochains jours ──
  demandes = computed(() => this.agenda().filter((r) => r.statut === 'DEMANDE'));
  duJour = computed(() => {
    const jour = aujourdhui(this.zone());
    return this.agenda().filter((r) => ['ACCEPTE', 'CONFIRME'].includes(r.statut) && cleJour(r.debut, this.zone()) === jour);
  });
  confirmes = computed(() => this.agenda().filter((r) => r.statut === 'CONFIRME'));
  recettes = computed(() => this.confirmes().reduce((somme, r) => somme + r.prix, 0));
  prochains = computed(() =>
    this.agenda()
      .filter((r) => ['DEMANDE', 'ACCEPTE', 'CONFIRME'].includes(r.statut) && new Date(r.fin).getTime() > Date.now())
      .sort((a, b) => a.debut.localeCompare(b.debut))
      .slice(0, 6)
  );

  // ── Catalogue ──
  activeServices = computed(() => this.services().filter((s) => s.actif));

  categoryStats = computed<CategoryStat[]>(() => {
    const services = this.services();
    const max = Math.max(1, ...this.categories().map((c) => services.filter((s) => s.categorieCode === c.code).length));
    return this.categories().map((c) => {
      const count = services.filter((s) => s.categorieCode === c.code).length;
      return { libelle: c.libelle, count, percent: Math.round((count / max) * 100) };
    });
  });

  // Ce que le profil a le droit de voir : chaque bloc du tableau de bord en depend.
  voitAgenda = computed(() => this.auth.peut('AGENDA'));
  voitCatalogue = computed(() => this.auth.peut('CATEGORIES') || this.auth.peut('SERVICES'));
  aucunAcces = computed(() => !this.voitAgenda() && !this.voitCatalogue());

  today = new Date().toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  constructor() {
    effect(() => {
      const zone = this.zone();
      untracked(() => this.chargerAgenda(zone));
    });
  }

  ngOnInit(): void {
    this.informations.ensureLoaded();
    // Le catalogue est public en lecture : on ne le charge que si le profil doit l'afficher.
    if (!this.voitCatalogue()) {
      this.loading.set(false);
      return;
    }
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

  private chargerAgenda(zone: string): void {
    // Un profil sans droit sur l'agenda ne le demande pas (pas d'erreur inutile a l'ecran).
    if (!this.auth.peut('AGENDA')) {
      this.agendaIndisponible.set(false);
      return;
    }
    const debut = aujourdhui(zone);
    this.rendezVous.agenda(debut, ajouterJours(debut, 7)).subscribe({
      next: (liste) => {
        this.agenda.set(liste);
        this.agendaIndisponible.set(false);
      },
      error: () => this.agendaIndisponible.set(true)
    });
  }

  jour(iso: string): string {
    return formatJourCourt(iso, this.zone());
  }

  heure(iso: string): string {
    return formatHeure(iso, this.zone());
  }

  formatTarif(tarif: number): string {
    return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(tarif);
  }
}
