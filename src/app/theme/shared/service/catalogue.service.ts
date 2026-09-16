import { Injectable, inject } from '@angular/core';

import { ApiService } from './api.service';
import { PaginationCriteria } from './api.model';
import { CategorieForm, CategorieResponse, ServiceForm, ServiceResponse } from './catalogue.model';

// Resource-specific wrapper over ApiService for the catalogue (categories + services),
// used both by the public vitrine (read-only) and the back-office management screens.
@Injectable({ providedIn: 'root' })
export class CatalogueService {
  private api = inject(ApiService);

  listCategories(criteria: PaginationCriteria = { size: 100 }) {
    return this.api.list<CategorieResponse>('categories', criteria);
  }

  getCategorie(id: number) {
    return this.api.findOne<CategorieResponse>('categories', id);
  }

  createCategorie(form: CategorieForm) {
    return this.api.create<CategorieResponse>('categories', form);
  }

  updateCategorie(id: number, form: CategorieForm) {
    return this.api.update<CategorieResponse>('categories', id, form);
  }

  deleteCategorie(id: number) {
    return this.api.delete('categories', id);
  }

  listServices(criteria: PaginationCriteria = { size: 100 }) {
    return this.api.list<ServiceResponse>('services', criteria);
  }

  getService(id: number) {
    return this.api.findOne<ServiceResponse>('services', id);
  }

  createService(form: ServiceForm) {
    return this.api.create<ServiceResponse>('services', form);
  }

  updateService(id: number, form: ServiceForm) {
    return this.api.update<ServiceResponse>('services', id, form);
  }

  deleteService(id: number) {
    return this.api.delete('services', id);
  }
}
