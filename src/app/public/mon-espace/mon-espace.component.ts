import { localeCourante } from 'src/app/theme/shared/_helpers/zoned-time';
import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

import { AuthService } from '../../theme/shared/service/auth.service';
import { InformationService } from '../../theme/shared/service/information.service';
import { Commande, CommandeService, ProduitService, STATUT_COMMANDE_CLASSES } from '../../theme/shared/service/boutique.service';
import { RendezVous, RendezVousService, STATUT_CLASSES, STATUT_LIBELLES } from '../../theme/shared/service/rendez-vous.service';
import { formatHeure, formatJour } from '../../theme/shared/_helpers/zoned-time';
import { RETOUR_CLIENT_KEY } from '../../theme/shared/_helpers/token-storage';
import { SiteHeaderComponent } from '../site-header/site-header.component';
import { ConfirmationService } from 'src/app/theme/shared/service/confirmation.service';
import { TranslatePipe } from 'src/app/theme/shared/_helpers/translate.pipe';
import { TranslationService } from 'src/app/theme/shared/service/i18n/translation.service';

@Component({
  selector: 'app-mon-espace',
  imports: [CommonModule, RouterModule, SiteHeaderComponent, TranslatePipe],
  templateUrl: './mon-espace.component.html',
  styleUrl: './mon-espace.component.scss'
})
export class MonEspaceComponent implements OnInit {
  private i18n = inject(TranslationService);
  auth = inject(AuthService);
  private router = inject(Router);
  private informations = inject(InformationService);
  private rendezVous = inject(RendezVousService);
  private commandesApi = inject(CommandeService);
  private confirmation = inject(ConfirmationService);
  private produits = inject(ProduitService);

  readonly libelles = STATUT_LIBELLES;
  readonly classes = STATUT_CLASSES;
  readonly classesCommande = STATUT_COMMANDE_CLASSES;

  commandes = signal<Commande[]>([]);

  rdvs = signal<RendezVous[]>([]);
  chargement = signal(true);
  erreur = signal('');
  sessionExpiree = signal(false);
  photoErreur = signal(false);

  zone = computed(() => this.informations.info()?.fuseauHoraire ?? 'America/Toronto');
  // ── Tableau de bord ──
  private maintenant = Date.now();
  private actifs = ['DEMANDE', 'ACCEPTE', 'CONFIRME'];
  aVenir = computed(() =>
    this.rdvs()
      .filter((r) => this.actifs.includes(r.statut) && new Date(r.fin).getTime() > this.maintenant)
      .sort((a, b) => a.debut.localeCompare(b.debut))
  );
  // Expirés, refusés, annulés, terminés ou passés : gardés pour mémoire, mais rangés à part.
  historique = computed(() =>
    this.rdvs()
      .filter((r) => !this.aVenir().includes(r))
      // Une demande expirée, refusée ou annulée disparaît de la vue de la cliente au bout de 30 jours (elle reste en base
      // et dans l'agenda du personnel) ; un soin terminé ou payé reste toujours consultable.
      .filter((r) => r.statut === 'TERMINE' || !!r.payeLe || Date.now() - new Date(r.debut).getTime() < 30 * 86400000)
      .sort((a, b) => b.debut.localeCompare(a.debut))
  );
  prochain = computed(() => this.aVenir()[0] ?? null);
  commandesEnCours = computed(() => this.commandes().filter((c) => c.statut === 'EN_ATTENTE_PAIEMENT' || c.statut === 'PAYEE' || c.statut === 'PRETE'));
  commandesHistorique = computed(() =>
    this.commandes().filter((c) => c.statut === 'REMISE' || (c.statut === 'ANNULEE' && Date.now() - new Date(c.creeLe).getTime() < 30 * 86400000))
  );
  totalRegle = computed(
    () =>
      this.rdvs().filter((r) => !!r.payeLe && r.statut !== 'ANNULE').reduce((t, r) => t + r.prix, 0) +
      this.commandes().filter((c) => !!c.payeLe && c.statut !== 'ANNULEE').reduce((t, c) => t + c.total, 0)
  );
  // ── Ce qui attend une action de la cliente : régler un rendez-vous accepté ou une commande ──
  aPayer = computed(() => [
    ...this.rdvs()
      .filter((r) => r.statut === 'ACCEPTE' && !!r.lienPaiement)
      .map((r) => ({ type: 'rdv' as const, titre: r.serviceNom, sous: this.jour(r.debut) + ' · ' + this.heure(r.debut), montant: r.prix, lien: r.lienPaiement! })),
    ...this.commandes()
      .filter((c) => c.statut === 'EN_ATTENTE_PAIEMENT' && !!c.lienPaiement)
      .map((c) => ({ type: 'commande' as const, titre: c.code, sous: c.lignes.map((l) => l.quantite + ' × ' + l.nom).join(', '), montant: c.total, lien: c.lienPaiement! }))
  ]);

