// English dictionary. Same keys as fr.ts ; a missing key falls back to French, then to the key itself.
import { EN_ADMIN } from './en-admin';
import { EN_BOUTIQUE } from './en-boutique';
import { EN_ADMIN_EXTRA } from './en-admin-extra';
import { EN_ADMIN_FORMS } from './en-admin-forms';
import { EN_ADMIN_TS } from './en-admin-ts';
import { EN_DASH } from './en-dash';
import { EN_PUBLIC } from './en-public';

export const EN: Record<string, string> = {
  ...EN_PUBLIC,
  ...EN_ADMIN,
  ...EN_ADMIN_FORMS,
  ...EN_ADMIN_EXTRA,
  ...EN_ADMIN_TS,
  ...EN_DASH,
  ...EN_BOUTIQUE,

  // ── Public header (site-header) ──────────────────────────────────────────
  'header.nav.accueil': 'Home',
  'header.nav.services': 'Services',
  'header.nav.apropos': 'About',
  'header.nav.contact': 'Contact',
  'header.monEspace': 'My account',
  'header.espaceGestion': 'Management area',
  'header.deconnexion': 'Log out',
  'header.seConnecter': 'Log in',
  'header.confirmerDeconnexion.titre': 'Log out?',
  'header.confirmerDeconnexion.bouton': 'Log out'
};
