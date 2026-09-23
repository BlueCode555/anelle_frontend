import { localeCourante } from 'src/app/theme/shared/_helpers/zoned-time';
import { Component, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Observable } from 'rxjs';

import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { Collaborateur, EquipeService } from 'src/app/theme/shared/service/equipe.service';
import { InformationService } from 'src/app/theme/shared/service/information.service';
import {
  Indisponibilite,
  RendezVous,
  RendezVousService,
  STATUT_CLASSES,
  STATUT_LIBELLES
} from 'src/app/theme/shared/service/rendez-vous.service';
import {
  ajouterJours,
  aujourdhui,
  cleJour,
  formatHeure,
  formatJour,
  formatJourCourt,
  lundiDeLaSemaine,
  versIsoAvecDecalage
} from 'src/app/theme/shared/_helpers/zoned-time';
import { NouveauRendezVousComponent } from './nouveau-rendez-vous/nouveau-rendez-vous.component';
import { ConfirmationService } from 'src/app/theme/shared/service/confirmation.service';
import { TranslatePipe } from 'src/app/theme/shared/_helpers/translate.pipe';
import { TranslationService } from 'src/app/theme/shared/service/i18n/translation.service';

interface Groupe {
  cle: string;
  libelle: string;
  items: RendezVous[];
}

@Component({
  selector: 'app-agenda',
  imports: [CommonModule, TranslatePipe],
  templateUrl: './agenda.component.html',
  styleUrl: './agenda.component.scss'
})
export class AgendaComponent implements OnInit {
  private i18n = inject(TranslationService);
  private rendezVous = inject(RendezVousService);
  private informations = inject(InformationService);
  private equipe = inject(EquipeService);
  private auth = inject(AuthService);
  private modals = inject(NgbModal);
  private confirmation = inject(ConfirmationService);

  readonly libelles = STATUT_LIBELLES;
  readonly classes = STATUT_CLASSES;

  debutSemaine = signal('');
  items = signal<RendezVous[]>([]);
  chargement = signal(true);
  erreur = signal('');
  indisponibilites = signal<Indisponibilite[]>([]);
  // Affectation d'un collaborateur : reservee a la proprietaire (voir PermissionRules cote backend).
  collaborateursActifs = signal<Collaborateur[]>([]);

  // Formulaire des conges (dates locales de l'institut)
  congeDebut = signal('');
  congeFin = signal('');
  congeMotif = signal('');
  congeErreur = signal('');

  zone = computed(() => this.informations.info()?.fuseauHoraire ?? 'America/Toronto');
  finSemaine = computed(() => (this.debutSemaine() ? ajouterJours(this.debutSemaine(), 6) : ''));

  groupes = computed<Groupe[]>(() => {
    const parJour = new Map<string, RendezVous[]>();
    for (const rdv of this.items()) {
      const cle = cleJour(rdv.debut, this.zone());
      parJour.set(cle, [...(parJour.get(cle) ?? []), rdv]);
    }
    return [...parJour.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([cle, items]) => ({ cle, libelle: formatJour(items[0].debut, this.zone()), items }));
  });

  aTraiter = computed(() => this.items().filter((r) => r.statut === 'DEMANDE').length);

  constructor() {
    effect(() => {
      const zone = this.zone();
      if (!untracked(() => this.debutSemaine())) {
        this.debutSemaine.set(lundiDeLaSemaine(aujourdhui(zone)));
      }
    });
    effect(() => {
      if (this.debutSemaine()) {
        untracked(() => this.charger());
      }
    });
  }

  ngOnInit(): void {
    this.informations.ensureLoaded();
    this.chargerConges();
    if (this.estProprietaire()) {
      this.equipe.collaborateurs().subscribe({
        next: (liste) => this.collaborateursActifs.set(liste.filter((c) => c.actif)),
        error: () => this.collaborateursActifs.set([])
      });
    }
  }

