import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { Collaborateur, EquipeService } from 'src/app/theme/shared/service/equipe.service';
import { CollaborateurFormComponent } from '../collaborateur-form/collaborateur-form.component';
import { ConfirmationService } from 'src/app/theme/shared/service/confirmation.service';
import { ToastService } from 'src/app/theme/shared/service/toast.service';

@Component({
  selector: 'app-collaborateur-list',
  imports: [CommonModule, FormsModule],
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
  recherche = signal('');
  // Identifiants a transmettre a la personne (affiches une seule fois)
  identifiants = signal<{ nom: string; email: string; motDePasse: string } | null>(null);
  copie = signal(false);

  // Recherche par nom, prenom ou e-mail : evite le defilement sans fin quand l'equipe est nombreuse.
  visibles = computed(() => {
    const q = this.recherche().trim().toLowerCase();
    if (!q) return this.collaborateurs();
    return this.collaborateurs().filter(
      (c) => `${c.prenom} ${c.nom}`.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
    );
  });

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

  voir(collaborateur: Collaborateur): void {
    this.ouvrir(collaborateur, true);
  }

  modifier(collaborateur: Collaborateur): void {
    this.ouvrir(collaborateur, false);
  }

  async supprimer(c: Collaborateur): Promise<void> {
    const ok = await this.confirmation.demander({
      titre: `Supprimer ${c.prenom} ${c.nom} ?`,
      message: c.compteCree ? 'Son compte de connexion sera aussi désactivé.' : 'Cette action est définitive.',
      texteConfirmer: 'Supprimer',
      danger: true
    });
    if (!ok) return;
    this.erreur.set('');
    this.equipe.supprimerCollaborateur(c.id).subscribe({
      next: () => {
        this.toast.succes('Collaborateur supprimé');
        this.charger();
      },
      error: (err) => this.toast.erreur(err?.error?.message ?? 'Suppression impossible.')
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

  private ouvrir(collaborateur: Collaborateur | null, lectureSeule = false): void {
    this.info.set('');
    this.identifiants.set(null);
    const ref = this.modals.open(CollaborateurFormComponent, { centered: true });
    ref.componentInstance.collaborateur = collaborateur;
    ref.componentInstance.lectureSeule = lectureSeule;
    ref.result.then(
      (r) => {
        if (r && typeof r === 'object') {
          const resultat = r as Collaborateur;
          if (resultat.motDePasseProvisoire) {
            this.afficherIdentifiants(resultat);
          } else if (!collaborateur) {
            this.info.set(this.messageCreation(resultat));
          }
        }
        if (r === 'saved') this.toast.succes('Collaborateur modifié');
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
