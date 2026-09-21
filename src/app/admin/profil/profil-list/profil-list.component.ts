import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { EquipeService, Profil } from 'src/app/theme/shared/service/equipe.service';
import { ProfilFormComponent } from '../profil-form/profil-form.component';
import { ConfirmationService } from 'src/app/theme/shared/service/confirmation.service';
import { ToastService } from 'src/app/theme/shared/service/toast.service';

@Component({
  selector: 'app-profil-list',
  imports: [CommonModule],
  templateUrl: './profil-list.component.html'
})
export class ProfilListComponent implements OnInit {
  private equipe = inject(EquipeService);
  private modals = inject(NgbModal);
  private confirmation = inject(ConfirmationService);
  private toast = inject(ToastService);

  profils = signal<Profil[]>([]);
  chargement = signal(true);
  erreur = signal('');

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.equipe.profils().subscribe({
      next: (liste) => {
        this.profils.set(liste);
        this.chargement.set(false);
      },
      error: (err) => {
        this.chargement.set(false);
        this.erreur.set(err?.status === 401 || err?.status === 403 ? 'Réservé à l\'esthéticienne.' : 'Impossible de charger les profils.');
      }
    });
  }

  nouveau(): void {
    this.ouvrir(null);
  }

  modifier(profil: Profil): void {
    this.ouvrir(profil);
  }

  // Consultation des ecrans attribues, sans rien pouvoir modifier
  voir(profil: Profil): void {
    this.ouvrir(profil, true);
  }

  async supprimer(profil: Profil): Promise<void> {
    const ok = await this.confirmation.demander({
      titre: `Supprimer le profil « ${profil.libelle} » ?`,
      message: 'Cette action est définitive.',
      texteConfirmer: 'Supprimer',
      danger: true
    });
    if (!ok) return;
    this.erreur.set('');
    this.equipe.supprimerProfil(profil.id).subscribe({
      next: () => {
        this.toast.succes('Profil supprimé');
        this.charger();
      },
      error: (err) => this.erreur.set(err?.error?.message ?? 'Suppression impossible.')
    });
  }

  resume(profil: Profil): string {
    const ecrans = profil.permissions.filter((p) => p.lire || p.creer || p.modifier || p.supprimer).length;
    return ecrans === 0 ? 'Aucun accès' : `${ecrans} écran${ecrans > 1 ? 's' : ''}`;
  }

  private ouvrir(profil: Profil | null, lectureSeule = false): void {
    const ref = this.modals.open(ProfilFormComponent, { centered: true, size: 'lg' });
    ref.componentInstance.profil = profil;
    ref.componentInstance.lectureSeule = lectureSeule;
    ref.result.then(
      (r) => {
        if (r === 'saved') {
          this.toast.succes('Profil enregistré');
          this.charger();
        }
      },
      () => {}
    );
  }
}
