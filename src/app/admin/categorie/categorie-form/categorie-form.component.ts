import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FormField, form, required } from '@angular/forms/signals';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { CatalogueService } from 'src/app/theme/shared/service/catalogue.service';
import { CategorieForm } from 'src/app/theme/shared/service/catalogue.model';
import { ConfirmationService } from 'src/app/theme/shared/service/confirmation.service';
import { largeurImage } from 'src/app/theme/shared/_helpers/image-info';
import { TranslatePipe } from 'src/app/theme/shared/_helpers/translate.pipe';
import { TranslationService } from 'src/app/theme/shared/service/i18n/translation.service';

@Component({
  selector: 'app-categorie-form',
  imports: [CommonModule, FormsModule, FormField, TranslatePipe],
  templateUrl: './categorie-form.component.html',
  styleUrl: './categorie-form.component.scss'
})
export class CategorieFormComponent implements OnInit {
  private i18n = inject(TranslationService);
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
  uploadAvertissement = signal('');

  categorieModel = signal<CategorieForm>({
    libelle: '',
    description: '',
    imageUrl: '',
    actif: true
  });

  imagePreview = computed(() => this.catalogue.imageSrc(this.categorieModel().imageUrl));

  categorieForm = form(this.categorieModel, (schemaPath) => {
    required(schemaPath.libelle, { message: this.i18n.t('ts.cat.libelleObligatoire') });
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
          imageUrl: categorie.imageUrl ?? '',
          actif: categorie.actif !== false
        });
        this.chargement.set(false);
      },
      error: () => {
        this.chargement.set(false);
        this.serverError.set(this.i18n.t('ts.cat.charger'));
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

    largeurImage(file).then((l) => this.uploadAvertissement.set(l < 800 ? this.i18n.t('ts.form.petiteImage', { n: l }) : ''));
    this.uploading.set(true);
    this.catalogue.uploadImage(file).subscribe({
      next: (res) => {
        this.categorieModel.update((m) => ({ ...m, imageUrl: res.url }));
        this.uploading.set(false);
      },
      error: (err) => {
        this.uploading.set(false);
        this.uploadError.set(err?.status === 401 ? this.i18n.t('ts.form.envoiRefuse') : this.i18n.t('ts.form.envoiEchec'));
      }
    });
  }

  onImageUrlInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value.trim();
    this.uploadError.set('');
    this.categorieModel.update((m) => ({ ...m, imageUrl: value }));
  }

  async removeImage(): Promise<void> {
    const ok = await this.confirmation.demander({ titre: this.i18n.t('ts.form.retirerImage'), texteConfirmer: this.i18n.t('a.retirer'), danger: true });
    if (ok) {
      this.categorieModel.update((m) => ({ ...m, imageUrl: '' }));
    }
  }

  private messageErreur(err: { status?: number; error?: { message?: string } }): string {
    if (err?.status === 401 || err?.status === 403) {
      return this.i18n.t('ts.form.actionRefusee');
    }
    return err?.error?.message ?? this.i18n.t('ts.erreurGenerique');
  }

  async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.submitted.set(true);
    this.serverError.set('');

    if (this.categorieForm().invalid()) {
      return;
    }

    const ok = await this.confirmation.demander({
      titre: this.categorieId ? this.i18n.t('ts.form.modifs') : this.i18n.t('ts.cat.enregistrer'),
      message: this.categorieModel().libelle,
      texteConfirmer: this.i18n.t('ts.enregistrer')
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
