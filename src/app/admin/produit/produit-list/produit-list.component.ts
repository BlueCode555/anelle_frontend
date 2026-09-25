import { Component, OnInit, computed, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { ProduitResponse, ProduitService } from 'src/app/theme/shared/service/boutique.service';
import { ConfirmationService } from 'src/app/theme/shared/service/confirmation.service';
import { TranslationService } from 'src/app/theme/shared/service/i18n/translation.service';
import { ToastService } from 'src/app/theme/shared/service/toast.service';
import { TranslatePipe } from 'src/app/theme/shared/_helpers/translate.pipe';
import { localeCourante } from 'src/app/theme/shared/_helpers/zoned-time';
import { ProduitFormComponent } from '../produit-form/produit-form.component';
import { PaginationComponent } from 'src/app/theme/shared/components/pagination/pagination.component';

@Component({
  selector: 'app-produit-list',
  imports: [CommonModule, TranslatePipe, PaginationComponent],
  templateUrl: './produit-list.component.html',
  styleUrl: './produit-list.component.scss'
})
export class ProduitListComponent implements OnInit {
  page = signal(1);
  readonly taille = 10;
  pagees = computed(() => this.liste().slice((this.page() - 1) * this.taille, this.page() * this.taille));

  private retourPage1 = effect(() => {
    this.liste();
    this.page.set(1);
  });
  private i18n = inject(TranslationService);
  private produits = inject(ProduitService);
  private modalService = inject(NgbModal);
  private confirmation = inject(ConfirmationService);
  private toast = inject(ToastService);

  liste = signal<ProduitResponse[]>([]);
  loading = signal(true);
  error = signal(false);
  enRupture = computed(() => this.liste().filter((p) => p.actif && p.stock === 0).length);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.produits.list().subscribe({
      next: (page) => {
        this.liste.set(page.content);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      }
    });
  }

  formatPrix(prix: number): string {
    return new Intl.NumberFormat(localeCourante(), { style: 'currency', currency: 'CAD' }).format(prix);
  }

  imageSrc(url?: string | null): string | null {
    return this.produits.imageSrc(url);
  }

  // Un clic : affiche ou masque le produit dans la boutique (sans ouvrir le formulaire).
  basculer(p: ProduitResponse, event: Event): void {
    const actif = (event.target as HTMLInputElement).checked;
    this.produits
      .update(p.id, {
        nom: p.nom,
        rayon: p.rayon ?? '',
        description: p.description ?? '',
        prix: p.prix,
        stock: p.stock,
        actif,
        imageUrl: p.imageUrl ?? ''
      })
      .subscribe({
        next: () => {
          this.liste.update((l) => l.map((x) => (x.id === p.id ? { ...x, actif } : x)));
          this.toast.succes(this.i18n.t(actif ? 'toggle.affiche' : 'toggle.masque'));
        },
        error: (err) => {
          (event.target as HTMLInputElement).checked = !actif;
          this.toast.erreur(err?.error?.message ?? this.i18n.t('ts.erreurGenerique'));
        }
      });
  }

  openCreate(): void {
    this.ouvrir(null);
  }

  openEdit(p: ProduitResponse): void {
    this.ouvrir(p.id);
  }

  private ouvrir(id: number | null): void {
    const ref = this.modalService.open(ProduitFormComponent, { centered: true, size: 'lg' });
    ref.componentInstance.produitId = id;
    ref.result.then(
      (result) => {
        if (result === 'saved') {
          this.toast.succes(this.i18n.t('ts.prd.enregistre'));
          this.load();
        }
      },
      () => {}
    );
  }

  async remove(p: ProduitResponse): Promise<void> {
    const ok = await this.confirmation.demander({
      titre: this.i18n.t('ts.prd.supprimer', { nom: p.nom }),
      message: this.i18n.t('ts.definitive'),
      texteConfirmer: this.i18n.t('ts.supprimer'),
      danger: true
    });
    if (!ok) {
      return;
    }
    this.produits.delete(p.id).subscribe({
      next: () => {
        this.toast.succes(this.i18n.t('ts.prd.supprime'));
        this.load();
      },
      error: (err) => this.toast.erreur(err?.error?.message ?? this.i18n.t('ts.suppressionImpossible'))
    });
  }
}
