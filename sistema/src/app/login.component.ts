import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from './auth.service';
import { Router } from '@angular/router';
import { NgIf } from '@angular/common';

@Component({
  standalone: true,
  selector: 'app-login',
  imports: [ReactiveFormsModule, NgIf],
  template: `
  <div class="min-h-screen bg-slate-50 flex">
    <!-- LADO IZQUIERDO: imagen / branding -->
    <div class="hidden lg:flex w-1/2 relative overflow-hidden">
      <!-- Fondo gradiente -->
      <div class="absolute inset-0 bg-slate-900"></div>

      <!-- Si quieres imagen real, pon tu foto en assets y descomenta esto -->
      
      <div
        class="absolute inset-0 bg-login-hotel opacity-80 filter brightness-[0.7]">
      </div>

      <!-- Degradado NEGRO suave para que el texto se lea bien -->
      <div class="absolute inset-0 bg-gradient-to-tr from-black/70 via-black/40 to-black/10"></div>
      
      <div
        class="absolute inset-y-0 right-0 w-20
              bg-gradient-to-r from-black/60 via-black/10 to-transparent"
      ></div>

      <div class="relative z-10 w-full h-full flex flex-col justify-between p-10 text-sky-50">
        <!-- Logo + nombre -->
        <div>
          <div class="inline-flex items-center gap-3">
            <div class="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center">
              <span class="material-symbols-rounded text-2xl">hotel</span>
            </div>
            <div>
              <p class="text-sm font-semibold tracking-wide uppercase">
                Hotel ERP
              </p>
              <p class="text-xs text-sky-100/80">
                Sistema de Gestión
              </p>
            </div>
          </div>

          <div class="mt-10 max-w-md space-y-4">
            <h2 class="text-3xl font-semibold leading-tight">
              Controla reservas, habitaciones y ocupación en un solo lugar.
            </h2>
            <p class="text-sm text-sky-100/80">
              Diseñado para recepción, gerencia y administración de tu hotel.
            </p>

            <ul class="mt-4 space-y-2 text-sm text-sky-100/90">
              <li class="flex items-center gap-2">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-300"></span>
                Check-in y check-out en tiempo real.
              </li>
              <li class="flex items-center gap-2">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-300"></span>
                Estado de habitaciones siempre actualizado.
              </li>
              <li class="flex items-center gap-2">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-300"></span>
                Dashboard con métricas del día.
              </li>
            </ul>
          </div>
        </div>

        <div class="text-xs text-sky-100/70">
          © {{ year }} Hotel ERP · Módulo Recepción
        </div>
      </div>
    </div>

    <!-- LADO DERECHO: formulario -->
    <div class="w-full lg:w-1/2 flex items-center justify-center px-6 py-10 lg:pl-0 lg:pr-24">
      <div class="w-full max-w-md lg:-ml-16">
        <!-- Logo pequeño solo en mobile -->
        <div class="flex items-center justify-center mb-6 lg:hidden">
          <div class="w-12 h-12 rounded-2xl bg-sky-100 flex items-center justify-center mr-2">
            <span class="material-symbols-rounded text-2xl text-sky-600">hotel</span>
          </div>
          <div>
            <p class="text-sm font-semibold text-slate-800">Hotel ERP</p>
            <p class="text-xs text-slate-500">Sistema de Gestión</p>
          </div>
        </div>

        <!-- Card de login -->
        <div class="bg-white rounded-3xl shadow-xl border border-slate-100/80 p-8 space-y-6">
          <div class="text-center space-y-1">
            <h1 class="text-2xl font-semibold text-brand_dark">Iniciar sesión</h1>
            <p class="text-sm text-slate-500">
              Ingresa tus credenciales para acceder al panel
            </p>
          </div>

          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4 text-left">
            <!-- Usuario -->
            <div>
              <label class="text-sm font-medium text-slate-700">Nombre de usuario</label>
              <div
                class="flex items-center gap-2 px-3 py-2.5 mt-1 rounded-xl border border-slate-200 bg-slate-50/60
                       focus-within:border-sky-500 focus-within:bg-white transition-colors">
                <span class="material-symbols-rounded text-slate-400 text-lg">person</span>
                <input
                  type="text"
                  formControlName="nombreusuario"
                  class="w-full bg-transparent outline-none text-sm text-slate-800 placeholder:text-slate-400"
                  placeholder="recepcionista">
              </div>
            </div>

            <!-- Contraseña -->
            <div>
              <label class="text-sm font-medium text-slate-700">Contraseña</label>
              <div
                class="flex items-center gap-2 px-3 py-2.5 mt-1 rounded-xl border border-slate-200 bg-slate-50/60
                       focus-within:border-sky-500 focus-within:bg-white transition-colors relative">
                <span class="material-symbols-rounded text-slate-400 text-lg">lock</span>
                <input
                  [type]="showPass ? 'text' : 'password'"
                  formControlName="contrasena"
                  class="w-full bg-transparent outline-none text-sm text-slate-800 placeholder:text-slate-400"
                  placeholder="••••••••">
                <button
                  type="button"
                  (click)="showPass = !showPass"
                  class="text-slate-400 hover:text-slate-600">
                  <span class="material-symbols-rounded text-lg">
                    {{ showPass ? 'visibility_off' : 'visibility' }}
                  </span>
                </button>
              </div>
            </div>

            <!-- Error -->
            <p *ngIf="error" class="text-center text-red-600 text-sm mt-2">{{ error }}</p>

            <!-- Botón -->
            <button
              class="btn-primary w-full mt-3 flex items-center justify-center gap-2"
              [disabled]="form.invalid || loading">
              <ng-container *ngIf="!loading; else loadingTpl">
                Entrar
              </ng-container>
              <ng-template #loadingTpl>
                <span class="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
                Entrando...
              </ng-template>
            </button>
          </form>

          <div class="pt-2 text-center text-[11px] text-slate-400">
            Si tienes problemas para ingresar, contacta al administrador del hotel.
          </div>
        </div>
      </div>
    </div>
  </div>
  `,
})
export class LoginComponent {
  loading = false;
  error = '';
  showPass = false;
  form: any;
  
  year = new Date().getFullYear();

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router) {
    this.form = this.fb.group({
      nombreusuario: ['recepcionista', Validators.required],
      contrasena: ['123456', Validators.required],
    });
  }

  onSubmit() {
  if (this.form.invalid) return;

  this.loading = true;
  const { nombreusuario, contrasena } = this.form.value;

  this.auth.login(nombreusuario!, contrasena!).subscribe({
    next: ({ token, user }: { token: string; user: any }) => {
      // Guardar sesión
      this.auth.setSession(token, user);

      // Redirigir al dashboard
      this.router.navigateByUrl('/dashboard');
    },
    error: (e: any) => {
      this.error = e?.error?.message || 'Credenciales inválidas';
      this.loading = false;
    },
  });
}

}
