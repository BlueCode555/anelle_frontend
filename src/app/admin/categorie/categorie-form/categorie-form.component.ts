import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FormField, form, required } from '@angular/forms/signals';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { CatalogueService } from 'src/app/theme/shared/service/catalogue.service';
import { CategorieForm } from 'src/app/theme/shared/service/catalogue.model';
import { ConfirmationService } from 'src/app/theme/shared/service/confirmation.service';

@Component({
  selector: 'app-categorie-form',
  imports: [CommonModule, FormsModule, FormField],
  templateUrl: './categorie-form.component.html',
  styleUrl: './categorie-form.component.scss'
})
export class CategorieFormComponent implements OnInit {
  private catalogue = inject(CatalogueService);
  activeModal = inject(NgbActiveModal);
  private confirmation = inject(ConfirmationService);

  // Set by the opener (list component) via modalRef.componentInstance.categorieId before the modal renders.
  categorieId: number | null = null;

  // Vrai pendant la recuperation de la categorie existante : le formulaire reste cache pour ne jamais
  // laisser voir des champs vides le temps que la reponse du serveur arrive (effet "pas prerempli").
  chargement = signal(false);
  submitted = signal(false);
  saving = signal(false);
  serverError = signal('');
  uploading = signal(false);
  uploadError = signal('');

  categorieModel = signal<CategorieForm>({
    libelle: '',
    description: '',
    imageUrl: ''
  });

  imagePreview = computed(() => this.catalogue.imageSrc(this.categorieModel().imageUrl));

  categorieForm = form(this.categorieModel, (schemaPath) => {
    required(schemaPath.libelle, { message: 'Le libelle est obligatoire' });
  });

  ngOnInit(): void {
    if (!this.categorieId) {
      return;
    }
    this.chargement.set(true);
    this.catalogue.getCategorie(this.categorieId).subscribe({
      next: (categorie) => {
        this.categorieModel.set({
          libelle: categorie.libelle,
          description: categorie.description ?? '',
          imageUrl: categorie.imageUrl ?? ''
        });
        this.chargement.set(false);
      },
      error: () => {
        this.chargement.set(false);
        this.serverError.set('Impossible de charger cette catégorie.');
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
      this.uploadError.set('Format non supporte : JPEG, PNG, WebP ou AVIF.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.uploadError.set('Image trop lourde (5 Mo maximum).');
      return;
    }

    this.uploading.set(true);
    this.catalogue.uploadImage(file).subscribe({
      next: (res) => {
        this.categorieModel.update((m) => ({ ...m, imageUrl: res.url }));
        this.uploading.set(false);
      },
      error: (err) => {
        this.uploading.set(false);
        this.uploadError.set(err?.status === 401 ? "Envoi refuse : vous n'etes pas connecte." : "Echec de l'envoi de l'image.");
      }
    });
  }

  onImageUrlInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value.trim();
    this.uploadError.set('');
    this.categorieModel.update((m) => ({ ...m, imageUrl: value }));
  }

  removeImage(): void {
    this.categorieModel.update((m) => ({ ...m, imageUrl: '' }));
  }

  private messageErreur(err: { status?: number; error?: { message?: string } }): string {
    if (err?.status === 401 || err?.status === 403) {
      return "Action refusee : la connexion du personnel est requise.";
    }
    return err?.error?.message ?? 'Une erreur est survenue.';
  }

  async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.submitted.set(true);
    this.serverError.set('');

    if (this.categorieForm().invalid()) {
      return;
    }

    const ok = await this.confirmation.demander({
      titre: this.categorieId ? 'Enregistrer les modifications ?' : 'Enregistrer cette catégorie ?',
      message: this.categorieModel().libelle,
      texteConfirmer: 'Enregistrer'
    });
    if (!ok) {
      return;
    }

    this.saving.set(true);
    const value = this.categorieModel();
    const request = this.categorieId
      ? this.catalogue.updateCategorie(this.categorieId, value)
      : this.catalogue.createCategorie(value);

    request.subscribe({
      next: () => this.activeModal.close('saved'),
      error: (err) => {
        this.saving.set(false);
        this.serverError.set(this.messageErreur(err));
      }
    });
  }
}
