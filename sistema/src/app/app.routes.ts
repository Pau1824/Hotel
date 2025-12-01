import { Routes } from '@angular/router';
import { LoginComponent } from './login.component';
import { DashboardComponent } from './dashboard.component';
import { LayoutComponent } from './layout/layout.component';
import { ReservasComponent } from './reservas/reservas.component';

//Importamos el guard de admin
import { AdminGuard } from './core/guards/admin.guard';

// Importamos el componente de reportes
import { ReportesComponent } from './reportes/reportes.component';

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
      { path: 'reservas/nueva',
            loadComponent: () =>
              import('./reservas/nueva-reserva.component')
                .then(m => m.NuevaReservaComponent)
          },
      { path: 'habitaciones', loadComponent: () => import('./habitaciones/habitaciones.component').then(m => m.HabitacionesComponent) },
      
      // Rutas SOLO ADMIN
      {
        path: 'reportes',
        canActivate: [AdminGuard],
        component: ReportesComponent,
      },

      // Estas dos las dejaremos preparadas, aunque aún no tengas los componentes:
      // Cuando los crees, solo descomentas los imports.
      
      {
        path: 'usuarios',
        canActivate: [AdminGuard],
        loadComponent: () =>
          import('./usuarios/usuarios.component').then(
            (m) => m.UsuariosComponent
          ),
      },
      /*{
        path: 'config-habitaciones',
        canActivate: [AdminGuard],
        loadComponent: () =>
          import('./config-habitaciones/config-habitaciones.component').then(
            (m) => m.ConfigHabitacionesComponent
          ),
      },*/
      

    ],
  },
  /*{
    path: 'reservas/nueva',
    loadComponent: () => import('./reservas/nueva-reserva.component').then(m => m.NuevaReservaComponent)
  },*/
  /*{
    path: 'habitaciones',
    loadComponent: () => 
      import('./habitaciones/habitaciones.component').then(m => m.HabitacionesComponent)
  }*/


];
