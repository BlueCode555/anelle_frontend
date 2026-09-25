import { localeCourante } from 'src/app/theme/shared/_helpers/zoned-time';
import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { CatalogueService } from 'src/app/theme/shared/service/catalogue.service';
import { ServiceResponse } from 'src/app/theme/shared/service/catalogue.model';
import { ServiceFormComponent } from '../service-form/service-form.component';
import { ConfirmationService } from 'src/app/theme/shared/service/confirmation.service';
import { ToastService } from 'src/app/theme/shared/service/toast.service';
import { DureePipe } from 'src/app/theme/shared/_helpers/duree.pipe';
import { TranslatePipe } from 'src/app/theme/shared/_helpers/translate.pipe';
import { TranslationService } from 'src/app/theme/shared/service/i18n/translation.service';
import { PaginationComponent } from 'src/app/theme/shared/components/pagination/pagination.component';

@Component({
  selector: 'app-service-list',
  imports: [CommonModule, TranslatePipe, DureePipe, PaginationComponent],
  templateUrl: './service-list.component.html',
  styleUrl: './service-list.component.scss'
})
export class ServiceListComponent implements OnInit {
  page = signal(1);
  readonly taille = 10;
  pagees = computed(() => this.services().slice((this.page() - 1) * this.taille, this.page() * this.taille));

  private retourPage1 = effect(() => {
    this.services();
    this.page.set(1);
  });
  private i18n = inject(TranslationService);
  private catalogue = inject(CatalogueService);
  private modalService = inject(NgbModal);
  private confirmation = inject(ConfirmationService);
  private toast = inject(ToastService);

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
    return new Intl.NumberFormat(localeCourante(), { style: 'currency', currency: 'CAD' }).format(tarif);
  }

  imageSrc(url?: string | null): string | null {
    return this.catalogue.imageSrc(url);
  }

  // Un clic : affiche ou masque le soin sur la page d'accueil (sans ouvrir le formulaire).
  basculer(s: ServiceResponse, event: Event): void {
    const actif = (event.target as HTMLInputElement).checked;
    this.catalogue
      .updateService(s.id, {
        nomService: s.nomService,
        categorieCode: s.categorieCode,
        description: s.description ?? '',
        dureeMinutes: s.dureeMinutes,
        tarif: s.tarif,
        actif,
        imageUrl: s.imageUrl ?? ''
      })
      .subscribe({
        next: () => {
          this.services.update((l) => l.map((x) => (x.id === s.id ? { ...x, actif } : x)));
          this.toast.succes(this.i18n.t(actif ? 'toggle.affiche' : 'toggle.masque'));
        },
        error: (err) => {
          (event.target as HTMLInputElement).checked = !actif;
          this.toast.erreur(err?.error?.message ?? this.i18n.t('ts.erreurGenerique'));
        }
      });
  }

  openCreate(): void {
    const ref = this.modalService.open(ServiceFormComponent, { centered: true });
    ref.result.then(
      (result) => {
        if (result === 'saved') {
          this.toast.succes(this.i18n.t('ts.srv.enregistre'));
          this.load();
        }
      },
      () => {}
    );
  }

  openEdit(service: ServiceResponse): void {
    const ref = this.modalService.open(ServiceFormComponent, { centered: true });
    ref.componentInstance.serviceId = service.id;
    ref.result.then(
      (result) => {
        if (result === 'saved') {
          this.toast.succes(this.i18n.t('ts.srv.enregistre'));
          this.load();
        }
      },
      () => {}
    );
  }

  async remove(service: ServiceResponse): Promise<void> {
    const ok = await this.confirmation.demander({
      titre: this.i18n.t('ts.srv.supprimer', { nom: service.nomService }),
      message: this.i18n.t('ts.definitive'),
      texteConfirmer: this.i18n.t('ts.supprimer'),
      danger: true
    });
    if (!ok) {
      return;
    }
    this.catalogue.deleteService(service.id).subscribe({
      next: () => {
        this.toast.succes(this.i18n.t('ts.srv.supprime'));
        this.load();
      },
      error: (err) => this.toast.erreur(err?.error?.message ?? this.i18n.t('ts.suppressionImpossible'))
    });
  }
}
