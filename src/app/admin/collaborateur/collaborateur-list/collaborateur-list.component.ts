import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { Collaborateur, EquipeService } from 'src/app/theme/shared/service/equipe.service';
import { CollaborateurFormComponent } from '../collaborateur-form/collaborateur-form.component';
import { ConfirmationService } from 'src/app/theme/shared/service/confirmation.service';
import { ToastService } from 'src/app/theme/shared/service/toast.service';

@Component({
  selector: 'app-collaborateur-list',
  imports: [CommonModule],
  templateUrl: './collaborateur-list.component.html',
  styleUrl: './collaborateur-list.component.scss'
})
export class CollaborateurListComponent implements OnInit {
  private equipe = inject(EquipeService);
  private modals = inject(NgbModal);
  private confirmation = inject(ConfirmationService);
  private toast = inject(ToastService);

  collaborateurs = signal<Collaborateur[]>([]);
  chargement = signal(true);
  erreur = signal('');
  info = signal('');
  // Identifiants a transmettre a la personne (affiches une seule fois)
  identifiants = signal<{ nom: string; email: string; motDePasse: string } | null>(null);
  copie = signal(false);

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.equipe.collaborateurs().subscribe({
      next: (liste) => {
        this.collaborateurs.set(liste);
        this.chargement.set(false);
      },
      error: (err) => {
        this.chargement.set(false);
        this.erreur.set(err?.status === 401 || err?.status === 403 ? "Réservé à l'esthéticienne." : 'Impossible de charger les collaborateurs.');
      }
    });
  }

  nouveau(): void {
    this.ouvrir(null);
  }

  modifier(collaborateur: Collaborateur): void {
    this.ouvrir(collaborateur);
  }

  // Ajouter ou retirer des profils (cases a cocher)
  gererProfils(collaborateur: Collaborateur): void {
    this.ouvrir(collaborateur, true);
  }

  // Retire un profil d'un clic (apres confirmation) ; la personne doit toujours en garder au moins un.
  async retirerProfil(c: Collaborateur, code: string): Promise<void> {
    const profil = c.profils.find((p) => p.code === code);
    if (!profil || c.profils.length < 2) return;
    const ok = await this.confirmation.demander({
      titre: `Retirer le profil « ${profil.libelle} » ?`,
      message: `${c.prenom} ${c.nom} n'aura plus les droits de ce profil.`,
      texteConfirmer: 'Retirer',
      danger: true
    });
    if (!ok) return;
    this.erreur.set('');
    this.equipe
      .modifierCollaborateur(c.id, {
        nom: c.nom,
        prenom: c.prenom,
        actif: c.actif,
        profilCodes: c.profils.filter((p) => p.code !== code).map((p) => p.code)
      })
      .subscribe({
        next: () => {
          this.toast.succes('Profil retiré');
          this.charger();
        },
        error: (err) => this.toast.erreur(err?.error?.message ?? 'Impossible de retirer ce profil.')
      });
  }

  async reinitialiser(c: Collaborateur): Promise<void> {
    const ok = await this.confirmation.demander({
      titre: `Nouveau mot de passe pour ${c.prenom} ${c.nom} ?`,
      message: "Un mot de passe provisoire sera généré. L'ancien ne fonctionnera plus.",
      texteConfirmer: 'Générer',
      icone: 'ti-key'
    });
    if (!ok) return;
    this.info.set('');
    this.erreur.set('');
    this.equipe.reinitialiserMotDePasse(c.id).subscribe({
      next: (r) => this.afficherIdentifiants(r),
      error: (err) => this.erreur.set(err?.error?.message ?? 'Impossible de réinitialiser le mot de passe.')
    });
  }

  // Collaborateur enregistre sans compte de connexion : on le cree maintenant.
  creerCompte(c: Collaborateur): void {
    this.info.set('');
    this.erreur.set('');
    this.equipe.creerCompte(c.id).subscribe({
      next: (r) => {
        this.afficherIdentifiants(r);
        this.charger();
      },
      error: (err) => this.erreur.set(err?.error?.message ?? 'Impossible de créer le compte de connexion.')
    });
  }

  fermerIdentifiants(): void {
    this.identifiants.set(null);
    this.copie.set(false);
  }

  copier(texte: string): void {
    navigator.clipboard?.writeText(texte).then(
      () => this.copie.set(true),
      () => this.copie.set(false)
    );
  }

  private afficherIdentifiants(c: Collaborateur): void {
    this.copie.set(false);
    this.identifiants.set(c.motDePasseProvisoire ? { nom: `${c.prenom} ${c.nom}`, email: c.email, motDePasse: c.motDePasseProvisoire } : null);
  }

  private ouvrir(collaborateur: Collaborateur | null, seulementProfils = false): void {
    this.info.set('');
    this.identifiants.set(null);
    const ref = this.modals.open(CollaborateurFormComponent, { centered: true });
    ref.componentInstance.collaborateur = collaborateur;
    ref.componentInstance.seulementProfils = seulementProfils;
    ref.result.then(
      (r) => {
        if (r && typeof r === 'object') {
          const cree = r as Collaborateur;
          if (cree.motDePasseProvisoire) {
            this.afficherIdentifiants(cree);
          } else {
            this.info.set(this.messageCreation(cree));
          }
        }
        if (r === 'saved') this.toast.succes(seulementProfils ? 'Profils mis à jour' : 'Collaborateur modifié');
        if (r) this.charger();
      },
      () => {}
    );
  }

  // Compte de connexion non cree automatiquement (connexion a Keycloak non configuree cote serveur).
  private messageCreation(c: Collaborateur): string {
    return `${c.prenom} ${c.nom} a été enregistré(e), mais son compte de connexion n'a pas pu être créé automatiquement. Contactez la personne qui gère l'application (adresse : ${c.email}).`;
  }
}
