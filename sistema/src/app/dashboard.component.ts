import { Component, OnInit } from '@angular/core';
import { NgIf, NgFor, NgClass, AsyncPipe, CurrencyPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { NgApexchartsModule, ApexChart, ApexLegend } from 'ng-apexcharts';
import { environment } from '../environments/environment';

interface ActividadItem {
  tipo: 'checkin' | 'checkout' | 'mantenimiento' | 'reserva' | 'cancelacion';
  texto: string;
  fecha?: string;
}

interface EstadoHabitacion {
  estado: string;
  cantidad: number;
}

interface DashboardResponse {
  salidasRealizadas: number;
  salidasTotales: number;
  llegadasRealizadas: number;
  llegadasTotales: number;
  ocupadas: number;
  totalHabs: number;
  estadosHabitacion: EstadoHabitacion[];
  actividad: ActividadItem[];
  tarifaPromedio: number;
}

@Component({
  standalone: true,
  selector: 'app-dashboard',
  imports: [NgIf, NgFor, NgClass, AsyncPipe, NgApexchartsModule, CurrencyPipe],
  template: `
  <div class="p-6 space-y-6">
    <h1 class="text-2xl font-semibold text-brand_dark">Panel de Control</h1>

    <!-- Usamos async: cuando llegue el dato se pinta solo -->
    <ng-container *ngIf="dashboard$ | async as d; else loading">
      <!-- Tarjetas resumen -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
        <!-- Salidas de hoy -->
        <div class="card p-5 space-y-3">
          <p class="text-slate-500">Salidas de hoy</p>
          <div class="flex justify-between text-sm text-slate-500">
            <span>Realizadas</span>
            <span>{{ d.salidasRealizadas }} / {{ d.salidasTotales }}</span>
          </div>
          <div class="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              class="h-full bg-sky-500 transition-all"
              [style.width.%]="
                d.salidasTotales
                  ? (d.salidasRealizadas / d.salidasTotales) * 100
                  : 0
              "
            ></div>
          </div>
        </div>

        <!-- Llegadas de hoy -->
        <div class="card p-5 space-y-3">
          <p class="text-slate-500">Llegadas de hoy</p>
          <div class="flex justify-between text-sm text-slate-500">
            <span>Realizadas</span>
            <span>{{ d.llegadasRealizadas }} / {{ d.llegadasTotales }}</span>
          </div>
          <div class="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              class="h-full bg-emerald-500 transition-all"
              [style.width.%]="
                d.llegadasTotales
                  ? (d.llegadasRealizadas / d.llegadasTotales) * 100
                  : 0
              "
            ></div>
          </div>
        </div>

        <!-- Ocupación actual -->
        <div class="card p-5 space-y-3">
          <p class="text-slate-500">Ocupación actual</p>
          <div class="flex items-baseline gap-2">
            <span class="text-4xl font-semibold text-sky-600">
              {{ d.ocupadas }}
            </span>
            <span class="text-slate-500">
              de {{ d.totalHabs }}
            </span>
          </div>
          <p class="text-xs text-slate-500">
            {{ d.totalHabs - d.ocupadas }} habitaciones disponibles -
            {{
              d.totalHabs
                ? ((d.ocupadas / d.totalHabs) * 100).toFixed(0)
                : 0
            }} %
          </p>
        </div>
        <!--  TARIFA PROMEDIO  -->
        <div class="card p-5 space-y-3 md:col-span-1 bg-white shadow-md rounded-xl border border-sky-100">
          <p class="text-slate-500">Tarifa promedio</p>

          <div class="flex items-baseline gap-2">
            <span class="text-4xl font-semibold text-sky-600">
              {{ d.tarifaPromedio | currency:'MXN':'symbol':'1.0-0' }}
            </span>
          </div>

          <p class="text-xs text-slate-500">Promedio de tarifas base de habitaciones activas</p>
        </div>
      </div>

      <!-- Parte de abajo: actividad + gráfico -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6">
        <!-- Actividad reciente -->
        <div class="card p-5">
          <p class="text-slate-500 mb-3">Actividad Reciente</p>

          <ul class="space-y-2" *ngIf="d.actividad.length; else sinActividad">
            <li
              *ngFor="let item of d.actividad"
              class="flex items-center gap-3 text-sm"
            >
              <span
                class="inline-block w-2 h-2 rounded-full"
                [ngClass]="{
                  'bg-emerald-500': item.tipo === 'checkin',
                  'bg-sky-500': item.tipo === 'reserva',
                  'bg-rose-500': item.tipo === 'checkout',
                  'bg-amber-500': item.tipo === 'mantenimiento',
                  'bg-slate-400': item.tipo === 'cancelacion'
                }"
              ></span>
              <span class="text-slate-700">{{ item.texto }}</span>
            </li>
          </ul>

          <ng-template #sinActividad>
            <p class="text-sm text-slate-400">
              No hay actividad registrada hoy.
            </p>
          </ng-template>
        </div>

        <!-- Estado de Habitaciones -->
        <div class="card p-5">
          <p class="text-slate-500 mb-3">Estado de Habitaciones</p>

          <!-- Gráfico de dona -->
          <apx-chart
            [series]="getSeries(d)"
            [chart]="chartConfig"
            [labels]="getLabels(d)"
            [legend]="chartLegend"
          ></apx-chart>

          
        </div>
      </div>
    </ng-container>

    <ng-template #loading>
      <div class="mt-2 text-sm text-slate-400">
        Cargando resumen del hotel...
      </div>
    </ng-template>
  </div>
  `,
})
export class DashboardComponent {
  
  // Observable: Angular lo maneja con el async pipe
  dashboard$: Observable<DashboardResponse>;

  constructor(private http: HttpClient) {
    this.dashboard$ = this.http.get<DashboardResponse>(
      '${environment.apiUrl}/dashboard/resumen'
    );
  }

    // Config básica del gráfico de dona
    chartConfig: ApexChart = {
      type: 'donut',
      height: 230
    };

    chartLegend: ApexLegend = {
      position: 'bottom'
    };

    // Helpers para construir series/labels a partir del resultado del API
    getSeries(d: DashboardResponse): number[] {
      return d.estadosHabitacion.map((e) => e.cantidad);
    }

    getLabels(d: DashboardResponse): string[] {
      return d.estadosHabitacion.map((e) => e.estado);
    }


  

  estadoColorClass(estado: string): string {
    switch (estado) {
      case 'Disponible':
      case 'disponible':
        return 'bg-emerald-400';
      case 'Ocupada':
      case 'ocupada':
        return 'bg-sky-500';
      case 'Mantenimiento':
      case 'mantenimiento':
      case 'inactiva':
        return 'bg-amber-400';
      default:
        return 'bg-slate-300';
    }
  }
}

