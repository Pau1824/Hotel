import { Component, OnInit } from '@angular/core';
import { NgFor, NgClass } from '@angular/common';
import { HttpClient } from '@angular/common/http';

@Component({
  standalone: true,
  selector: 'app-dashboard',
  imports: [NgFor, NgClass],
  template: `
  <div class="p-6 space-y-6">
    <h1 class="text-2xl font-semibold text-brand_dark">Panel de Control</h1>

    <!-- Tarjetas resumen -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
      <div class="card p-5">
        <p class="text-slate-500">Salidas de hoy</p>
        <div class="mt-2 h-2 bg-slate-100 rounded-full">
          <div class="h-2 bg-brand_primary rounded-full" [style.width.%]="salidasProgress"></div>
        </div>
        <p class="text-sm text-slate-600 mt-2">Realizadas: {{salidasRealizadas}} / {{salidasTotales}}</p>
      </div>

      <div class="card p-5">
        <p class="text-slate-500">Llegadas de hoy</p>
        <div class="mt-2 h-2 bg-slate-100 rounded-full">
          <div class="h-2 bg-brand_sky rounded-full" [style.width.%]="llegadasProgress"></div>
        </div>
        <p class="text-sm text-slate-600 mt-2">Realizadas: {{llegadasRealizadas}} / {{llegadasTotales}}</p>
      </div>

      <div class="card p-5 text-center">
        <p class="text-slate-500">Ocupación actual</p>
        <p class="text-4xl font-bold text-brand_primary mt-2">{{ocupadas}} <span class="text-lg text-slate-400">de {{totalHabs}}</span></p>
        <p class="text-sm text-slate-500">{{disponibles}} habitaciones disponibles</p>
      </div>
    </div>

    <!-- Actividad reciente -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div class="card p-5">
        <p class="font-medium mb-3 text-brand_dark">Actividad Reciente</p>
        <ul class="space-y-2 text-sm">
          <li *ngFor="let item of actividad" class="flex items-center gap-2">
            <span [ngClass]="{
              'bg-emerald-500': item.tipo==='checkin',
              'bg-sky-500': item.tipo==='checkout',
              'bg-amber-500': item.tipo==='mantenimiento'
            }" class="w-2.5 h-2.5 rounded-full"></span>
            {{item.texto}}
          </li>
        </ul>
      </div>

      <!-- Gráfico placeholder -->
      <div class="card p-5 flex flex-col justify-center items-center text-slate-400">
        <p>[ Gráfico de Estado de Habitaciones ]</p>
      </div>
    </div>
  </div>
  `,
})
export class DashboardComponent implements OnInit {
  salidasRealizadas = 0;
  salidasTotales = 5;
  llegadasRealizadas = 0;
  llegadasTotales = 4;
  ocupadas = 2;
  totalHabs = 6;
  disponibles = 4;
  actividad = [
    { tipo: 'checkin', texto: 'Check-in María García - Hab 101' },
    { tipo: 'checkout', texto: 'Check-out Juan Pérez - Hab 201' },
    { tipo: 'mantenimiento', texto: 'Mantenimiento Hab 302' },
    { tipo: 'checkin', texto: 'Nueva reserva Ana López' },
  ];

  get salidasProgress() { return (this.salidasRealizadas / this.salidasTotales) * 100; }
  get llegadasProgress() { return (this.llegadasRealizadas / this.llegadasTotales) * 100; }

  constructor(private http: HttpClient) {}

  ngOnInit() {
    // luego aquí conectaremos con tu backend /api/reportes/resumen
  }
}
