import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { Collaborateur, EquipeService, Profil } from 'src/app/theme/shared/service/equipe.service';
import { ConfirmationService } from 'src/app/theme/shared/service/confirmation.service';
import { TranslatePipe } from 'src/app/theme/shared/_helpers/translate.pipe';
import { TranslationService } from 'src/app/theme/shared/service/i18n/translation.service';

// L'esthéticienne crée le compte et choisit le(s) profil(s) dans le même geste. « Voir » (lectureSeule) affiche
// tout en consultation seule, mais laisse quand même agir sur le compte (nouveau mot de passe, etc.), qui n'a
// rien à voir avec la validation du formulaire.
@Component({
  selector: 'app-collaborateur-form',
  imports: [CommonModule, TranslatePipe],
  templateUrl: './collaborateur-form.component.html',
  styleUrl: './collaborateur-form.component.scss'
})
export class CollaborateurFormComponent implements OnInit {
  private i18n = inject(TranslationService);
  private equipe = inject(EquipeService);
  private confirmation = inject(ConfirmationService);
  activeModal = inject(NgbActiveModal);

  // Renseigne par la liste avant l'affichage (modification/consultation) ; vide = creation.
  collaborateur: Collaborateur | null = null;
  // Vrai : consultation seule (bouton "oeil" de la liste), les champs sont desactives.
  lectureSeule = false;

  profils = signal<Profil[]>([]);
  prenom = signal('');
  nom = signal('');
  email = signal('');
  profilCodes = signal<string[]>([]);
  actif = signal(true);
  soumis = signal(false);
  envoi = signal(false);
  envoiCompte = signal(false);
  erreur = signal('');

  ngOnInit(): void {
    const c = this.collaborateur;
    if (c) {
      this.prenom.set(c.prenom);
      this.nom.set(c.nom);
      this.email.set(c.email);
      this.profilCodes.set(c.profils.map((p) => p.code));
      this.actif.set(c.actif);
    }
    this.equipe.profils().subscribe({
      next: (liste) => this.profils.set(liste.filter((p) => p.actif || c?.profils.some((x) => x.code === p.code))),
      error: () => this.erreur.set(this.i18n.t('ts.collab.profils'))
    });
  }

  texte(cible: { set(v: string): void }, event: Event): void {
    cible.set((event.target as HTMLInputElement | HTMLSelectElement).value);
  }

  estCoche(code: string): boolean {
    return this.profilCodes().includes(code);
  }

  basculerProfil(code: string): void {
    if (this.lectureSeule) return;
    this.profilCodes.update((liste) => (liste.includes(code) ? liste.filter((c) => c !== code) : [...liste, code]));
  }

  emailValide(): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email().trim());
  }

  async enregistrer(): Promise<void> {
    this.soumis.set(true);
    const complet = this.prenom().trim() && this.nom().trim() && this.profilCodes().length > 0 && (this.collaborateur || this.emailValide());
    if (!complet || this.envoi()) return;

    const ok = await this.confirmation.demander({
      titre: this.collaborateur ? this.i18n.t('ts.form.modifs') : this.i18n.t('ts.collab.creerTitre'),
      message: `${this.prenom().trim()} ${this.nom().trim()}`,
      texteConfirmer: this.i18n.t('ts.enregistrer')
    });
    if (!ok) return;

    this.envoi.set(true);
    this.erreur.set('');

    const requete = this.collaborateur
      ? this.equipe.modifierCollaborateur(this.collaborateur.id, {
          nom: this.nom().trim(),
          prenom: this.prenom().trim(),
          profilCodes: this.profilCodes(),
          actif: this.actif()
        })
      : this.equipe.creerCollaborateur({
          email: this.email().trim(),
          nom: this.nom().trim(),
          prenom: this.prenom().trim(),
          profilCodes: this.profilCodes()
        });
    requete.subscribe({
      next: (resultat) => this.activeModal.close(this.collaborateur ? 'saved' : resultat),
      error: (err) => {
        this.envoi.set(false);
        this.erreur.set(err?.error?.message ?? this.i18n.t('ts.collab.enregistrer'));
      }
    });
  }

  // ── Compte de connexion : independant du formulaire, disponible meme en consultation ──────────

  async creerCompte(): Promise<void> {
    if (!this.collaborateur || this.envoiCompte()) return;
    const ok = await this.confirmation.demander({
      titre: this.i18n.t('ts.collab.creerCompteTitre', { nom: `${this.collaborateur.prenom} ${this.collaborateur.nom}` }),
      message: this.i18n.t('ts.collab.mdpGenere'),
      texteConfirmer: this.i18n.t('collab.creerCompte'),
      icone: 'ti-key'
    });
    if (!ok) return;
    this.envoiCompte.set(true);
    this.erreur.set('');
    this.equipe.creerCompte(this.collaborateur.id).subscribe({
      next: (resultat) => this.activeModal.close(resultat),
      error: (err) => {
        this.envoiCompte.set(false);
        this.erreur.set(err?.error?.message ?? this.i18n.t('ts.collab.compteErreur'));
      }
    });
  }

  async nouveauMotDePasse(): Promise<void> {
    if (!this.collaborateur || this.envoiCompte()) return;
    const ok = await this.confirmation.demander({
      titre: `Nouveau mot de passe pour ${this.collaborateur.prenom} ${this.collaborateur.nom} ?`,
      message: this.i18n.t('ts.collab.reinitMsg'),
      texteConfirmer: this.i18n.t('ts.collab.generer'),
      icone: 'ti-key'
    });
    if (!ok) return;
    this.envoiCompte.set(true);
    this.erreur.set('');
    this.equipe.reinitialiserMotDePasse(this.collaborateur.id).subscribe({
      next: (resultat) => this.activeModal.close(resultat),
      error: (err) => {
        this.envoiCompte.set(false);
        this.erreur.set(err?.error?.message ?? this.i18n.t('ts.collab.reinitErreur'));
      }
    });
  }
}
