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
  <div class="min-h-screen grid place-items-center bg-gradient-to-b from-white to-sky-50 px-4">
    <div class="card w-full max-w-[420px] p-8 text-center">

      <!-- Icono -->
      <div class="w-14 h-14 mx-auto mb-5 rounded-2xl bg-brand_primary/10 text-brand_primary grid place-items-center">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor" class="w-7 h-7">
          <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v9.75a.75.75 0 00.75.75H9.75v-6a.75.75 0 01.75-.75h3a.75.75 0 01.75.75v6h4.5a.75.75 0 00.75-.75V9.75" />
        </svg>
      </div>

      <!-- Título -->
      <h1 class="text-2xl font-semibold mb-1 text-brand_dark">Iniciar sesión</h1>
      <p class="text-slate-500 mb-6">Ingresa tus credenciales</p>

      <!-- Formulario -->
      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4 text-left">
        <div>
          <label class="text-sm font-medium text-slate-700">Nombre de usuario</label>
          <input type="text"
                 formControlName="nombreusuario"
                 class="w-full mt-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand_primary"
                 placeholder="recepcionista">
        </div>

        <div>
          <label class="text-sm font-medium text-slate-700">Contraseña</label>
          <div class="relative">
            <input [type]="showPass ? 'text' : 'password'"
                   formControlName="contrasena"
                   class="w-full mt-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand_primary"
                   placeholder="••••••••">
            <button type="button"
                    (click)="showPass = !showPass"
                    class="absolute right-3 top-[10px] text-slate-400 hover:text-slate-600">
              <svg *ngIf="!showPass" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.27 4.5 12 4.5c4.729 0 8.576 3.01 9.964 7.183a1.012 1.012 0 010 .639C20.576 16.49 16.729 19.5 12 19.5c-4.729 0-8.576-3.01-9.964-7.178z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <svg *ngIf="showPass" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.23 19.5 12 19.5c.993 0 1.953-.138 2.864-.396M6.228 6.228A10.45 10.45 0 0112 4.5c4.77 0 8.774 3.162 10.066 7.5a10.523 10.523 0 01-4.293 5.18M6.228 6.228L3 3m3.228 3.228l11.544 11.544M21 21l-3-3" />
              </svg>
            </button>
          </div>
        </div>

        <button class="btn-primary w-full mt-3" [disabled]="form.invalid || loading">
          {{ loading ? 'Entrando...' : 'Entrar' }}
        </button>

        <p *ngIf="error" class="text-center text-red-600 text-sm mt-2">{{ error }}</p>
      </form>
    </div>
  </div>
  `,
})
export class LoginComponent {
  loading = false;
  error = '';
  showPass = false;
  form: any;

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
