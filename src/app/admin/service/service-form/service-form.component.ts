import { Component, OnInit, computed, inject, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { FormField, form, min, required } from '@angular/forms/signals';
import { ActivatedRoute, Router } from '@angular/router';

import { CatalogueService } from 'src/app/theme/shared/service/catalogue.service';
import { CategorieResponse, ServiceForm } from 'src/app/theme/shared/service/catalogue.model';
import { ConfirmationService } from 'src/app/theme/shared/service/confirmation.service';
import { ToastService } from 'src/app/theme/shared/service/toast.service';
import { largeurImage } from 'src/app/theme/shared/_helpers/image-info';
import { DureePipe } from 'src/app/theme/shared/_helpers/duree.pipe';
import { TranslatePipe } from 'src/app/theme/shared/_helpers/translate.pipe';
import { bloquerCaracteresInterdits } from 'src/app/theme/shared/_helpers/nombre-entier';
import { TranslationService } from 'src/app/theme/shared/service/i18n/translation.service';

// Page pleine (et non plus une fenêtre modale) : un formulaire avec autant de champs (catégorie, durée, tarif,
// image...) débordait d'une modale sur les petits écrans. Créer/Modifier partagent ce même composant, selon
// la présence d'un ":id" dans la route (/services/nouveau ou /services/:id/modifier).
@Component({
  selector: 'app-service-form',
  imports: [FormsModule, FormField, TranslatePipe, DureePipe],
  templateUrl: './service-form.component.html',
  styleUrl: './service-form.component.scss'
})
export class ServiceFormComponent implements OnInit {
  bloquerCaracteresInterdits = bloquerCaracteresInterdits;
  private i18n = inject(TranslationService);
  private catalogue = inject(CatalogueService);
  private confirmation = inject(ConfirmationService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  // Lu une seule fois depuis l'URL : présent (/services/:id/modifier) = modification, absent = création.
  serviceId: number | null = Number(this.route.snapshot.paramMap.get('id')) || null;

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
    nomServiceEn: '',
    categorieCode: '',
    description: '',
    dureeMinutes: null,
    tarif: null,
    actif: true,
    imageUrl: ''
  });

  // Un seul champ, en minutes : deux champs séparés (heures + minutes qui s'additionnent) prêtaient à confusion
  // (ex. taper "10" dans "heures" en pensant saisir des minutes donnait 10 h au lieu de 10 min).
  onDuree(event: Event): void {
    const saisie = Math.max(0, Math.floor(Number((event.target as HTMLInputElement).value) || 0));
    this.serviceModel.update((m) => ({ ...m, dureeMinutes: saisie > 0 ? saisie : null }));
  }

  imagePreview = computed(() => this.catalogue.imageSrc(this.serviceModel().imageUrl));

  serviceForm = form(this.serviceModel, (schemaPath) => {
    required(schemaPath.nomService, { message: this.i18n.t('ts.srv.nom') });
    required(schemaPath.categorieCode, { message: this.i18n.t('ts.srv.categorie') });
    required(schemaPath.dureeMinutes, { message: this.i18n.t('ts.srv.duree') });
    required(schemaPath.tarif, { message: this.i18n.t('ts.srv.tarif') });
    min(schemaPath.tarif, 0, { message: this.i18n.t('ts.srv.tarifMin') });
    // Publier sans image donnerait une carte vide sur le site : l'image n'est obligatoire que si l'élément est visible.
    required(schemaPath.imageUrl, { when: ({ valueOf }) => valueOf(schemaPath.actif), message: this.i18n.t('ts.form.imagePublication') });
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
          nomServiceEn: service.nomServiceEn ?? '',
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
    const ok = await this.confirmation.demander({
      titre: this.i18n.t('ts.form.retirerImage'),
      texteConfirmer: this.i18n.t('a.retirer'),
      danger: true
    });
    if (ok) {
      this.serviceModel.update((m) => ({ ...m, imageUrl: '' }));
    }
  }

  retour(): void {
    this.router.navigate(['/services']);
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
      next: () => {
        this.toast.succes(this.i18n.t('ts.srv.enregistre'));
        this.router.navigate(['/services']);
      },
      error: (err) => {
        this.saving.set(false);
        this.serverError.set(
          err?.status === 401 || err?.status === 403
            ? this.i18n.t('ts.form.actionRefusee')
            : (err?.error?.message ?? this.i18n.t('ts.erreurGenerique'))
        );
      }
    });
  }
}
