import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminComponent } from './theme/layout/admin/admin.component';
import { GuestComponent } from './theme/layout/guest/guest.component';
import { droitGuard, loggedInGuard, staffGuard } from './theme/shared/_helpers/logged-in.guard';

const appRoutes: Routes = [
  {
    path: '',
    component: AdminComponent,
    canActivate: [staffGuard],
    children: [
      {
        path: '',
        redirectTo: '/accueil',
        pathMatch: 'full'
      },
      {
        path: 'default',
        loadComponent: () => import('./demo/dashboard/default/default.component').then((c) => c.DefaultComponent)
      },
      {
        path: 'agenda',
        canActivate: [droitGuard],
        data: { ecran: 'AGENDA' },
        loadComponent: () => import('./admin/agenda/agenda.component').then((c) => c.AgendaComponent)
      },
      {
        path: 'collaborateurs',
        canActivate: [droitGuard],
        data: { proprietaire: true },
        loadComponent: () =>
          import('./admin/collaborateur/collaborateur-list/collaborateur-list.component').then((c) => c.CollaborateurListComponent)
      },
      {
        path: 'profils',
        canActivate: [droitGuard],
        data: { proprietaire: true },
        loadComponent: () => import('./admin/profil/profil-list/profil-list.component').then((c) => c.ProfilListComponent)
      },
      {
        path: 'clients',
        canActivate: [droitGuard],
        data: { proprietaire: true },
        loadComponent: () => import('./admin/client/client-list/client-list.component').then((c) => c.ClientListComponent)
      },
      {
        path: 'informations',
        canActivate: [droitGuard],
        data: { ecran: 'INFORMATIONS' },
        loadComponent: () => import('./admin/informations/informations.component').then((c) => c.InformationsComponent)
      },
      {
        path: 'categories',
        canActivate: [droitGuard],
        data: { ecran: 'CATEGORIES' },
        loadComponent: () => import('./admin/categorie/categorie-list/categorie-list.component').then((c) => c.CategorieListComponent)
      },
      {
        path: 'services',
        canActivate: [droitGuard],
        data: { ecran: 'SERVICES' },
        loadComponent: () => import('./admin/service/service-list/service-list.component').then((c) => c.ServiceListComponent)
      },
      {
        path: 'produits',
        canActivate: [droitGuard],
        data: { ecran: 'PRODUITS' },
        loadComponent: () => import('./admin/produit/produit-list/produit-list.component').then((c) => c.ProduitListComponent)
      },
      {
        path: 'commandes',
        canActivate: [droitGuard],
        data: { ecran: 'COMMANDES' },
        loadComponent: () => import('./admin/commande/commande-list/commande-list.component').then((c) => c.CommandeListComponent)
      }
    ]
  },
  {
    path: '',
    component: GuestComponent,
    children: [
      {
        path: 'accueil',
        loadComponent: () => import('./public/home/home.component').then((c) => c.HomeComponent)
      },
      {
        path: 'connexion',
        loadComponent: () => import('./public/connexion/connexion.component').then((c) => c.ConnexionComponent)
      },
      {
        path: 'boutique',
        loadComponent: () => import('./public/boutique/boutique.component').then((c) => c.BoutiqueComponent)
      },
      {
        path: 'panier',
        loadComponent: () => import('./public/panier/panier.component').then((c) => c.PanierComponent)
      },
      {
        path: 'reserver',
        canActivate: [loggedInGuard],
        loadComponent: () => import('./public/reserver/reserver.component').then((c) => c.ReserverComponent)
      },
      {
        path: 'personnel',
        loadComponent: () => import('./public/personnel/personnel.component').then((c) => c.PersonnelComponent)
      },
      {
        path: 'auth/callback',
        loadComponent: () => import('./public/auth-callback/auth-callback.component').then((c) => c.AuthCallbackComponent)
      },
      {
        path: 'mon-espace',
        canActivate: [loggedInGuard],
        loadComponent: () => import('./public/mon-espace/mon-espace.component').then((c) => c.MonEspaceComponent)
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forRoot(appRoutes, { anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
