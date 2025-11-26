import { Component, OnInit } from '@angular/core';
import {
  CommonModule,
  NgIf, 
  NgFor,
  NgClass,
  CurrencyPipe,
  TitleCasePipe,
} from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { HabitacionesService } from './habitaciones.service';


interface HabitacionApi {
  id_habitacion: number;
  numero_habitacion: string;
  tipo: string;
  tarifa_base: number;
  adultos_max: number;
  ninos_max: number;
  estado: string;
  huesped?: string | null;
}

interface HabitacionCard {
  id: number;
  numero: string;
  tipo: string;
  tarifa: number;
  adultosMax: number;
  ninosMax: number;
  estado: string;
  huesped?: string | null;
}

@Component({
  selector: 'app-habitaciones',
  standalone: true,
  imports: [CommonModule, NgIf, NgFor, NgClass, CurrencyPipe, TitleCasePipe],
  providers: [HabitacionesService],
  templateUrl: './habitaciones.component.html',
  styleUrls: ['./habitaciones.component.css'],
})
export class HabitacionesComponent implements OnInit {
  habitaciones: HabitacionCard[] = [];
  cargando = false;
  error = '';

  constructor(private habitacionesService: HabitacionesService) {}

  ngOnInit(): void {
    this.cargarHabitaciones();
  }

  cargarHabitaciones() {
  this.cargando = true;
  this.error = '';

  this.habitacionesService.getHabitaciones().subscribe({
    next: (data) => {
      console.log('Datos recibidos:', data);

      this.habitaciones = data.map((h: any) => ({
        id: h.id_habitacion,
        numero: h.numero,
        tipo: h.tipo,
        tarifa: Number(h.tarifa_base),
        adultosMax: h.adultos_max,
        ninosMax: h.ninos_max,
        estado: h.estado,
        huesped: h.huesped ?? null,
      }));

      this.cargando = false;
      console.log('Habitaciones asignadas:', this.habitaciones);
    },
    error: (err) => {
      console.error('Error cargando habitaciones', err);
      this.error = 'No se pudieron cargar las habitaciones.';
      this.cargando = false;
    },
  });
}



  // helpers para el template
  getEstadoBadgeClass(estado: string) {
    switch (estado) {
      case 'disponible':
        return 'bg-emerald-100 text-emerald-700';
      case 'ocupada':
        return 'bg-amber-100 text-amber-700';
      case 'mantenimiento':
        return 'bg-rose-100 text-rose-700';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  }

  getEstadoFooterText(estado: string) {
    switch (estado) {
      case 'disponible':
        return 'Disponible';
      case 'ocupada':
        return 'Ocupada';
      case 'mantenimiento':
        return 'En mantenimiento';
      default:
        return estado;
    }
  }

  puedeReservar(h: HabitacionCard) {
    return h.estado === 'disponible';
  }
}
