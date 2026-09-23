// Dictionnaire francais (langue par defaut). Cles a plat, regroupees par ecran/composant dans un fichier par domaine.
import { FR_ADMIN } from './fr-admin';
import { FR_BOUTIQUE } from './fr-boutique';
import { FR_ADMIN_EXTRA } from './fr-admin-extra';
import { FR_ADMIN_FORMS } from './fr-admin-forms';
import { FR_ADMIN_TS } from './fr-admin-ts';
import { FR_DASH } from './fr-dash';
import { FR_PUBLIC } from './fr-public';

export const FR: Record<string, string> = {
  ...FR_PUBLIC,
  ...FR_ADMIN,
  ...FR_ADMIN_FORMS,
  ...FR_ADMIN_EXTRA,
  ...FR_ADMIN_TS,
  ...FR_DASH,
  ...FR_BOUTIQUE,

  // ── En-tete public (site-header) ─────────────────────────────────────────
  'header.nav.accueil': 'Accueil',
  'header.nav.services': 'Services',
  'header.nav.apropos': 'À propos',
  'header.nav.contact': 'Contact',
  'header.monEspace': 'Mon espace',
  'header.espaceGestion': 'Espace de gestion',
  'header.deconnexion': 'Déconnexion',
  'header.seConnecter': 'Se connecter',
  'header.confirmerDeconnexion.titre': 'Se déconnecter ?',
  'header.confirmerDeconnexion.bouton': 'Se déconnecter'
};
