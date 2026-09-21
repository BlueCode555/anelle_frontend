import { Component, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Observable } from 'rxjs';

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

interface Groupe {
  cle: string;
  libelle: string;
  items: RendezVous[];
}

@Component({
  selector: 'app-agenda',
  imports: [CommonModule],
  templateUrl: './agenda.component.html',
  styleUrl: './agenda.component.scss'
})
export class AgendaComponent implements OnInit {
  private rendezVous = inject(RendezVousService);
  private informations = inject(InformationService);
  private modals = inject(NgbModal);
  private confirmation = inject(ConfirmationService);

  readonly libelles = STATUT_LIBELLES;
  readonly classes = STATUT_CLASSES;

  debutSemaine = signal('');
  items = signal<RendezVous[]>([]);
  chargement = signal(true);
  erreur = signal('');
  indisponibilites = signal<Indisponibilite[]>([]);

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
        this.erreur.set(this.messageErreur(err, "Impossible de charger l'agenda."));
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
    const motif = prompt('Motif du refus (facultatif, visible par la cliente) :');
    if (motif === null) return;
    this.executer(this.rendezVous.refuser(rdv.id, motif));
  }

  marquerPaye(rdv: RendezVous): void {
    const reference = prompt(`Paiement complet de ${this.formatTarif(rdv.prix)} reçu.\nRéférence (facultative) :`, '');
    if (reference === null) return;
    this.executer(this.rendezVous.marquerPaye(rdv.id, reference));
  }

  terminer(rdv: RendezVous): void {
    this.executer(this.rendezVous.terminer(rdv.id));
  }

  async annuler(rdv: RendezVous): Promise<void> {
    const ok = await this.confirmation.demander({
      titre: `Annuler le rendez-vous de ${rdv.clientNom ?? 'ce client'} ?`,
      message: rdv.serviceNom,
      texteConfirmer: 'Annuler le rendez-vous',
      texteAnnuler: 'Garder',
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
      this.congeErreur.set('Indiquez le début et la fin.');
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
        error: (err) => this.congeErreur.set(this.messageErreur(err, "Impossible d'enregistrer cette période."))
      });
  }

  async supprimerConge(conge: Indisponibilite): Promise<void> {
    const ok = await this.confirmation.demander({
      titre: 'Supprimer cette période ?',
      message: 'Les créneaux redeviendront disponibles.',
      texteConfirmer: 'Supprimer',
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
    return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(tarif);
  }

  private executer(action: Observable<RendezVous>): void {
    this.erreur.set('');
    action.subscribe({
      next: () => this.charger(),
      error: (err) => this.erreur.set(this.messageErreur(err, "L'action a échoué."))
    });
  }

  private messageErreur(err: { status?: number; error?: { message?: string } }, defaut: string): string {
    if (err?.status === 401 || err?.status === 403) {
      return 'Action refusée : connexion du personnel requise.';
    }
    return err?.error?.message ?? defaut;
  }
}
