import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminComponent } from './theme/layout/admin/admin.component';
import { GuestComponent } from './theme/layout/guest/guest.component';

const appRoutes: Routes = [
  {
    path: '',
    component: AdminComponent,
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
        path: 'categories',
        loadComponent: () => import('./admin/categorie/categorie-list/categorie-list.component').then((c) => c.CategorieListComponent)
      },
      {
        path: 'categories/new',
        loadComponent: () => import('./admin/categorie/categorie-form/categorie-form.component').then((c) => c.CategorieFormComponent)
      },
      {
        path: 'categories/:id/edit',
        loadComponent: () => import('./admin/categorie/categorie-form/categorie-form.component').then((c) => c.CategorieFormComponent)
      },
      {
        path: 'services',
        loadComponent: () => import('./admin/service/service-list/service-list.component').then((c) => c.ServiceListComponent)
      },
      {
        path: 'services/new',
        loadComponent: () => import('./admin/service/service-form/service-form.component').then((c) => c.ServiceFormComponent)
      },
      {
        path: 'services/:id/edit',
        loadComponent: () => import('./admin/service/service-form/service-form.component').then((c) => c.ServiceFormComponent)
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
        path: 'login',
        loadComponent: () => import('./demo/pages/authentication/login/login.component').then((c) => c.LoginComponent)
      },
      {
        path: 'register',
        loadComponent: () => import('./demo/pages/authentication/register/register.component').then((c) => c.RegisterComponent)
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forRoot(appRoutes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