  // Commandes en cours, les plus récentes d'abord, pour le suivi de l'aperçu.
  dernieresCommandes = computed(() => [...this.commandesEnCours()].sort((a, b) => b.creeLe.localeCompare(a.creeLe)).slice(0, 3));

  // Rang dans le suivi d'une commande : 0 à payer, 1 payée (préparation), 2 prête, 3 remise.
  etape(c: Commande): number {
    return { EN_ATTENTE_PAIEMENT: 0, PAYEE: 1, PRETE: 2, REMISE: 3, ANNULEE: -1 }[c.statut];
  }

  imageLigne(url: string | null): string | null {
    return this.produits.imageSrc(url);
  }

  // « aujourd'hui », « demain », « dans 3 jours » : plus parlant qu'une date pour ce qui approche.
  dans(iso: string): string {
    const jours = Math.round((new Date(iso).getTime() - Date.now()) / 86400000);
    if (jours <= 0) return this.i18n.t('espace.aujourdhui');
    if (jours === 1) return this.i18n.t('espace.demain');
    return this.i18n.t('espace.dansJours', { n: jours });
  }

  numeroJour(iso: string): string {
    return new Intl.DateTimeFormat(localeCourante(), { timeZone: this.zone(), day: 'numeric' }).format(new Date(iso));
  }

  moisCourt(iso: string): string {
    return new Intl.DateTimeFormat(localeCourante(), { timeZone: this.zone(), month: 'short' }).format(new Date(iso));
  }

