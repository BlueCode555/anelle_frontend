import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { ClientAdmin, ClientService } from 'src/app/theme/shared/service/client.service';
import { ClientDetailComponent } from '../client-detail/client-detail.component';

// Consultation des clientes (lecture seule) : creees automatiquement a la connexion Google, jamais ici.
@Component({
  selector: 'app-client-list',
  imports: [CommonModule, FormsModule],
  templateUrl: './client-list.component.html',
  styleUrl: './client-list.component.scss'
})
export class ClientListComponent implements OnInit {
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
        this.erreur.set(err?.status === 401 || err?.status === 403 ? "Réservé à l'esthéticienne." : 'Impossible de charger les clientes.');
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
    if (!c.derniereConnexion) return 'Jamais reconnectée depuis';
    return new Intl.DateTimeFormat('fr-CA', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(c.derniereConnexion));
  }
}
