import { localeCourante } from 'src/app/theme/shared/_helpers/zoned-time';
import { Component, OnInit, computed, effect, inject, input, output, signal, untracked } from '@angular/core';

import { firstValueFrom } from 'rxjs';

import { CatalogueService } from '../../service/catalogue.service';
import { ServiceResponse } from '../../service/catalogue.model';
import { InformationService } from '../../service/information.service';
import { Creneau, RendezVousService } from '../../service/rendez-vous.service';
import { ajouterJours, aujourdhui, formatHeure } from '../../_helpers/zoned-time';
import { DureePipe } from 'src/app/theme/shared/_helpers/duree.pipe';
import { TranslatePipe } from 'src/app/theme/shared/_helpers/translate.pipe';
import { TranslationService } from 'src/app/theme/shared/service/i18n/translation.service';

export interface ChoixCreneau {
  // Premier soin choisi (reste le "soin principal" cote serveur, pour compatibilite).
  serviceCode: string;
  // Soins supplementaires enchaines (meme creneau, un seul rendez-vous) ; vide = un seul soin.
  serviceCodesSupplementaires: string[];
  debut: string;
}

// Choix d'un ou plusieurs soins (enchaines sur un meme creneau), d'un jour, puis d'un creneau libre.
// Les heures sont celles de l'institut.
@Component({
  selector: 'app-slot-picker',
  imports: [TranslatePipe, DureePipe],
  templateUrl: './slot-picker.component.html',
  styleUrl: './slot-picker.component.scss'
})
export class SlotPickerComponent implements OnInit {
  private i18n = inject(TranslationService);
  private catalogue = inject(CatalogueService);
  private rendezVous = inject(RendezVousService);
  private informations = inject(InformationService);

  initialService = input<string | null>(null);
  choix = output<ChoixCreneau | null>();

  services = signal<ServiceResponse[]>([]);
  // Soins choisis, dans l'ordre de selection : le premier est le soin principal pour le serveur.
  soinsChoisis = signal<ServiceResponse[]>([]);
  date = signal('');

  // Champ de recherche : filtre la liste, les cases a cocher ajoutent/retirent un soin de la selection.
  rechercheSoin = signal('');
  menuSoinOuvert = signal(false);
  indexActif = signal(-1);
  creneaux = signal<Creneau[]>([]);
  choisi = signal<string | null>(null);
  loading = signal(false);
  error = signal('');
  dejaCharge = signal(false);

  // Recherche du prochain jour avec des créneaux (au plus 21 jours après le jour affiché).
  recherche = signal(false);
  aucunProche = signal(false);
  private jeton = 0;
  // Empreinte de la sélection de soins (codes dans l'ordre) : change dès qu'on ajoute, retire ou remplace un soin.
  private derniereSelection = '';
  private sautAuto = false;
  private readonly horizonJours = 21;
  private dureePipe = new DureePipe();

  zone = computed(() => this.informations.info()?.fuseauHoraire ?? 'America/Toronto');
  minDate = computed(() => aujourdhui(this.zone()));

  codesChoisis = computed(() => new Set(this.soinsChoisis().map((s) => s.code)));
  dureeTotale = computed(() => this.soinsChoisis().reduce((t, s) => t + s.dureeMinutes, 0));
  prixTotal = computed(() => this.soinsChoisis().reduce((t, s) => t + s.tarif, 0));

  servicesFiltres = computed(() => {
    const q = this.normaliser(this.rechercheSoin());
    const liste = this.services();
    return q ? liste.filter((s) => this.normaliser(this.libelleSoin(s)).includes(q)) : liste;
  });

  // Faux seulement quand on sait que l'institut n'a aucun jour d'ouverture : chercher plus loin serait inutile.
  peutChercher = computed(() => {
    const horaires = this.informations.info()?.horaires;
    return !horaires || horaires.some((h) => h.ouvert && h.plages?.length);
  });

