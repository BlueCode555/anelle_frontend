import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { CatalogueService } from 'src/app/theme/shared/service/catalogue.service';
import { ServiceResponse } from 'src/app/theme/shared/service/catalogue.model';

@Component({
  selector: 'app-service-list',
  imports: [CommonModule, RouterModule],
  templateUrl: './service-list.component.html',
  styleUrl: './service-list.component.scss'
})
export class ServiceListComponent implements OnInit {
  private catalogue = inject(CatalogueService);

  services = signal<ServiceResponse[]>([]);
  loading = signal(true);
  error = signal(false);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.catalogue.listServices().subscribe({
      next: (page) => {
        this.services.set(page.content);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      }
    });
  }

  formatTarif(tarif: number): string {
    return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(tarif);
  }

  remove(service: ServiceResponse): void {
    if (!confirm(`Supprimer le service "${service.nomService}" ?`)) {
      return;
    }
    this.catalogue.deleteService(service.id).subscribe(() => this.load());
  }
}
