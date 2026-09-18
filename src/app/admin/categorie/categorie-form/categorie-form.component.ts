import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FormField, form, required } from '@angular/forms/signals';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { CatalogueService } from 'src/app/theme/shared/service/catalogue.service';
import { CategorieForm } from 'src/app/theme/shared/service/catalogue.model';

@Component({
  selector: 'app-categorie-form',
  imports: [CommonModule, FormsModule, FormField],
  templateUrl: './categorie-form.component.html',
  styleUrl: './categorie-form.component.scss'
})
export class CategorieFormComponent implements OnInit {
  private catalogue = inject(CatalogueService);
  activeModal = inject(NgbActiveModal);

  // Set by the opener (list component) via modalRef.componentInstance.categorieId before the modal renders.
  categorieId: number | null = null;

  submitted = signal(false);
  saving = signal(false);
  serverError = signal('');

  categorieModel = signal<CategorieForm>({
    code: '',
    libelle: '',
    description: ''
  });

  categorieForm = form(this.categorieModel, (schemaPath) => {
    required(schemaPath.code, { message: 'Le code est obligatoire' });
    required(schemaPath.libelle, { message: 'Le libelle est obligatoire' });
  });

  ngOnInit(): void {
    if (!this.categorieId) {
      return;
    }
    this.catalogue.getCategorie(this.categorieId).subscribe((categorie) => {
      this.categorieModel.set({
        code: categorie.code,
        libelle: categorie.libelle,
        description: categorie.description ?? ''
      });
    });
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    this.submitted.set(true);
    this.serverError.set('');

    if (this.categorieForm().invalid()) {
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
        this.serverError.set(err?.error?.message ?? 'Une erreur est survenue.');
      }
    });
  }
}
