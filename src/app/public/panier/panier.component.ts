import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { Commande, CommandeService, ProduitService } from 'src/app/theme/shared/service/boutique.service';
import { ConfirmationService } from 'src/app/theme/shared/service/confirmation.service';
import { LignePanier, PanierService } from 'src/app/theme/shared/service/panier.service';
import { TranslationService } from 'src/app/theme/shared/service/i18n/translation.service';
import { TranslatePipe } from 'src/app/theme/shared/_helpers/translate.pipe';
import { RETOUR_CLIENT_KEY } from 'src/app/theme/shared/_helpers/token-storage';
import { localeCourante } from 'src/app/theme/shared/_helpers/zoned-time';
import { SiteHeaderComponent } from '../site-header/site-header.component';

const TEL_KEY = 'anelle_telephone';
const TEL_MOTIF = /^[+0-9 ().-]{7,40}$/;

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
  private confirmation = inject(ConfirmationService);
  auth = inject(AuthService);
  panier = inject(PanierService);

  telephone = signal(this.lireTelephone());
  note = signal('');
  soumis = signal(false);
  envoi = signal(false);
  erreur = signal('');
  sessionExpiree = signal(false);
  commande = signal<Commande | null>(null);

  telephoneValide = computed(() => TEL_MOTIF.test(this.telephone().trim()));

  imageSrc(l: LignePanier): string | null {
    return this.produits.imageSrc(l.imageUrl);
  }

  formatPrix(prix: number): string {
    return new Intl.NumberFormat(localeCourante(), { style: 'currency', currency: 'CAD' }).format(prix);
  }

  estClient(): boolean {
    return this.auth.user()?.type === 'CLIENT';
  }

  onTelephone(event: Event): void {
    this.telephone.set((event.target as HTMLInputElement).value);
  }

  onNote(event: Event): void {
    this.note.set((event.target as HTMLTextAreaElement).value);
  }

  changerQuantite(l: LignePanier, delta: number): void {
    this.panier.definirQuantite(l.code, l.quantite + delta);
  }

  async retirer(l: LignePanier): Promise<void> {
    const ok = await this.confirmation.demander({
      titre: this.i18n.t('panier.retirerTitre', { nom: l.nom }),
      texteConfirmer: this.i18n.t('panier.retirer'),
      danger: true
    });
    if (ok) {
      this.panier.retirer(l.code);
    }
  }

  seConnecter(): void {
    sessionStorage.setItem(RETOUR_CLIENT_KEY, '/panier');
    this.auth.loginClient();
  }

  commander(): void {
    this.soumis.set(true);
    this.erreur.set('');
    this.sessionExpiree.set(false);
    if (!this.telephoneValide()) {
      return;
    }
    this.envoi.set(true);
    const lignes = this.panier.lignes().map((l) => ({ produitCode: l.code, quantite: l.quantite }));
    this.commandes.creer(lignes, this.telephone().trim(), this.note().trim()).subscribe({
      next: (commande) => {
        this.memoriserTelephone();
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

  private lireTelephone(): string {
    try {
      return localStorage.getItem(TEL_KEY) ?? '';
    } catch {
      return '';
    }
  }

  private memoriserTelephone(): void {
    try {
      localStorage.setItem(TEL_KEY, this.telephone().trim());
    } catch {
      // stockage indisponible : la cliente le ressaisira la prochaine fois.
    }
  }
}
