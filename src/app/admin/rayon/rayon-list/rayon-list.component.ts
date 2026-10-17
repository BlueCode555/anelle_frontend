import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { RayonResponse, RayonService } from 'src/app/theme/shared/service/boutique.service';
import { RayonFormComponent } from '../rayon-form/rayon-form.component';
import { ConfirmationService } from 'src/app/theme/shared/service/confirmation.service';
import { ToastService } from 'src/app/theme/shared/service/toast.service';
import { TranslatePipe } from 'src/app/theme/shared/_helpers/translate.pipe';
import { TranslationService } from 'src/app/theme/shared/service/i18n/translation.service';
import { PaginationComponent } from 'src/app/theme/shared/components/pagination/pagination.component';

// Référentiel des rayons de la boutique (voir Produits) : évite les doublons/variantes du même rayon
// (« Ongles » vs « Onglerie »...) en imposant de choisir dans une liste gérée ici.
@Component({
  selector: 'app-rayon-list',
  imports: [TranslatePipe, PaginationComponent],
  templateUrl: './rayon-list.component.html',
  styleUrl: './rayon-list.component.scss'
})
export class RayonListComponent implements OnInit {
  page = signal(1);
  readonly taille = 10;
  pagees = computed(() => this.rayons().slice((this.page() - 1) * this.taille, this.page() * this.taille));

  private retourPage1 = effect(() => {
    this.rayons();
    this.page.set(1);
  });
  private i18n = inject(TranslationService);
  private rayonService = inject(RayonService);
  private modalService = inject(NgbModal);
  private confirmation = inject(ConfirmationService);
  private toast = inject(ToastService);

  rayons = signal<RayonResponse[]>([]);
  loading = signal(true);
  error = signal(false);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.rayonService.list().subscribe({
      next: (page) => {
        this.rayons.set(page.content);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      }
    });
  }

  // Un clic : active ou désactive le rayon dans les choix proposés (sans ouvrir le formulaire).
  basculer(r: RayonResponse, event: Event): void {
    const actif = (event.target as HTMLInputElement).checked;
    this.rayonService.update(r.id, { libelle: r.libelle, actif }).subscribe({
      next: () => {
        this.rayons.update((l) => l.map((x) => (x.id === r.id ? { ...x, actif } : x)));
        this.toast.succes(this.i18n.t(actif ? 'toggle.affiche' : 'toggle.masque'));
      },
      error: (err) => {
        (event.target as HTMLInputElement).checked = !actif;
        this.toast.erreur(err?.error?.message ?? this.i18n.t('ts.erreurGenerique'));
      }
    });
  }

  openCreate(): void {
    const ref = this.modalService.open(RayonFormComponent, { scrollable: true });
    ref.result.then(
      (result) => {
        if (result === 'saved') {
          this.toast.succes(this.i18n.t('ts.ray.enregistre'));
          this.load();
        }
      },
      () => {}
    );
  }

  openEdit(rayon: RayonResponse): void {
    const ref = this.modalService.open(RayonFormComponent, { scrollable: true });
    ref.componentInstance.rayon = rayon;
    ref.result.then(
      (result) => {
        if (result === 'saved') {
          this.toast.succes(this.i18n.t('ts.ray.enregistre'));
          this.load();
        }
      },
      () => {}
    );
  }

  async remove(rayon: RayonResponse): Promise<void> {
    const ok = await this.confirmation.demander({
      titre: this.i18n.t('ts.ray.supprimer', { nom: rayon.libelle }),
      message: this.i18n.t('ts.definitive'),
      texteConfirmer: this.i18n.t('ts.supprimer'),
      danger: true
    });
    if (!ok) return;
    this.rayonService.delete(rayon.id).subscribe({
      next: () => {
        this.toast.succes(this.i18n.t('ts.ray.supprime'));
        this.load();
      },
      error: (err) => this.toast.erreur(err?.error?.message ?? this.i18n.t('ts.suppressionImpossible'))
    });
  }
}
