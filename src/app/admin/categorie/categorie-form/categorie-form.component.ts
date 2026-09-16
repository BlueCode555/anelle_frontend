import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormField, form, required } from '@angular/forms/signals';

import { CatalogueService } from 'src/app/theme/shared/service/catalogue.service';
import { CategorieForm } from 'src/app/theme/shared/service/catalogue.model';

@Component({
  selector: 'app-categorie-form',
  imports: [CommonModule, FormsModule, RouterModule, FormField],
  templateUrl: './categorie-form.component.html',
  styleUrl: './categorie-form.component.scss'
})
export class CategorieFormComponent implements OnInit {
  private catalogue = inject(CatalogueService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  categorieId = signal<number | null>(null);
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
    const idParam = this.route.snapshot.paramMap.get('id');
    if (!idParam) {
      return;
    }
    const id = Number(idParam);
    this.categorieId.set(id);
    this.catalogue.getCategorie(id).subscribe((categorie) => {
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
    const id = this.categorieId();
    const request = id ? this.catalogue.updateCategorie(id, value) : this.catalogue.createCategorie(value);

    request.subscribe({
      next: () => this.router.navigate(['/categories']),
      error: (err) => {
        this.saving.set(false);
        this.serverError.set(err?.error?.message ?? 'Une erreur est survenue.');
      }
    });
  }
}
