import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { Commande, CommandeService, ProduitService } from 'src/app/theme/shared/service/boutique.service';
import { LignePanier, PanierService } from 'src/app/theme/shared/service/panier.service';
import { TranslationService } from 'src/app/theme/shared/service/i18n/translation.service';
import { TranslatePipe } from 'src/app/theme/shared/_helpers/translate.pipe';
import { RETOUR_CLIENT_KEY } from 'src/app/theme/shared/_helpers/token-storage';
import { localeCourante } from 'src/app/theme/shared/_helpers/zoned-time';
import { SiteHeaderComponent } from '../site-header/site-header.component';

@Component({
  selector: 'app-panier',
  imports: [CommonModule, RouterModule, SiteHeaderComponent, TranslatePipe],
  templateUrl: './panier.component.html',
  styleUrl: './panier.component.scss'
})
export class PanierComponent {
  private commandes = inject(CommandeService);
  private produits = inject(ProduitService);
  private i18n = inject(TranslationService);
  auth = inject(AuthService);
  panier = inject(PanierService);

  note = signal('');
  envoi = signal(false);
  erreur = signal('');
  sessionExpiree = signal(false);
  commande = signal<Commande | null>(null);

  imageSrc(l: LignePanier): string | null {
    return this.produits.imageSrc(l.imageUrl);
  }

  formatPrix(prix: number): string {
    return new Intl.NumberFormat(localeCourante(), { style: 'currency', currency: 'CAD' }).format(prix);
  }

  estClient(): boolean {
    return this.auth.user()?.type === 'CLIENT';
  }

  onNote(event: Event): void {
    this.note.set((event.target as HTMLTextAreaElement).value);
  }

  changerQuantite(l: LignePanier, delta: number): void {
    this.panier.definirQuantite(l.code, l.quantite + delta);
  }

  seConnecter(): void {
    sessionStorage.setItem(RETOUR_CLIENT_KEY, '/panier');
    this.auth.loginClient();
  }

  commander(): void {
    this.erreur.set('');
    this.sessionExpiree.set(false);
    this.envoi.set(true);
    const lignes = this.panier.lignes().map((l) => ({ produitCode: l.code, quantite: l.quantite }));
    this.commandes.creer(lignes, this.note().trim()).subscribe({
      next: (commande) => {
        this.commande.set(commande);
        this.panier.vider();
        this.envoi.set(false);
      },
      error: (err) => {
        this.envoi.set(false);
        // 401 = jeton absent/invalide ; le reste (stock insuffisant, article retiré...) est un message du serveur à afficher tel quel.
        const expiree = err?.status === 401;
        this.sessionExpiree.set(expiree);
        this.erreur.set(expiree ? this.i18n.t('panier.sessionExpiree') : (err?.error?.message ?? this.i18n.t('panier.erreur')));
      }
    });
  }
}
