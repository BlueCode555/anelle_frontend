import { localeCourante } from 'src/app/theme/shared/_helpers/zoned-time';
import { Component, OnInit, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';

import { CatalogueService } from '../../service/catalogue.service';
import { ServiceResponse } from '../../service/catalogue.model';
import { InformationService } from '../../service/information.service';
import { Creneau, RendezVousService } from '../../service/rendez-vous.service';
import { aujourdhui, formatHeure } from '../../_helpers/zoned-time';
import { DureePipe } from 'src/app/theme/shared/_helpers/duree.pipe';
import { TranslatePipe } from 'src/app/theme/shared/_helpers/translate.pipe';
import { TranslationService } from 'src/app/theme/shared/service/i18n/translation.service';

export interface ChoixCreneau {
  serviceCode: string;
  debut: string;
}

// Choix d'un service, d'un jour, puis d'un creneau libre. Les heures sont celles de l'institut.
@Component({
  selector: 'app-slot-picker',
  imports: [CommonModule, TranslatePipe, DureePipe],
  templateUrl: './slot-picker.component.html',
  styleUrl: './slot-picker.component.scss'
})
export class SlotPickerComponent implements OnInit {
  private i18n = inject(TranslationService);
  private catalogue = inject(CatalogueService);
  private rendezVous = inject(RendezVousService);
  private informations = inject(InformationService);

  initialService = input<string | null>(null);
  choix = output<ChoixCreneau | null>();

  services = signal<ServiceResponse[]>([]);
  serviceCode = signal('');
  date = signal('');
  creneaux = signal<Creneau[]>([]);
  choisi = signal<string | null>(null);
  loading = signal(false);
  error = signal('');
  dejaCharge = signal(false);

  zone = computed(() => this.informations.info()?.fuseauHoraire ?? 'America/Toronto');
  minDate = computed(() => aujourdhui(this.zone()));
  serviceCourant = computed(() => this.services().find((s) => s.code === this.serviceCode()) ?? null);

  imageSoin(): string | null {
    return this.catalogue.imageSrc(this.serviceCourant()?.imageUrl ?? null);
  }

  constructor() {
    // Propose le jour meme des que le fuseau de l'institut est connu.
    effect(() => {
      const min = this.minDate();
      if (!untracked(() => this.date())) {
        this.date.set(min);
      }
    });

    effect(() => {
      const service = this.serviceCode();
      const date = this.date();
      if (service && date) {
        untracked(() => this.charger(service, date));
      }
    });
  }

  ngOnInit(): void {
    this.informations.ensureLoaded();
    this.catalogue.listServices().subscribe({
      next: (page) => {
        const actifs = page.content.filter((s) => s.actif);
        this.services.set(actifs);
        const demande = this.initialService();
        if (demande && actifs.some((s) => s.code === demande)) {
          this.serviceCode.set(demande);
        }
      },
      error: () => this.error.set(this.i18n.t('ts.slots.services'))
    });
  }

  onService(event: Event): void {
    this.serviceCode.set((event.target as HTMLSelectElement).value);
  }

  onDate(event: Event): void {
    this.date.set((event.target as HTMLInputElement).value);
  }

  choisir(creneau: Creneau): void {
    this.choisi.set(creneau.debut);
    this.choix.emit({ serviceCode: this.serviceCode(), debut: creneau.debut });
  }

  heure(iso: string): string {
    return formatHeure(iso, this.zone());
  }

  formatTarif(tarif: number): string {
    return new Intl.NumberFormat(localeCourante(), { style: 'currency', currency: 'CAD' }).format(tarif);
  }

  private charger(service: string, date: string): void {
    this.choisi.set(null);
    this.choix.emit(null);
    this.error.set('');
    this.loading.set(true);
    this.rendezVous.creneaux(service, date).subscribe({
      next: (res) => {
        this.creneaux.set(res.creneaux);
        this.dejaCharge.set(true);
        this.loading.set(false);
      },
      error: (err) => {
        this.creneaux.set([]);
        this.loading.set(false);
        this.error.set(
          err?.status === 401 ? this.i18n.t('ts.slots.connexion') : (err?.error?.message ?? this.i18n.t('ts.slots.creneaux'))
        );
      }
    });
  }
}
