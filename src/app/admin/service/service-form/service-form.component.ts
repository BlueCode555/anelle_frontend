import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormField, form, required } from '@angular/forms/signals';

import { CatalogueService } from 'src/app/theme/shared/service/catalogue.service';
import { CategorieResponse, ServiceForm } from 'src/app/theme/shared/service/catalogue.model';

@Component({
  selector: 'app-service-form',
  imports: [CommonModule, FormsModule, RouterModule, FormField],
  templateUrl: './service-form.component.html',
  styleUrl: './service-form.component.scss'
})
export class ServiceFormComponent implements OnInit {
  private catalogue = inject(CatalogueService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  serviceId = signal<number | null>(null);
  categories = signal<CategorieResponse[]>([]);
  submitted = signal(false);
  saving = signal(false);
  serverError = signal('');

  serviceModel = signal<ServiceForm>({
    code: '',
    nomService: '',
    categorieCode: '',
    description: '',
    dureeMinutes: null,
    tarif: null,
    actif: true
  });

  serviceForm = form(this.serviceModel, (schemaPath) => {
    required(schemaPath.code, { message: 'Le code est obligatoire' });
    required(schemaPath.nomService, { message: 'Le nom du service est obligatoire' });
    required(schemaPath.categorieCode, { message: 'La categorie est obligatoire' });
    required(schemaPath.dureeMinutes, { message: 'La duree est obligatoire' });
    required(schemaPath.tarif, { message: 'Le tarif est obligatoire' });
  });

  ngOnInit(): void {
    this.catalogue.listCategories().subscribe((page) => this.categories.set(page.content));

    const idParam = this.route.snapshot.paramMap.get('id');
    if (!idParam) {
      return;
    }
    const id = Number(idParam);
    this.serviceId.set(id);
    this.catalogue.getService(id).subscribe((service) => {
      this.serviceModel.set({
        code: service.code,
        nomService: service.nomService,
        categorieCode: service.categorieCode,
        description: service.description ?? '',
        dureeMinutes: service.dureeMinutes,
        tarif: service.tarif,
        actif: service.actif
      });
    });
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    this.submitted.set(true);
    this.serverError.set('');

    if (this.serviceForm().invalid()) {
      return;
    }

    this.saving.set(true);
    const value = this.serviceModel();
    const id = this.serviceId();
    const request = id ? this.catalogue.updateService(id, value) : this.catalogue.createService(value);

    request.subscribe({
      next: () => this.router.navigate(['/services']),
      error: (err) => {
        this.saving.set(false);
        this.serverError.set(err?.error?.message ?? 'Une erreur est survenue.');
      }
    });
  }
}