  aujourdhuiTexte(): string {
    return new Intl.DateTimeFormat(localeCourante(), { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  }

  nombreSoins = computed(() => this.rdvs().filter((r) => r.statut === 'TERMINE' || (r.statut === 'CONFIRME' && new Date(r.fin).getTime() < Date.now())).length);

  totalMois = computed(() => this.mois().reduce((t, m) => t + m.montant, 0));

  // ── Navigation du tableau de bord ──
  section = signal<'apercu' | 'rdv' | 'commandes' | 'paiements'>('apercu');

  // Sommes réglées (rendez-vous + commandes) sur les 6 derniers mois, pour le petit graphique.
  mois = computed(() => {
    const maintenant = new Date();
    const cles: { cle: string; date: Date }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(maintenant.getFullYear(), maintenant.getMonth() - i, 1);
      cles.push({ cle: d.getFullYear() + '-' + d.getMonth(), date: d });
    }
    const totaux = new Map<string, number>(cles.map((c) => [c.cle, 0]));
    const ajouter = (iso: string | null, montant: number) => {
      if (!iso) return;
      const d = new Date(iso);
      const cle = d.getFullYear() + '-' + d.getMonth();
      if (totaux.has(cle)) totaux.set(cle, (totaux.get(cle) ?? 0) + montant);
    };
    this.rdvs().filter((r) => r.statut !== 'ANNULE').forEach((r) => ajouter(r.payeLe, r.prix));
    this.commandes().filter((c) => c.statut !== 'ANNULEE').forEach((c) => ajouter(c.payeLe, c.total));
    const max = Math.max(1, ...totaux.values());
    return cles.map((c) => ({
      libelle: new Intl.DateTimeFormat(localeCourante(), { month: 'short' }).format(c.date),
      montant: totaux.get(c.cle) ?? 0,
      pourcent: Math.round(((totaux.get(c.cle) ?? 0) / max) * 100)
    }));
  });

  // Les dernières choses qui se sont passées (rendez-vous et commandes mélangés, plus récent d'abord).
  activite = computed(() => {
    const evenements = [
      ...this.rdvs().map((r) => ({ type: 'rdv' as const, date: r.debut, titre: r.serviceNom, statut: 'statut.' + r.statut })),
      ...this.commandes().map((c) => ({ type: 'commande' as const, date: c.creeLe, titre: c.code, statut: 'cmd.statut.' + c.statut }))
    ];
    return evenements.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  });

  choisirSection(s: 'apercu' | 'rdv' | 'commandes' | 'paiements'): void {
    this.section.set(s);
  }

  voirHistoriqueRdv = signal(false);
  voirHistoriqueCmd = signal(false);

  paiements = computed(() => this.rdvs().filter((r) => !!r.payeLe && r.statut !== 'ANNULE'));

  constructor() {
    // Session refusee par le serveur (token expire, deconnexion) : retour a la page de connexion.
    effect(() => {
      if (!this.auth.loading() && !this.auth.user()) {
        this.router.navigate(['/connexion']);
      }
    });
  }

  ngOnInit(): void {
    this.informations.ensureLoaded();
    this.charger();
    this.chargerCommandes();
  }

  charger(): void {
    this.chargement.set(true);
    this.rendezVous.mes().subscribe({
      next: (liste) => {
        this.rdvs.set(liste);
        this.chargement.set(false);
      },
      error: () => {
        this.erreur.set(this.i18n.t('espace.erreurChargement'));
        this.chargement.set(false);
      }
    });
  }

  chargerCommandes(): void {
    // Non bloquant : un souci sur la boutique ne doit pas masquer les rendez-vous.
    this.commandesApi.mes().subscribe({ next: (liste) => this.commandes.set(liste), error: () => this.commandes.set([]) });
  }

  async annulerCommande(c: Commande): Promise<void> {
    const ok = await this.confirmation.demander({
      titre: this.i18n.t('espace.annulerCommandeTitre', { code: c.code }),
      texteConfirmer: this.i18n.t('cmd.annulerConfirmer'),
      texteAnnuler: this.i18n.t('espace.garder'),
      danger: true
    });
    if (!ok) {
      return;
    }
    this.erreur.set('');
    this.commandesApi.annuler(c.id).subscribe({
      next: () => this.chargerCommandes(),
      error: (err) => this.erreur.set(err?.status === 401 ? this.i18n.t('espace.sessionExpiree') : (err?.error?.message ?? this.i18n.t('espace.erreurAnnuler')))
    });
  }

  formatDate(iso: string): string {
    return new Intl.DateTimeFormat(localeCourante(), { dateStyle: 'medium' }).format(new Date(iso));
  }

  peutAnnuler(rdv: RendezVous): boolean {
    return ['DEMANDE', 'ACCEPTE', 'CONFIRME'].includes(rdv.statut) && new Date(rdv.debut).getTime() > Date.now();
  }

  async annuler(rdv: RendezVous): Promise<void> {
    const ok = await this.confirmation.demander({
      titre: this.i18n.t('espace.annulerTitre'),
      message: rdv.serviceNom,
      texteConfirmer: this.i18n.t('espace.annulerConfirmer'),
      texteAnnuler: this.i18n.t('espace.garder'),
      danger: true
    });
    if (!ok) {
      return;
    }
    this.erreur.set('');
    this.sessionExpiree.set(false);
    this.rendezVous.annuler(rdv.id).subscribe({
      next: () => this.charger(),
      error: (err) => {
        // 401 = jeton absent/invalide (vraie expiration) ; un 403 est un refus métier du serveur (message a
        // afficher tel quel), pas forcement une session expirée.
        const expiree = err?.status === 401;
        this.sessionExpiree.set(expiree);
        this.erreur.set(expiree ? this.i18n.t('espace.sessionExpiree') : (err?.error?.message ?? this.i18n.t('espace.erreurAnnuler')));
      }
    });
  }

  reconnecter(): void {
    sessionStorage.setItem(RETOUR_CLIENT_KEY, '/mon-espace');
    this.auth.loginClient();
  }

  jour(iso: string): string {
    return formatJour(iso, this.zone());
  }

  heure(iso: string): string {
    return formatHeure(iso, this.zone());
  }

  formatTarif(tarif: number): string {
    return new Intl.NumberFormat(localeCourante(), { style: 'currency', currency: 'CAD' }).format(tarif);
  }

  // Collaborateur affecté, sinon l'institut lui-même s'en occupe.
  avecQui(rdv: RendezVous): string {
    return rdv.collaborateurNom ?? this.informations.info()?.nom ?? '';
  }

  classeRdv(statut: string): string {
    return this.classes[statut as keyof typeof STATUT_CLASSES] ?? '';
  }

  classeCommande(statut: string): string {
    return this.classesCommande[statut as keyof typeof STATUT_COMMANDE_CLASSES] ?? '';
  }

  afficherAvecQui(rdv: RendezVous): boolean {
    return ['DEMANDE', 'ACCEPTE', 'CONFIRME'].includes(rdv.statut);
  }
}
