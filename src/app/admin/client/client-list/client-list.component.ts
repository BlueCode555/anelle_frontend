import { localeCourante } from 'src/app/theme/shared/_helpers/zoned-time';
import { Component, OnInit, computed, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { ClientAdmin, ClientService } from 'src/app/theme/shared/service/client.service';
import { ClientDetailComponent } from '../client-detail/client-detail.component';
import { TranslatePipe } from 'src/app/theme/shared/_helpers/translate.pipe';
import { TranslationService } from 'src/app/theme/shared/service/i18n/translation.service';
import { PaginationComponent } from 'src/app/theme/shared/components/pagination/pagination.component';

// Consultation des clientes (lecture seule) : creees automatiquement a la connexion Google, jamais ici.
@Component({
  selector: 'app-client-list',
  imports: [CommonModule, FormsModule, TranslatePipe, PaginationComponent],
  templateUrl: './client-list.component.html',
  styleUrl: './client-list.component.scss'
})
export class ClientListComponent implements OnInit {
  page = signal(1);
  readonly taille = 10;
  pagees = computed(() => this.visibles().slice((this.page() - 1) * this.taille, this.page() * this.taille));

  private retourPage1 = effect(() => {
    this.visibles();
    this.page.set(1);
  });
  photosKO = signal<number[]>([]);
  private i18n = inject(TranslationService);
  private clients = inject(ClientService);
  private modals = inject(NgbModal);

  liste = signal<ClientAdmin[]>([]);
  chargement = signal(true);
  erreur = signal('');
  recherche = signal('');

  // Recherche par nom, prenom ou e-mail : evite le defilement sans fin quand la clientele est nombreuse.
  visibles = computed(() => {
    const q = this.recherche().trim().toLowerCase();
    if (!q) return this.liste();
    return this.liste().filter(
      (c) => `${c.prenom ?? ''} ${c.nom ?? ''}`.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
    );
  });

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.clients.lister().subscribe({
      next: (liste) => {
        this.liste.set(liste);
        this.chargement.set(false);
      },
      error: (err) => {
        this.chargement.set(false);
        this.erreur.set(err?.status === 401 || err?.status === 403 ? this.i18n.t('ts.reserveProprio') : this.i18n.t('ts.client.charger'));
      }
    });
  }

  voir(client: ClientAdmin): void {
    const ref = this.modals.open(ClientDetailComponent, { centered: true, size: 'lg' });
    ref.componentInstance.client = client;
  }

  nomAffiche(c: ClientAdmin): string {
    const nom = `${c.prenom ?? ''} ${c.nom ?? ''}`.trim();
    return nom || c.email;
  }

  derniereConnexion(c: ClientAdmin): string {
    if (!c.derniereConnexion) return this.i18n.t('ts.client.jamais');
    return new Intl.DateTimeFormat(localeCourante(), { dateStyle: 'long', timeStyle: 'short' }).format(new Date(c.derniereConnexion));
  }
}
