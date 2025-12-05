import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule, NgFor, NgIf, NgClass, CurrencyPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import Swal from 'sweetalert2';
import { FormsModule } from '@angular/forms';
import { environment } from '../../environments/environment';

interface HabitacionConfig {
  id_habitacion: number;
  id_tipo: number | null;  
  numero_habitacion: string;
  piso: number | null;
  tipo: string | null;
  capacidad: number | null;
  tarifa_base: number;
  estado: 'disponible' | 'ocupada' | 'mantenimiento' | 'inactiva';
  notas?: string | null;
}

@Component({
  selector: 'app-habitaciones-config',
  standalone: true,
  imports: [CommonModule, FormsModule, NgFor, NgIf, NgClass, CurrencyPipe],
  templateUrl: './habitaciones-config.component.html',
  styleUrls: ['./habitaciones-config.component.css']
})
export class HabitacionesConfigComponent implements OnInit {

  private API = `${environment.apiUrl}/habitaciones-admin`;

  cargando = signal(false);
  error = signal<string | null>(null);
  habitaciones = signal<HabitacionConfig[]>([]);
  tipos = signal<any[]>([]);

  // Filtro rápido por estado
  filtroEstado = signal<'todas' | 'disponible' | 'ocupada' | 'mantenimiento' | 'inactiva'>('todas');

  habitacionesFiltradas = computed(() => {
    const estado = this.filtroEstado(); 
    const list = this.habitaciones();

    if (estado === 'todas') return list;
    return list.filter((h: any) => h.estado === estado);
  });

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.cargarHabitaciones();
    this.cargarTipos();
  }

  cargarHabitaciones() {
    this.cargando.set(true);
    this.error.set(null);

    this.http.get<any[]>(`${this.API}/config`).subscribe({
      next: (rows) => {
        const parsed = rows.map((r) => ({
          id_habitacion: r.id_habitacion,
          id_tipo: r.id_tipo ?? null,
          numero_habitacion: r.numero_habitacion,
          piso: r.piso,
          tipo: r.tipo || null,              // si en el back haces JOIN con tipos_habitaciones
          capacidad: r.capacidad,
          tarifa_base: Number(r.tarifa_base || 0),
          estado: r.estado,
          notas: r.notas || null,
        })) as HabitacionConfig[];

        this.habitaciones.set(parsed);
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('Error cargando habitaciones config:', err);
        this.error.set('No se pudieron cargar las habitaciones.');
        this.cargando.set(false);
      },
    });
  }

  cargarTipos() {
    this.http.get<any[]>('${environment.apiUrl}/tipos-habitaciones')
        .subscribe({
        next: (rows) => this.tipos.set(rows),
        error: (err) => console.error('Error cargando tipos:', err)
        });
    }

  getBadgeClass(estado: string) {
    switch (estado) {
      case 'disponible':
        return 'bg-emerald-100 text-emerald-700';
      case 'ocupada':
        return 'bg-amber-100 text-amber-700';
      case 'mantenimiento':
        return 'bg-sky-100 text-sky-700';
      case 'inactiva':
        return 'bg-slate-100 text-slate-500';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  }

  cambiarEstado(h: HabitacionConfig, nuevoEstado: HabitacionConfig['estado']) {
    // Confirmación antes de mandar la bomba
    let titulo = '';
    let texto = '';

    if (nuevoEstado === 'mantenimiento') {
      titulo = 'Pasar a mantenimiento';
      texto =
        'Se reubicarán automáticamente las reservas activas de esta habitación. ¿Deseas continuar?';
    } else if (nuevoEstado === 'inactiva') {
      titulo = 'Desactivar habitación';
      texto =
        'La habitación no podrá usarse para nuevas reservas hasta que la actives de nuevo.';
    } else if (nuevoEstado === 'disponible') {
      titulo = 'Marcar como disponible';
      texto = 'La habitación volverá a estar disponible para nuevas reservas.';
    } else {
      titulo = 'Cambiar estado';
      texto = '¿Seguro que deseas cambiar el estado de esta habitación?';
    }

    Swal.fire({
      icon: 'question',
      title: titulo,
      text: texto,
      showCancelButton: true,
      confirmButtonColor: '#0ea5e9',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, continuar',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      if (!result.isConfirmed) return;

      this.ejecutarCambioEstado(h, nuevoEstado);
    });
  }

  private ejecutarCambioEstado(h: HabitacionConfig, nuevoEstado: HabitacionConfig['estado']) {
    this.cargando.set(true);

    this.http
      .put<any>(`${this.API}/${h.id_habitacion}/estado`, { nuevoEstado })
      .subscribe({
        next: (resp) => {
          this.cargando.set(false);

          // Actualizar en señal local sin volver a pedir todo (pero puedes recargar si prefieres)
          this.habitaciones.update((list) =>
            list.map((item) =>
              item.id_habitacion === h.id_habitacion
                ? { ...item, estado: nuevoEstado }
                : item
            )
          );

          const afectadas = resp?.reservas_afectadas || [];

          if (nuevoEstado === 'mantenimiento') {
            if (afectadas.length > 0) {
              const detalles = afectadas
                .map(
                  (r: any) =>
                    `Reserva ${r.folio}: ${r.vieja_habitacion} → ${r.nueva_habitacion}`
                )
                .join('\n');

              Swal.fire({
                icon: 'success',
                title: 'Habitación en mantenimiento',
                html:
                  'Se reubicaron las siguientes reservas:<br><pre class="text-left mt-2">' +
                  detalles +
                  '</pre>',
                confirmButtonColor: '#0ea5e9',
                width: 600,
              });
            } else {
              Swal.fire({
                icon: 'success',
                title: 'Habitación en mantenimiento',
                text: 'No había reservas activas asociadas.',
                confirmButtonColor: '#0ea5e9',
              });
            }
          } else {
            Swal.fire({
              icon: 'success',
              title: 'Estado actualizado',
              text: resp?.mensaje || 'La habitación se actualizó correctamente.',
              confirmButtonColor: '#0ea5e9',
            });
          }
        },
        error: (err) => {
          console.error('Error cambiando estado de habitación:', err);
          this.cargando.set(false);

          if (err.status === 409) {
            Swal.fire({
              icon: 'warning',
              title: 'No se pudo completar',
              text:
                err.error?.error ||
                'No fue posible reubicar todas las reservas. La operación fue cancelada.',
              confirmButtonColor: '#0ea5e9',
            });
          } else {
            Swal.fire({
              icon: 'error',
              title: 'Error al actualizar',
              text:
                err.error?.error ||
                'Ocurrió un error al cambiar el estado de la habitación.',
              confirmButtonColor: '#0ea5e9',
            });
          }
        },
      });
  }

  // Placeholder si luego quieres navegar a un formulario de edición
  editarHabitacion(h: HabitacionConfig) {
    // Por ejemplo: this.router.navigate(['/config-habitaciones', h.id_habitacion]);
    Swal.fire({
      icon: 'info',
      title: 'Editar habitación',
      text: `Aquí podrías abrir el formulario de edición para la habitación ${h.numero_habitacion}.`,
      confirmButtonColor: '#0ea5e9',
    });
  }

  // ===== MODAL CREAR HABITACIÓN =====

crearOpen = signal(false);

nueva = signal({
  id_tipo: null,
  numero_habitacion: '',
  piso: null as number | null,
  capacidad: null as number | null,
  tarifa_base: null as number | null,
  notas: ''
});

// ===== GETTERS Y SETTERS PARA NG-MODEL =====
get nuevaForm() {
  return this.nueva();
}

set nuevaForm(value: any) {
  this.nueva.set(value);
}



abrirCrear() {
  this.nueva.set({
    id_tipo: null,
    numero_habitacion: '',
    piso: null,
    capacidad: null,
    tarifa_base: null,
    notas: ''
  });
  this.crearOpen.set(true);
}

cerrarCrear() {
  this.crearOpen.set(false);
}

crearHabitacion() {
  const nueva = this.nueva();
  const payload = {
    id_tipo: this.nueva().id_tipo,
    numero_habitacion: this.nueva().numero_habitacion,
    piso: this.nueva().piso,
    capacidad: null,
    tarifa_base: this.nueva().tarifa_base,
    notas: this.nueva().notas
  };


  // Validación básica
  if (!nueva.numero_habitacion || !nueva.tarifa_base) {
    Swal.fire({
      icon: 'warning',
      title: 'Datos incompletos',
      text: 'Número y tarifa base son obligatorios.',
      confirmButtonColor: '#0ea5e9'
    });
    return;
  }

  this.cargando.set(true);

  this.http.post(`${this.API}/crear`, nueva).subscribe({
    next: (resp: any) => {
      this.cargando.set(false);

      Swal.fire({
        icon: 'success',
        title: 'Habitación creada',
        text: 'La habitación se agregó correctamente.',
        confirmButtonColor: '#0ea5e9'
      });

      // recargar la lista
      this.cargarHabitaciones();
      this.crearOpen.set(false);
    },

    error: (err) => {
      this.cargando.set(false);
      console.error('Error creando habitación:', err);

      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err.error?.error || 'No se pudo crear la habitación.',
        confirmButtonColor: '#0ea5e9'
      });
    }
  });
}