  // Pourquoi il n'y a aucun créneau ce jour-là (horaires absents, jour fermé, soins trop longs, journée pleine).
  // Plusieurs soins s'enchaînent sur un même créneau : c'est leur durée totale qui doit tenir dans une plage.
  raison = computed(() => {
    const info = this.informations.info();
    const date = this.date();
    if (!info || !date) return '';
    const horaires = info.horaires ?? [];
    if (!horaires.some((h) => h.ouvert && h.plages?.length)) {
      return this.i18n.t('slots.raison.horairesVides');
    }
    const jour = horaires.find((h) => h.jourSemaine === this.jourSemaine(date));
    if (!jour || !jour.ouvert || !jour.plages?.length) {
      return this.i18n.t('slots.raison.ferme', { jour: this.nomJour(date) });
    }
    if (this.soinsChoisis().length) {
      const plusLongue = Math.max(...jour.plages.map((p) => this.minutes(p.heureFin) - this.minutes(p.heureDebut)));
      const duree = this.dureeTotale();
      if (duree > plusLongue) {
        return this.i18n.t('slots.raison.tropLong', { duree: this.dureePipe.transform(duree) });
      }
    }
    return this.i18n.t('slots.raison.complet');
  });

  // Nom dans la langue courante (repli sur le francais si aucune traduction anglaise saisie), comme le nom
  // de l'institut : les noms de soins sont une donnee saisie par l'institut, pas un texte d'interface.
  nomService(s: ServiceResponse): string {
    return (this.i18n.langue() === 'en' ? s.nomServiceEn : null) || s.nomService;
  }

  libelleSoin(s: ServiceResponse): string {
    return `${this.nomService(s)} · ${this.dureePipe.transform(s.dureeMinutes)} · ${this.formatTarif(s.tarif)}`;
  }

  estChoisi(s: ServiceResponse): boolean {
    return this.codesChoisis().has(s.code);
  }

  constructor() {
    // Propose le jour meme des que le fuseau de l'institut est connu.
    effect(() => {
      const min = this.minDate();
      if (!untracked(() => this.date())) {
        this.date.set(min);
      }
    });

    effect(() => {
      const soins = this.soinsChoisis();
      const date = this.date();
      // Nouvelle sélection de soins : si le jour affiché est vide, on saute tout seul au premier jour disponible.
      const selection = soins.map((s) => s.code).join(',');
      if (selection !== this.derniereSelection) {
        this.derniereSelection = selection;
        this.sautAuto = true;
      }
      if (soins.length && date) {
        untracked(() => this.charger(soins, date));
      } else {
        untracked(() => {
          // Plus de soin (ou pas de date) : on annule aussi une recherche de « prochain créneau » en cours.
          this.jeton++;
          this.recherche.set(false);
          this.aucunProche.set(false);
          this.creneaux.set([]);
          this.choisi.set(null);
          this.choix.emit(null);
        });
      }
    });
  }

  ngOnInit(): void {
    this.informations.ensureLoaded();
    this.catalogue.listServices().subscribe({
      next: (page) => {
        const actifs = page.content.filter((s) => s.actif);
        this.services.set(actifs);
        const demande = this.initialService();
        const service = demande ? actifs.find((s) => s.code === demande) : null;
        if (service) {
          this.soinsChoisis.set([service]);
        }
      },
      error: () => this.error.set(this.i18n.t('ts.slots.services'))
    });
  }

  onRechercheInput(event: Event): void {
    this.rechercheSoin.set((event.target as HTMLInputElement).value);
    this.menuSoinOuvert.set(true);
    this.indexActif.set(-1);
  }

  ouvrirMenuSoin(): void {
    this.menuSoinOuvert.set(true);
  }

  // Delai court pour laisser le clic sur une case de la liste s'executer avant que le blur ne referme le menu.
  fermerMenuSoinDifere(): void {
    setTimeout(() => this.menuSoinOuvert.set(false), 150);
  }

  basculerSelection(s: ServiceResponse): void {
    this.soinsChoisis.update((liste) =>
      liste.some((x) => x.code === s.code) ? liste.filter((x) => x.code !== s.code) : [...liste, s]
    );
  }

  // Empeche le mousedown sur une option de faire perdre le focus au champ de recherche :
  // sans ca, le menu se referme (via fermerMenuSoinDifere) avant qu'on puisse cocher un autre soin.
  onOptionMousedown(event: MouseEvent, s: ServiceResponse): void {
    event.preventDefault();
    this.basculerSelection(s);
  }

  retirerSoin(s: ServiceResponse): void {
    this.soinsChoisis.update((liste) => liste.filter((x) => x.code !== s.code));
  }

