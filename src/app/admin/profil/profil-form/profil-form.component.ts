import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { ActionCode, EcranCode, Permission } from 'src/app/theme/shared/service/auth.service';
import { EcranInfo, EquipeService, Profil } from 'src/app/theme/shared/service/equipe.service';
import { ConfirmationService } from 'src/app/theme/shared/service/confirmation.service';

interface Colonne {
  action: ActionCode;
  libelle: string;
}

// Création / modification d'un profil : nom + grille de droits (un écran par ligne, lire/créer/modifier/supprimer en colonnes).
@Component({
  selector: 'app-profil-form',
  imports: [CommonModule],
  templateUrl: './profil-form.component.html'
})
export class ProfilFormComponent implements OnInit {
  private equipe = inject(EquipeService);
  private confirmation = inject(ConfirmationService);
  activeModal = inject(NgbActiveModal);

  // Renseigne par la liste avant l'affichage (modification) ; vide = creation.
  profil: Profil | null = null;
  // Vrai : simple consultation des ecrans attribues, rien ne se modifie
  lectureSeule = false;

  readonly colonnes: Colonne[] = [
    { action: 'lire', libelle: 'Voir' },
    { action: 'creer', libelle: 'Créer' },
    { action: 'modifier', libelle: 'Modifier' },
    { action: 'supprimer', libelle: 'Supprimer' }
  ];

  ecrans = signal<EcranInfo[]>([]);
  libelle = signal('');
  description = signal('');
  actif = signal(true);
  droits = signal<Record<string, Permission>>({});
  soumis = signal(false);
  envoi = signal(false);
  erreur = signal('');

  ngOnInit(): void {
    const existant = this.profil;
    if (existant) {
      this.libelle.set(existant.libelle);
      this.description.set(existant.description ?? '');
      this.actif.set(existant.actif);
    }
    this.equipe.ecrans().subscribe({
      next: (ecrans) => {
        this.ecrans.set(ecrans);
        const droits: Record<string, Permission> = {};
        for (const e of ecrans) {
          const p = existant?.permissions.find((x) => x.ecran === e.code);
          droits[e.code] = p ? { ...p } : { ecran: e.code, lire: false, creer: false, modifier: false, supprimer: false };
        }
        this.droits.set(droits);
      },
      error: () => this.erreur.set('Impossible de charger la liste des écrans.')
    });
  }

  texte(cible: { set(v: string): void }, event: Event): void {
    cible.set((event.target as HTMLInputElement | HTMLTextAreaElement).value);
  }

  coche(ecran: EcranCode, action: ActionCode): boolean {
    return !!this.droits()[ecran]?.[action];
  }

  basculer(ecran: EcranCode, action: ActionCode, event: Event): void {
    const valeur = (event.target as HTMLInputElement).checked;
    const courant = { ...this.droits()[ecran], [action]: valeur };
    // Créer, modifier ou supprimer suppose de voir l'écran ; retirer "Voir" retire tout le reste.
    if (valeur && action !== 'lire') courant.lire = true;
    if (!valeur && action === 'lire') {
      courant.creer = courant.modifier = courant.supprimer = false;
    }
    this.droits.set({ ...this.droits(), [ecran]: courant });
  }

  async enregistrer(): Promise<void> {
    this.soumis.set(true);
    if (!this.libelle().trim() || this.envoi()) return;

    const ok = await this.confirmation.demander({
      titre: this.profil ? 'Enregistrer les modifications ?' : 'Créer ce profil ?',
      message: this.libelle().trim(),
      texteConfirmer: 'Enregistrer'
    });
    if (!ok) return;

    this.envoi.set(true);
    this.erreur.set('');
    const form = {
      libelle: this.libelle().trim(),
      description: this.description().trim() || undefined,
      actif: this.actif(),
      permissions: Object.values(this.droits()).filter((p) => p.lire || p.creer || p.modifier || p.supprimer)
    };
    const requete = this.profil ? this.equipe.modifierProfil(this.profil.id, form) : this.equipe.creerProfil(form);
    requete.subscribe({
      next: () => this.activeModal.close('saved'),
      error: (err) => {
        this.envoi.set(false);
        this.erreur.set(err?.error?.message ?? "Impossible d'enregistrer le profil.");
      }
    });
  }
}