// ===== MODAL EDITAR =====
editarOpen = signal(false);

editando = signal({
  id_habitacion: null as number | null,
  id_tipo: null as number | null,
  numero_habitacion: '',
  piso: null as number | null,
  capacidad: null as number | null,
  tarifa_base: null as number | null,
  notas: ''
});

// ABRIR MODAL
abrirEditar(h: any) {
  this.editando.set({
    id_habitacion: h.id_habitacion,
    id_tipo: h.id_tipo ?? null,
    numero_habitacion: h.numero_habitacion,
    piso: h.piso,
    capacidad: h.capacidad,
    tarifa_base: h.tarifa_base,
    notas: h.notas || ''
  });

  this.editarOpen.set(true);
}

// CERRAR MODAL
cerrarEditar() {
  this.editarOpen.set(false);
}

// GUARDAR CAMBIOS
guardarEdicion() {
  const data = this.editando();

  this.cargando.set(true);

  this.http.put(`${environment.apiUrl}/habitaciones-admin/${data.id_habitacion}`, data)
    .subscribe({
      next: () => {
        this.cargando.set(false);
        this.editarOpen.set(false);

        // Recargar habitaciones
        this.cargarHabitaciones();

        Swal.fire({
          icon: 'success',
          title: 'Habitación actualizada',
          text: 'Los cambios se guardaron correctamente.',
          confirmButtonColor: '#0ea5e9'
        });
      },
      error: (err) => {
        this.cargando.set(false);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: err.error?.error || 'No se pudo actualizar la habitación.',
          confirmButtonColor: '#ef4444'
        });
      }
    });
}


}
