import { Component, inject, signal } from '@angular/core';
import { Router, NavigationEnd, RouterOutlet, RouterLink } from '@angular/router';
import { NgClass, NgIf } from '@angular/common';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, NgClass, NgIf],
  template: `
  <div class="flex h-screen bg-slate-50">

    <!-- ===== Overlay móvil ===== -->
    <div 
      class="fixed inset-0 bg-black/40 z-30 md:hidden"
      *ngIf="sidebarOpen()"
      (click)="toggleSidebar()">
    </div>

    <!-- ===== Sidebar ===== -->
    <aside 
      class="fixed z-40 inset-y-0 left-0 w-64 bg-white shadow-lg border-r border-slate-200 
             transform transition-transform duration-300
             md:static md:translate-x-0"
      [class.-translate-x-full]="!sidebarOpen()">
      
      <div class="px-6 py-5 border-b border-slate-200">
        <h1 class="text-xl font-semibold text-brand_dark">Hotel ERP</h1>
        <p class="text-sm text-slate-500">Sistema de Gestión</p>
      </div>

      <nav class="p-4 space-y-2 text-sm">
      <!-- MÓDULOS COMUNES (admin y recepcionista) -->
        <a routerLink="/dashboard"
          class="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100"
          routerLinkActive="bg-slate-100 font-medium">
          <span class="material-symbols-rounded">home</span> Panel
        </a>

        <a routerLink="/reservas"
          class="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100"
          routerLinkActive="bg-slate-100 font-medium">
          <span class="material-symbols-rounded">calendar_month</span> Reservas
        </a>

        <a routerLink="/habitaciones"
          class="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100"
          routerLinkActive="bg-slate-100 font-medium">
          <span class="material-symbols-rounded">bed</span> Habitaciones
        </a>

        <!-- SECCIÓN SOLO ADMIN -->
        <ng-container *ngIf="isAdmin()">
          <div class="mt-4 pt-4 border-t border-slate-200 text-xs uppercase tracking-wide text-slate-400">
            Administración
          </div>

          <a routerLink="/reportes"
            class="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100"
            routerLinkActive="bg-slate-100 font-medium">
            <span class="material-symbols-rounded">monitoring</span> Reportes
          </a>

          <a routerLink="/usuarios"
            class="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100"
            routerLinkActive="bg-slate-100 font-medium">
            <span class="material-symbols-rounded">group</span> Usuarios
          </a>

          <a routerLink="/config-habitaciones"
            class="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100"
            routerLinkActive="bg-slate-100 font-medium">
            <span class="material-symbols-rounded">tune</span> Config. Habitaciones
          </a>
        </ng-container>
      </nav>

      <button 
        (click)="logout()"
        class="absolute bottom-6 left-4 flex items-center gap-3 text-slate-600 hover:text-brand_dark">
        <span class="material-symbols-rounded">logout</span>
        Cerrar sesión
      </button>
    </aside>

    <!-- ===== Contenido principal ===== -->
    <main class="flex-1 overflow-y-auto">

      <!-- Header móvil -->
      <header class="md:hidden flex items-center justify-between px-4 py-3 bg-white shadow-sm">
        <button (click)="toggleSidebar()" class="material-symbols-rounded text-2xl">
          menu
        </button>
        <span class="font-semibold text-brand_dark">Hotel ERP</span>
      </header>

      <div class="p-6">
        <router-outlet></router-outlet>
      </div>

    </main>
  </div>
  `,
})
export class LayoutComponent {

  sidebarOpen = signal(false);

  private auth = inject(AuthService);
  private router = inject(Router);

  constructor() {
    // Cuando el usuario navega → cerrar sidebar en móvil
    this.router.events.subscribe(() => {
      this.sidebarOpen.set(false);
    });
  }

  toggleSidebar() {
    this.sidebarOpen.update(v => !v);
  }

  isAdmin(): boolean {
    return this.auth.isAdmin();
  }

  logout() {
    // 1. Limpiar sesión (cookies / user) desde el servicio
    this.auth.logout();

    // 2. Cerrar sidebar por si está abierto
    this.sidebarOpen.set(false);

    // 3. Enviar al login
    this.router.navigate(['/login']);
  }
}

