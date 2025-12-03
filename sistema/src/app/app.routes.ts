import { Routes } from '@angular/router';
import { LoginComponent } from './login.component';
import { DashboardComponent } from './dashboard.component';
import { LayoutComponent } from './layout/layout.component';
import { ReservasComponent } from './reservas/reservas.component';

//Importamos el guard de admin
import { AdminGuard } from './core/guards/admin.guard';

// Importamos el componente de reportes
import { ReportesComponent } from './reportes/reportes.component';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { noCadenaGuard } from './core/guards/no-cadena.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: LayoutComponent,
    children: [
      // ===== Ruta raíz para admin cadena =====
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./hoteles-admin/hoteles-admin.component').then(
            m => m.HotelesComponent
          ),
        canActivate: [
          () => {
            const auth = inject(AuthService);
            return auth.currentUser?.rol === 'admin_cadena';
          }
        ]
      },

      // ===== Ruta explícita para /hoteles-admin  =====
      {
        path: 'hoteles-admin',
        loadComponent: () =>
          import('./hoteles-admin/hoteles-admin.component').then(
            m => m.HotelesComponent
          ),
        canActivate: [
          () => {
            const auth = inject(AuthService);
            return auth.currentUser?.rol === 'admin_cadena';
          }
        ]
      },
      {
        path: 'usuarios-admin-local',
        loadComponent: () =>
          import('./usuarios-admin-local/usuarios-admin-local.component')
            .then(m => m.UsuariosAdminLocalComponent),
        canActivate: [
          () => {
            const auth = inject(AuthService);
            return auth.currentUser?.rol === 'admin_cadena';
          }
        ]
      },

      { path: 'dashboard', canActivate: [noCadenaGuard], component: DashboardComponent },
      { path: 'reservas', canActivate: [noCadenaGuard], component: ReservasComponent, runGuardsAndResolvers: 'always' },
      // { path: 'reservas', component: ReservasComponent }, etc.
      { path: 'reservas/nueva',
            loadComponent: () =>
              import('./reservas/nueva-reserva.component')
                .then(m => m.NuevaReservaComponent)
          },
      { path: 'habitaciones', canActivate: [noCadenaGuard], loadComponent: () => import('./habitaciones/habitaciones.component').then(m => m.HabitacionesComponent) },
      
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
      {
        path: 'config-habitaciones',
        canActivate: [AdminGuard],
        loadComponent: () =>
          import('./habitaciones-config/habitaciones-config.component').then(
            (m) => m.HabitacionesConfigComponent
          ),
      },
      
      

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
