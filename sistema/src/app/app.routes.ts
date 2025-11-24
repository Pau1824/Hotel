import { Routes } from '@angular/router';
import { LoginComponent } from './login.component';
import { DashboardComponent } from './dashboard.component';
import { LayoutComponent } from './layout/layout.component';
import { ReservasComponent } from './reservas/reservas.component';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: LayoutComponent,
    children: [
      { path: 'dashboard', component: DashboardComponent },
      { path: 'reservas', component: ReservasComponent, runGuardsAndResolvers: 'always' },
      // { path: 'reservas', component: ReservasComponent }, etc.
    ],
  },
  {
    path: 'reservas/nueva',
    loadComponent: () => import('./reservas/nueva-reserva.component').then(m => m.NuevaReservaComponent)
  },
  {
    path: 'habitaciones',
    loadComponent: () => 
      import('./habitaciones/habitaciones.component').then(m => m.HabitacionesComponent)
  }


];
