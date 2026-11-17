import { localeCourante } from 'src/app/theme/shared/_helpers/zoned-time';
import { Component, OnInit, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';

import { CatalogueService } from '../../service/catalogue.service';
import { ServiceResponse } from '../../service/catalogue.model';
import { InformationService, JOURS_SEMAINE } from '../../service/information.service';
import { Creneau, RendezVousService } from '../../service/rendez-vous.service';
import { aujourdhui, formatHeure } from '../../_helpers/zoned-time';
import { DureePipe } from 'src/app/theme/shared/_helpers/duree.pipe';
import { TranslatePipe } from 'src/app/theme/shared/_helpers/translate.pipe';
import { TranslationService } from 'src/app/theme/shared/service/i18n/translation.service';

export interface ChoixCreneau {
  // Premier soin choisi (reste le "soin principal" cote serveur, pour compatibilite).
  serviceCode: string;
  // Soins supplementaires enchaines (meme creneau, un seul rendez-vous) ; vide = un seul soin.
  serviceCodesSupplementaires: string[];
  debut: string;
  // Pour affichage uniquement (recap cote parent sans avoir a reconsulter le catalogue) : noms des soins choisis.
  libelleServices: string;
}

// Choix d'un ou plusieurs soins (enchaines sur un meme creneau), d'un jour, puis d'un creneau libre.
// Les heures sont celles de l'institut.
@Component({
  selector: 'app-slot-picker',
  imports: [CommonModule, TranslatePipe, DureePipe],
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
  // '' = toutes les categories. Un gros catalogue (centaines de soins) se filtre d'abord par categorie.
  categorieChoisie = signal('');
  menuSoinOuvert = signal(false);
  indexActif = signal(-1);
  creneaux = signal<Creneau[]>([]);
  choisi = signal<string | null>(null);
  loading = signal(false);
  error = signal('');
  dejaCharge = signal(false);

  zone = computed(() => this.informations.info()?.fuseauHoraire ?? 'America/Toronto');
  minDate = computed(() => aujourdhui(this.zone()));

  // Jours de la semaine ou l'institut est habituellement ouvert (au moins une plage) : sert a preciser le
  // message "aucun creneau" au lieu de laisser la cliente deviner quel autre jour essayer.
  joursOuverts = computed(() => {
    const horaires = this.informations.info()?.horaires ?? [];
    return horaires.filter((h) => h.ouvert && h.plages.length > 0).map((h) => JOURS_SEMAINE[h.jourSemaine - 1]);
  });

  messageAucunCreneau = computed(() => {
    const jours = this.joursOuverts();
    return jours.length
      ? this.i18n.t('slots.aucunAvecJours', { jours: jours.join(', ') })
      : this.i18n.t('slots.aucunHoraire');
  });

  codesChoisis = computed(() => new Set(this.soinsChoisis().map((s) => s.code)));
  dureeTotale = computed(() => this.soinsChoisis().reduce((t, s) => t + s.dureeMinutes, 0));
  prixTotal = computed(() => this.soinsChoisis().reduce((t, s) => t + s.tarif, 0));

  // Liste des categories presentes dans le catalogue (deduites des soins, triees alphabetiquement).
  categories = computed(() => {
    const vues = new Map<string, string>();
    for (const s of this.services()) {
      if (!vues.has(s.categorieCode)) vues.set(s.categorieCode, this.categorieLibelle(s));
    }
    return [...vues.entries()].map(([code, libelle]) => ({ code, libelle })).sort((a, b) => a.libelle.localeCompare(b.libelle));
  });

  // Nombre maximal de soins proposes a la fois dans la liste : au-dela, on demande d'affiner (categorie/recherche)
  // plutot que de rendre une liste interminable si le catalogue compte des centaines de soins.
  private readonly MAX_RESULTATS = 10;

  private servicesCorrespondants = computed(() => {
    const q = this.normaliser(this.rechercheSoin());
    const categorie = this.categorieChoisie();
    return this.services().filter(
      (s) => (!categorie || s.categorieCode === categorie) && (!q || this.normaliser(this.libelleSoin(s)).includes(q))
    );
  });

  nbResultatsTotal = computed(() => this.servicesCorrespondants().length);

  servicesFiltres = computed(() => this.servicesCorrespondants().slice(0, this.MAX_RESULTATS));

  // Nom dans la langue courante (repli sur le francais si aucune traduction anglaise saisie), comme le nom
  // de l'institut : les noms de soins sont une donnee saisie par l'institut, pas un texte d'interface.
  nomService(s: ServiceResponse): string {
    return (this.i18n.langue() === 'en' ? s.nomServiceEn : null) || s.nomService;
  }

  libelleSoin(s: ServiceResponse): string {
    return `${this.nomService(s)} · ${new DureePipe().transform(s.dureeMinutes)} · ${this.formatTarif(s.tarif)}`;
  }

  categorieLibelle(s: ServiceResponse): string {
    return (this.i18n.langue() === 'en' ? s.categorieLibelleEn : null) || s.categorieLibelle;
  }

  onCategorie(event: Event): void {
    this.categorieChoisie.set((event.target as HTMLSelectElement).value);
    this.menuSoinOuvert.set(true);
    this.indexActif.set(-1);
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
      if (soins.length && date) {
        untracked(() => this.charger(soins, date));
      } else {
        untracked(() => {
          this.creneaux.set([]);
          this.choisi.set(null);
          this.choix.emit(null);
        });
      }
    });
  }

  ngOnInit(): void {
    this.informations.ensureLoaded();
    this.catalogue.listServices({ size: 1000 }).subscribe({
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

  // Remet le picker a zero (soins, date, creneau) sans recharger le catalogue : sert a enchainer un deuxieme
  // rendez-vous (jour different) dans la meme demande, depuis ReserverComponent.
  reinitialiser(): void {
    this.soinsChoisis.set([]);
    this.rechercheSoin.set('');
    this.categorieChoisie.set('');
    this.date.set(this.minDate());
    this.creneaux.set([]);
    this.choisi.set(null);
    this.dejaCharge.set(false);
    this.choix.emit(null);
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
    this.choix.emit({
      serviceCode: principal.code,
      serviceCodesSupplementaires: reste.map((s) => s.code),
      debut: creneau.debut,
      libelleServices: this.soinsChoisis().map((s) => this.nomService(s)).join(' + ')
    });
  }

  heure(iso: string): string {
    return formatHeure(iso, this.zone());
  }

  formatTarif(tarif: number): string {
    return new Intl.NumberFormat(localeCourante(), { style: 'currency', currency: 'CAD' }).format(tarif);
  }

  private normaliser(texte: string): string {
    return texte
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim();
  }

  private charger(soins: ServiceResponse[], date: string): void {
    this.choisi.set(null);
    this.choix.emit(null);
    this.error.set('');
    this.loading.set(true);
    this.rendezVous.creneaux(soins.map((s) => s.code), date).subscribe({
      next: (res) => {
        this.creneaux.set(res.creneaux);
        this.dejaCharge.set(true);
        this.loading.set(false);
      },
      error: (err) => {
        this.creneaux.set([]);
        this.loading.set(false);
        this.error.set(
          err?.status === 401 ? this.i18n.t('ts.slots.connexion') : (err?.error?.message ?? this.i18n.t('ts.slots.creneaux'))
        );
      }
    });
  }
}