  estProprietaire(): boolean {
    return this.auth.estProprietaire();
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  semainePrecedente(): void {
    this.debutSemaine.set(ajouterJours(this.debutSemaine(), -7));
  }

  semaineSuivante(): void {
    this.debutSemaine.set(ajouterJours(this.debutSemaine(), 7));
  }

  cetteSemaine(): void {
    this.debutSemaine.set(lundiDeLaSemaine(aujourdhui(this.zone())));
  }

  libelleSemaine(): string {
    const debut = this.debutSemaine();
    if (!debut) return '';
    return `${formatJourCourt(versIsoAvecDecalage(`${debut}T12:00`, this.zone()), this.zone())} – ${formatJourCourt(
      versIsoAvecDecalage(`${this.finSemaine()}T12:00`, this.zone()),
      this.zone()
    )}`;
  }

  // ── Rendez-vous ───────────────────────────────────────────────────────────

  charger(): void {
    this.chargement.set(true);
    this.rendezVous.agenda(this.debutSemaine(), this.finSemaine()).subscribe({
      next: (liste) => {
        this.items.set(liste);
        this.chargement.set(false);
      },
      error: (err) => {
        this.chargement.set(false);
        this.erreur.set(this.messageErreur(err, this.i18n.t('ts.agenda.charger')));
      }
    });
  }

  nouveau(): void {
    const ref = this.modals.open(NouveauRendezVousComponent, { centered: true, size: 'lg' });
    ref.result.then(
      (r) => {
        if (r === 'saved') this.charger();
      },
      () => {}
    );
  }

  accepter(rdv: RendezVous): void {
    this.executer(this.rendezVous.accepter(rdv.id));
  }

  refuser(rdv: RendezVous): void {
    const motif = prompt(this.i18n.t('ts.agenda.motifRefus'));
    if (motif === null) return;
    this.executer(this.rendezVous.refuser(rdv.id, motif));
  }

  marquerPaye(rdv: RendezVous): void {
    const reference = prompt(this.i18n.t('ts.agenda.paiement', { montant: this.formatTarif(rdv.prix) }), '');
    if (reference === null) return;
    this.executer(this.rendezVous.marquerPaye(rdv.id, reference));
  }

  terminer(rdv: RendezVous): void {
    this.executer(this.rendezVous.terminer(rdv.id));
  }

  affecter(rdv: RendezVous, event: Event): void {
    const valeur = (event.target as HTMLSelectElement).value;
    this.executer(this.rendezVous.assigner(rdv.id, valeur ? Number(valeur) : null));
  }

  async annuler(rdv: RendezVous): Promise<void> {
    const ok = await this.confirmation.demander({
      titre: this.i18n.t('ts.agenda.annulerTitre', { nom: rdv.clientNom ?? this.i18n.t('ts.agenda.ceClient') }),
      message: rdv.serviceNom,
      texteConfirmer: this.i18n.t('espace.annulerConfirmer'),
      texteAnnuler: this.i18n.t('espace.garder'),
      danger: true
    });
    if (ok) {
      this.executer(this.rendezVous.annuler(rdv.id));
    }
  }

  peutAnnuler(rdv: RendezVous): boolean {
    return ['DEMANDE', 'ACCEPTE', 'CONFIRME'].includes(rdv.statut) && new Date(rdv.debut).getTime() > Date.now();
  }

  peutTerminer(rdv: RendezVous): boolean {
    return rdv.statut === 'CONFIRME' && new Date(rdv.debut).getTime() <= Date.now();
  }

  // ── Conges et fermetures ──────────────────────────────────────────────────

  chargerConges(): void {
    this.rendezVous.indisponibilites().subscribe({
      next: (liste) => this.indisponibilites.set(liste),
      error: () => this.indisponibilites.set([])
    });
  }

  champ(cible: { set(v: string): void }, event: Event): void {
    cible.set((event.target as HTMLInputElement).value);
  }

  ajouterConge(): void {
    this.congeErreur.set('');
    if (!this.congeDebut() || !this.congeFin()) {
      this.congeErreur.set(this.i18n.t('ts.agenda.debutFin'));
      return;
    }
    this.rendezVous
      .creerIndisponibilite({
        debut: versIsoAvecDecalage(this.congeDebut(), this.zone()),
        fin: versIsoAvecDecalage(this.congeFin(), this.zone()),
        motif: this.congeMotif().trim() || undefined
      })
      .subscribe({
        next: () => {
          this.congeDebut.set('');
          this.congeFin.set('');
          this.congeMotif.set('');
          this.chargerConges();
        },
        error: (err) => this.congeErreur.set(this.messageErreur(err, this.i18n.t('ts.agenda.periode')))
      });
  }

  async supprimerConge(conge: Indisponibilite): Promise<void> {
    const ok = await this.confirmation.demander({
      titre: this.i18n.t('ts.agenda.supprPeriode'),
      message: this.i18n.t('ts.agenda.creneauxDispo'),
      texteConfirmer: this.i18n.t('ts.supprimer'),
      danger: true
    });
    if (ok) {
      this.rendezVous.supprimerIndisponibilite(conge.id).subscribe(() => this.chargerConges());
    }
  }

  // ── Affichage ─────────────────────────────────────────────────────────────

  heure(iso: string): string {
    return formatHeure(iso, this.zone());
  }

  periode(conge: Indisponibilite): string {
    return `${formatJourCourt(conge.debut, this.zone())} ${this.heure(conge.debut)} → ${formatJourCourt(conge.fin, this.zone())} ${this.heure(conge.fin)}`;
  }

  formatTarif(tarif: number): string {
    return new Intl.NumberFormat(localeCourante(), { style: 'currency', currency: 'CAD' }).format(tarif);
  }

  private executer(action: Observable<RendezVous>): void {
    this.erreur.set('');
    action.subscribe({
      next: () => this.charger(),
      error: (err) => this.erreur.set(this.messageErreur(err, this.i18n.t('ts.agenda.actionEchec')))
    });
  }

  private messageErreur(err: { status?: number; error?: { message?: string } }, defaut: string): string {
    if (err?.status === 401 || err?.status === 403) {
      return this.i18n.t('ts.agenda.refusee');
    }
    return err?.error?.message ?? defaut;
  }
}
