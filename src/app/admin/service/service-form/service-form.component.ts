import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FormField, form, required } from '@angular/forms/signals';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { CatalogueService } from 'src/app/theme/shared/service/catalogue.service';
import { CategorieResponse, ServiceForm } from 'src/app/theme/shared/service/catalogue.model';
import { ConfirmationService } from 'src/app/theme/shared/service/confirmation.service';

@Component({
  selector: 'app-service-form',
  imports: [CommonModule, FormsModule, FormField],
  templateUrl: './service-form.component.html',
  styleUrl: './service-form.component.scss'
})
export class ServiceFormComponent implements OnInit {
  private catalogue = inject(CatalogueService);
  activeModal = inject(NgbActiveModal);
  private confirmation = inject(ConfirmationService);

  // Set by the opener (list component) via modalRef.componentInstance.serviceId before the modal renders.
  serviceId: number | null = null;

  categories = signal<CategorieResponse[]>([]);
  submitted = signal(false);
  saving = signal(false);
  serverError = signal('');
  uploading = signal(false);
  uploadError = signal('');

  serviceModel = signal<ServiceForm>({
    nomService: '',
    categorieCode: '',
    description: '',
    dureeMinutes: null,
    tarif: null,
    actif: true,
    imageUrl: ''
  });

  imagePreview = computed(() => this.catalogue.imageSrc(this.serviceModel().imageUrl));

  serviceForm = form(this.serviceModel, (schemaPath) => {
    required(schemaPath.nomService, { message: 'Le nom du service est obligatoire' });
    required(schemaPath.categorieCode, { message: 'La categorie est obligatoire' });
    required(schemaPath.dureeMinutes, { message: 'La duree est obligatoire' });
    required(schemaPath.tarif, { message: 'Le tarif est obligatoire' });
  });

  ngOnInit(): void {
    this.catalogue.listCategories().subscribe((page) => this.categories.set(page.content));

    if (!this.serviceId) {
      return;
    }
    this.catalogue.getService(this.serviceId).subscribe((service) => {
      this.serviceModel.set({
        nomService: service.nomService,
        categorieCode: service.categorieCode,
        description: service.description ?? '',
        dureeMinutes: service.dureeMinutes,
        tarif: service.tarif,
        actif: service.actif,
        imageUrl: service.imageUrl ?? ''
      });
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
        this.serviceModel.update((m) => ({ ...m, imageUrl: res.url }));
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
    this.serviceModel.update((m) => ({ ...m, imageUrl: value }));
  }

  removeImage(): void {
    this.serviceModel.update((m) => ({ ...m, imageUrl: '' }));
  }

  async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.submitted.set(true);
    this.serverError.set('');

    if (this.serviceForm().invalid()) {
      return;
    }

    const ok = await this.confirmation.demander({
      titre: this.serviceId ? 'Enregistrer les modifications ?' : 'Enregistrer ce service ?',
      message: this.serviceModel().nomService,
      texteConfirmer: 'Enregistrer'
    });
    if (!ok) {
      return;
    }

    this.saving.set(true);
    const value = this.serviceModel();
    const request = this.serviceId ? this.catalogue.updateService(this.serviceId, value) : this.catalogue.createService(value);

    request.subscribe({
      next: () => this.activeModal.close('saved'),
      error: (err) => {
        this.saving.set(false);
        this.serverError.set(err?.status === 401 || err?.status === 403 ? 'Action refusee : la connexion du personnel est requise.' : (err?.error?.message ?? 'Une erreur est survenue.'));
      }
    });
  }
}
