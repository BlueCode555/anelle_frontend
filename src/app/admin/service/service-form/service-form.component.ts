import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FormField, form, required } from '@angular/forms/signals';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { CatalogueService } from 'src/app/theme/shared/service/catalogue.service';
import { CategorieResponse, ServiceForm } from 'src/app/theme/shared/service/catalogue.model';
import { ConfirmationService } from 'src/app/theme/shared/service/confirmation.service';
import { largeurImage } from 'src/app/theme/shared/_helpers/image-info';
import { DureePipe } from 'src/app/theme/shared/_helpers/duree.pipe';
import { TranslatePipe } from 'src/app/theme/shared/_helpers/translate.pipe';
import { TranslationService } from 'src/app/theme/shared/service/i18n/translation.service';

@Component({
  selector: 'app-service-form',
  imports: [CommonModule, FormsModule, FormField, TranslatePipe, DureePipe],
  templateUrl: './service-form.component.html',
  styleUrl: './service-form.component.scss'
})
export class ServiceFormComponent implements OnInit {
  private i18n = inject(TranslationService);
  private catalogue = inject(CatalogueService);
  activeModal = inject(NgbActiveModal);
  private confirmation = inject(ConfirmationService);

  // Set by the opener (list component) via modalRef.componentInstance.serviceId before the modal renders.
  serviceId: number | null = null;

  categories = signal<CategorieResponse[]>([]);
  // Vrai pendant la recuperation du service existant : le formulaire reste cache pour ne jamais
  // laisser voir des champs vides le temps que la reponse du serveur arrive (effet "pas prerempli").
  chargement = signal(false);
  submitted = signal(false);
  saving = signal(false);
  serverError = signal('');
  uploading = signal(false);
  uploadError = signal('');
  uploadAvertissement = signal('');

  serviceModel = signal<ServiceForm>({
    nomService: '',
    categorieCode: '',
    description: '',
    dureeMinutes: null,
    tarif: null,
    actif: true,
    imageUrl: ''
  });

  // La duree se saisit en heures + minutes ; le serveur ne connait que des minutes.
  dureeHeures = computed(() => (this.serviceModel().dureeMinutes ? Math.floor(this.serviceModel().dureeMinutes! / 60) : ''));
  dureeMin = computed(() => (this.serviceModel().dureeMinutes ? this.serviceModel().dureeMinutes! % 60 : ''));

  onDuree(event: Event, unite: 'h' | 'm'): void {
    const saisie = Math.max(0, Math.floor(Number((event.target as HTMLInputElement).value) || 0));
    const actuel = this.serviceModel().dureeMinutes ?? 0;
    const heures = unite === 'h' ? saisie : Math.floor(actuel / 60);
    const minutes = unite === 'm' ? saisie : actuel % 60;
    const total = heures * 60 + minutes;
    this.serviceModel.update((m) => ({ ...m, dureeMinutes: total > 0 ? total : null }));
  }

  imagePreview = computed(() => this.catalogue.imageSrc(this.serviceModel().imageUrl));

  serviceForm = form(this.serviceModel, (schemaPath) => {
    required(schemaPath.nomService, { message: this.i18n.t('ts.srv.nom') });
    required(schemaPath.categorieCode, { message: this.i18n.t('ts.srv.categorie') });
    required(schemaPath.dureeMinutes, { message: this.i18n.t('ts.srv.duree') });
    required(schemaPath.tarif, { message: this.i18n.t('ts.srv.tarif') });
  });

  ngOnInit(): void {
    this.catalogue.listCategories().subscribe((page) => this.categories.set(page.content));

    if (!this.serviceId) {
      return;
    }
    this.chargement.set(true);
    this.catalogue.getService(this.serviceId).subscribe({
      next: (service) => {
        this.serviceModel.set({
          nomService: service.nomService,
          categorieCode: service.categorieCode,
          description: service.description ?? '',
          dureeMinutes: service.dureeMinutes,
          tarif: service.tarif,
          actif: service.actif,
          imageUrl: service.imageUrl ?? ''
        });
        this.chargement.set(false);
      },
      error: () => {
        this.chargement.set(false);
        this.serverError.set(this.i18n.t('ts.srv.charger'));
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
        this.serviceModel.update((m) => ({ ...m, imageUrl: res.url }));
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
    this.serviceModel.update((m) => ({ ...m, imageUrl: value }));
  }

  async removeImage(): Promise<void> {
    const ok = await this.confirmation.demander({ titre: this.i18n.t('ts.form.retirerImage'), texteConfirmer: this.i18n.t('a.retirer'), danger: true });
    if (ok) {
      this.serviceModel.update((m) => ({ ...m, imageUrl: '' }));
    }
  }

  async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.submitted.set(true);
    this.serverError.set('');

    if (this.serviceForm().invalid()) {
      return;
    }

    const ok = await this.confirmation.demander({
      titre: this.serviceId ? this.i18n.t('ts.form.modifs') : this.i18n.t('ts.srv.enregistrer'),
      message: this.serviceModel().nomService,
      texteConfirmer: this.i18n.t('ts.enregistrer')
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
        this.serverError.set(err?.status === 401 || err?.status === 403 ? this.i18n.t('ts.form.actionRefusee') : (err?.error?.message ?? this.i18n.t('ts.erreurGenerique')));
      }
    });
  }
}
