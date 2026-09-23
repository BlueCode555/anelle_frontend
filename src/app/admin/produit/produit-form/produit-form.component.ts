import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FormField, form, min, required } from '@angular/forms/signals';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { ProduitForm, ProduitService } from 'src/app/theme/shared/service/boutique.service';
import { ConfirmationService } from 'src/app/theme/shared/service/confirmation.service';
import { TranslationService } from 'src/app/theme/shared/service/i18n/translation.service';
import { TranslatePipe } from 'src/app/theme/shared/_helpers/translate.pipe';

@Component({
  selector: 'app-produit-form',
  imports: [CommonModule, FormsModule, FormField, TranslatePipe],
  templateUrl: './produit-form.component.html',
  styleUrl: './produit-form.component.scss'
})
export class ProduitFormComponent implements OnInit {
  private i18n = inject(TranslationService);
  private produits = inject(ProduitService);
  activeModal = inject(NgbActiveModal);
  private confirmation = inject(ConfirmationService);

  // Renseigné par la liste (via componentInstance) avant l'affichage ; null = création.
  produitId: number | null = null;

  chargement = signal(false);
  submitted = signal(false);
  saving = signal(false);
  serverError = signal('');
  uploading = signal(false);
  uploadError = signal('');

  produitModel = signal<ProduitForm>({
    nom: '',
    rayon: '',
    description: '',
    prix: null,
    stock: 0,
    actif: true,
    imageUrl: ''
  });

  imagePreview = computed(() => this.produits.imageSrc(this.produitModel().imageUrl));

  produitForm = form(this.produitModel, (schemaPath) => {
    required(schemaPath.nom, { message: this.i18n.t('ts.prd.nom') });
    required(schemaPath.prix, { message: this.i18n.t('ts.prd.prix') });
    min(schemaPath.prix, 0.01, { message: this.i18n.t('ts.prd.prix') });
    required(schemaPath.stock, { message: this.i18n.t('ts.prd.stock') });
    min(schemaPath.stock, 0, { message: this.i18n.t('ts.prd.stock') });
  });

  ngOnInit(): void {
    if (!this.produitId) {
      return;
    }
    this.chargement.set(true);
    this.produits.get(this.produitId).subscribe({
      next: (p) => {
        this.produitModel.set({
          nom: p.nom,
          rayon: p.rayon ?? '',
          description: p.description ?? '',
          prix: p.prix,
          stock: p.stock,
          actif: p.actif,
          imageUrl: p.imageUrl ?? ''
        });
        this.chargement.set(false);
      },
      error: () => {
        this.chargement.set(false);
        this.serverError.set(this.i18n.t('ts.prd.charger'));
      }
    });
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    this.uploadError.set('');
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type)) {
      this.uploadError.set(this.i18n.t('ts.form.format'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.uploadError.set(this.i18n.t('ts.form.trop'));
      return;
    }
    this.uploading.set(true);
    this.produits.uploadImage(file).subscribe({
      next: (res) => {
        this.produitModel.update((m) => ({ ...m, imageUrl: res.url }));
        this.uploading.set(false);
      },
      error: (err) => {
        this.uploading.set(false);
        this.uploadError.set(err?.status === 401 ? this.i18n.t('ts.form.envoiRefuse') : this.i18n.t('ts.form.envoiEchec'));
      }
    });
  }

  onImageUrlInput(event: Event): void {
    this.uploadError.set('');
    this.produitModel.update((m) => ({ ...m, imageUrl: (event.target as HTMLInputElement).value.trim() }));
  }

  removeImage(): void {
    this.produitModel.update((m) => ({ ...m, imageUrl: '' }));
  }

  async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.submitted.set(true);
    this.serverError.set('');
    if (this.produitForm().invalid()) {
      return;
    }
    const ok = await this.confirmation.demander({
      titre: this.produitId ? this.i18n.t('ts.form.modifs') : this.i18n.t('ts.prd.enregistrer'),
      message: this.produitModel().nom,
      texteConfirmer: this.i18n.t('ts.enregistrer')
    });
    if (!ok) {
      return;
    }
    this.saving.set(true);
    const value = this.produitModel();
    const request = this.produitId ? this.produits.update(this.produitId, value) : this.produits.create(value);
    request.subscribe({
      next: () => this.activeModal.close('saved'),
      error: (err) => {
        this.saving.set(false);
        this.serverError.set(
          err?.status === 401 || err?.status === 403 ? this.i18n.t('ts.form.actionRefusee') : (err?.error?.message ?? this.i18n.t('ts.erreurGenerique'))
        );
      }
    });
  }
}
