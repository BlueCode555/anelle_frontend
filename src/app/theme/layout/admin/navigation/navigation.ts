export interface NavigationItem {
  id: string;
  title: string;
  type: 'item' | 'collapse' | 'group';
  translate?: string;
  icon?: string;
  hidden?: boolean;
  url?: string;
  classes?: string;
  external?: boolean;
  target?: boolean;
  breadcrumbs?: boolean;
  children?: NavigationItem[];
  role?: string[];
  isMainParent?: boolean;
  // Droit de lecture exigé sur cet écran pour voir l'entrée du menu
  ecran?: 'AGENDA' | 'INFORMATIONS' | 'CATEGORIES' | 'SERVICES' | 'PRODUITS' | 'COMMANDES';
  // Entrée réservée à l'esthéticienne
  proprietaire?: boolean;
}

// Menu du back-office : entrées simples ou sections repliables (collapse).
export const NavigationItems: NavigationItem[] = [
  {
    id: 'default',
    title: 'Tableau de bord',
    type: 'item',
    url: '/default',
    icon: 'ti ti-layout-dashboard'
  },
  // Administration en haut : ce qui touche à l'équipe et à l'institut. Chaque entrée n'apparaît que pour qui y a droit.
  {
    id: 'administration',
    title: 'Administration',
    type: 'collapse',
    icon: 'ti ti-settings',
    children: [
      { id: 'collaborateurs', title: 'Collaborateurs', type: 'item', url: '/collaborateurs', icon: 'ti ti-user-plus', proprietaire: true },
      { id: 'profils', title: 'Profils et droits', type: 'item', url: '/profils', icon: 'ti ti-shield-lock', proprietaire: true },
      { id: 'clients', title: 'Clientèle', type: 'item', url: '/clients', icon: 'ti ti-users', proprietaire: true },
      { id: 'informations', title: 'Mon institut', type: 'item', url: '/informations', icon: 'ti ti-building-store', ecran: 'INFORMATIONS' }
    ]
  },
  {
    id: 'agenda',
    title: 'Agenda',
    type: 'item',
    url: '/agenda',
    icon: 'ti ti-calendar-event',
    ecran: 'AGENDA'
  },
  {
    id: 'catalogue',
    title: 'Catalogue',
    type: 'collapse',
    icon: 'ti ti-sparkles',
    children: [
      { id: 'categories', title: 'Catégories', type: 'item', url: '/categories', icon: 'ti ti-category', ecran: 'CATEGORIES' },
      { id: 'services', title: 'Services', type: 'item', url: '/services', icon: 'ti ti-list-details', ecran: 'SERVICES' }
    ]
  },
  {
    id: 'boutique',
    title: 'Boutique',
    type: 'collapse',
    icon: 'ti ti-shopping-bag',
    children: [
      { id: 'produits', title: 'Produits', type: 'item', url: '/produits', icon: 'ti ti-package', ecran: 'PRODUITS' },
      { id: 'commandes', title: 'Commandes', type: 'item', url: '/commandes', icon: 'ti ti-receipt-2', ecran: 'COMMANDES' }
    ]
  }
];
