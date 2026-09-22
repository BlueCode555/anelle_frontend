import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { ClientAdmin, ClientService } from 'src/app/theme/shared/service/client.service';
import { RendezVous, STATUT_CLASSES, STATUT_LIBELLES } from 'src/app/theme/shared/service/rendez-vous.service';

// Fiche d'une cliente : coordonnees + historique de ses rendez-vous. Lecture seule.
@Component({
  selector: 'app-client-detail',
  imports: [CommonModule],
  templateUrl: './client-detail.component.html',
  styleUrl: './client-detail.component.scss'
})
export class ClientDetailComponent implements OnInit {
  private clients = inject(ClientService);
  activeModal = inject(NgbActiveModal);

  // Renseigne par la liste avant l'affichage.
  client!: ClientAdmin;

  readonly libelles = STATUT_LIBELLES;
  readonly classes = STATUT_CLASSES;

  rdvs = signal<RendezVous[]>([]);
  chargement = signal(true);
  erreur = signal('');

  ngOnInit(): void {
    this.clients.rendezVous(this.client.id).subscribe({
      next: (liste) => {
        this.rdvs.set(liste);
        this.chargement.set(false);
      },
      error: () => {
        this.erreur.set('Impossible de charger les rendez-vous.');
        this.chargement.set(false);
      }
    });
  }

  nomAffiche(): string {
    const nom = `${this.client.prenom ?? ''} ${this.client.nom ?? ''}`.trim();
    return nom || this.client.email;
  }

  derniereConnexion(): string {
    if (!this.client.derniereConnexion) return 'Jamais';
    return new Intl.DateTimeFormat('fr-CA', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(this.client.derniereConnexion));
  }

  jour(iso: string): string {
    return new Intl.DateTimeFormat('fr-CA', { dateStyle: 'long' }).format(new Date(iso));
  }

  heure(iso: string): string {
    return new Intl.DateTimeFormat('fr-CA', { timeStyle: 'short' }).format(new Date(iso));
  }

  formatTarif(tarif: number): string {
    return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(tarif);
  }
}