  onKeydownRecherche(event: KeyboardEvent): void {
    const liste = this.servicesFiltres();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.menuSoinOuvert.set(true);
      this.indexActif.set(Math.min(this.indexActif() + 1, liste.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.indexActif.set(Math.max(this.indexActif() - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const choisi = liste[this.indexActif()];
      if (choisi) this.basculerSelection(choisi);
    } else if (event.key === 'Escape') {
      this.menuSoinOuvert.set(false);
    }
  }

  onDate(event: Event): void {
    this.date.set((event.target as HTMLInputElement).value);
  }

  choisir(creneau: Creneau): void {
    const [principal, ...reste] = this.soinsChoisis();
    if (!principal) return;
    this.choisi.set(creneau.debut);
    this.choix.emit({ serviceCode: principal.code, serviceCodesSupplementaires: reste.map((s) => s.code), debut: creneau.debut });
  }

  heure(iso: string): string {
    return formatHeure(iso, this.zone());
  }

  formatTarif(tarif: number): string {
    return new Intl.NumberFormat(localeCourante(), { style: 'currency', currency: 'CAD' }).format(tarif);
  }

  // Bouton « Prochain créneau disponible » : cherche à partir du lendemain du jour affiché, pour l'ensemble
  // des soins choisis (ils s'enchaînent sur un même créneau).
  async prochain(): Promise<void> {
    const codes = this.soinsChoisis().map((s) => s.code);
    const depart = this.date();
    if (!codes.length || !depart) return;
    const jeton = ++this.jeton;
    this.recherche.set(true);
    this.aucunProche.set(false);
    for (let i = 1; i <= this.horizonJours; i++) {
      const jour = ajouterJours(depart, i);
      if (!this.ouvertCeJour(jour)) continue;
      try {
        const res = await firstValueFrom(this.rendezVous.creneaux(codes, jour));
        if (jeton !== this.jeton) return;
        if (res.creneaux.length) {
          this.recherche.set(false);
          this.date.set(jour);
          return;
        }
      } catch {
        if (jeton !== this.jeton) return;
      }
    }
    this.recherche.set(false);
    this.aucunProche.set(true);
  }

  // « Lundi » = 1 ... « dimanche » = 7, comme Horaire.jourSemaine ; date au format « AAAA-MM-JJ ».
  private jourSemaine(date: string): number {
    const [y, m, d] = date.split('-').map(Number);
    const jour = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    return jour === 0 ? 7 : jour;
  }

  private nomJour(date: string): string {
    return new Intl.DateTimeFormat(localeCourante(), { timeZone: 'UTC', weekday: 'long' }).format(new Date(date + 'T12:00:00Z'));
  }

  private minutes(heure: string): number {
    const [h, m] = heure.split(':').map(Number);
    return h * 60 + (m || 0);
  }

  // Sans horaires connus, on ne saute aucun jour : le serveur répondra.
  private ouvertCeJour(date: string): boolean {
    const horaires = this.informations.info()?.horaires;
    if (!horaires?.length) return true;
    const jour = horaires.find((h) => h.jourSemaine === this.jourSemaine(date));
    return !!jour?.ouvert && !!jour.plages?.length;
  }

  private normaliser(texte: string): string {
    return texte
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private charger(soins: ServiceResponse[], date: string): void {
    // Toute nouvelle recherche annule une recherche de « prochain créneau » encore en cours.
    this.jeton++;
    this.recherche.set(false);
    this.aucunProche.set(false);
    const saut = this.sautAuto;
    this.sautAuto = false;
    this.choisi.set(null);
    this.choix.emit(null);
    this.error.set('');
    this.loading.set(true);
    this.rendezVous.creneaux(soins.map((s) => s.code), date).subscribe({
      next: (res) => {
        this.creneaux.set(res.creneaux);
        this.dejaCharge.set(true);
        this.loading.set(false);
        if (saut && res.creneaux.length === 0 && this.peutChercher()) {
          void this.prochain();
        }
      },
      error: (err) => {
        this.creneaux.set([]);
        this.loading.set(false);
        this.error.set(err?.status === 401 ? this.i18n.t('ts.slots.connexion') : (err?.error?.message ?? this.i18n.t('ts.slots.creneaux')));
      }
    });
  }
}
