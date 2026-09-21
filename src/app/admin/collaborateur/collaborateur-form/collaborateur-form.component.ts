import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { Collaborateur, EquipeService, Profil } from 'src/app/theme/shared/service/equipe.service';

// L'esthéticienne crée le compte et choisit le profil dans le même geste ; il peut avoir plusieurs profils et choisit celui avec lequel il travaille.
@Component({
  selector: 'app-collaborateur-form',
  imports: [CommonModule],
  templateUrl: './collaborateur-form.component.html',
  styleUrl: './collaborateur-form.component.scss'
})
export class CollaborateurFormComponent implements OnInit {
  private equipe = inject(EquipeService);
  activeModal = inject(NgbActiveModal);

  // Renseigne par la liste avant l'affichage (modification) ; vide = creation.
  collaborateur: Collaborateur | null = null;
  // Vrai : on ne montre que les profils (action « Profils » de la liste)
  seulementProfils = false;

  profils = signal<Profil[]>([]);
  prenom = signal('');
  nom = signal('');
  email = signal('');
  profilCodes = signal<string[]>([]);
  actif = signal(true);
  soumis = signal(false);
  envoi = signal(false);
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
      error: () => this.erreur.set('Impossible de charger les profils.')
    });
  }

  texte(cible: { set(v: string): void }, event: Event): void {
    cible.set((event.target as HTMLInputElement | HTMLSelectElement).value);
  }

  estCoche(code: string): boolean {
    return this.profilCodes().includes(code);
  }

  basculerProfil(code: string): void {
    this.profilCodes.update((liste) => (liste.includes(code) ? liste.filter((c) => c !== code) : [...liste, code]));
  }

  emailValide(): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email().trim());
  }

  enregistrer(): void {
    this.soumis.set(true);
    const complet = this.prenom().trim() && this.nom().trim() && this.profilCodes().length > 0 && (this.collaborateur || this.emailValide());
    if (!complet || this.envoi()) return;
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
        this.erreur.set(err?.error?.message ?? "Impossible d'enregistrer le collaborateur.");
      }
    });
  }
}
