import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule, NgIf, NgFor, NgClass, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReservasService } from './reservas.service';
import { HttpClient } from '@angular/common/http';
import Swal from 'sweetalert2';


@Component({
  selector: 'app-reserva-detalle',
  standalone: true,
  templateUrl: './reserva-detalle.component.html',
  styleUrls: ['./reserva-detalle.component.css'],
  imports: [
    CommonModule,
    FormsModule,
    NgClass,
    NgIf,
    NgFor,
    CurrencyPipe
  ]
})
export class ReservaDetalleComponent {

  // ========= DATOS QUE VIENEN DEL PADRE =========
  @Input() reserva: any = {};
  @Input() habitaciones: any[] = [];
  @Input() movimientos: any[] = [];
  @Input() catalogo: any[] = [];

  // ========= EVENTOS HACIA EL PADRE =========
  @Output() onCerrar = new EventEmitter<void>();
  @Output() onGuardarCambios = new EventEmitter<any>();
  @Output() onCancelarReserva = new EventEmitter<void>();
  @Output() onRegistrarMovimiento = new EventEmitter<any>();
  @Output() cambiosGuardados = new EventEmitter<any>();


  reservaEditable: any = {}; // <- copia temporal segura

  drawerAbierto = true;

  soloLetras = /^[A-Za-zÁÉÍÓÚÑáéíóúñ\s]+$/;
  nombre: string = '';
  apellido: string = '';
  today: string = this.getLocalToday();


  // ========= NUEVO MOVIMIENTO =========
  nuevoMovimiento = {
  tipo: "cargo",
  id_concepto: null,
  descripcion: "",
  monto: 0,
  nota: ""
};

  

  constructor(
    private reservasService: ReservasService,
    private http: HttpClient
  ) {}

  actualizarDescripcion() {
    const concepto = this.catalogo.find(c => c.id_concepto == this.nuevoMovimiento.id_concepto);
    this.nuevoMovimiento.descripcion = concepto ? concepto.nombre : "";
    this.nuevoMovimiento.monto = concepto ? concepto.monto : 0;
  }



  ngOnChanges() {
    console.log("RESERVA LLEGANDO AL MODAL:", this.reserva);
    // Si no hay reserva, no hacemos nada
    if (!this.reserva) return;

    // ⚠️ Si ya tengo reservaEditable para ESTE MISMO id, no la vuelvas a pisar
    if (this.reservaEditable && this.reservaEditable.id === this.reserva.id) {
      return;
    }

    this.reservaEditable = {
      ...this.reserva,
      id_reservacion: this.reserva.id,
      nombre: this.reserva.nombre ?? this.reserva.nombre_huesped ?? '',
      apellido: this.reserva.apellido ?? this.reserva.apellido1_huesped ?? '',
      check_in: this.toDateInput(this.reserva.check_in),
      check_out: this.toDateInput(this.reserva.check_out),

      estado: this.reserva.estado,

      adultos: Number(this.reserva.adultos ?? 1),
      ninos: Number(this.reserva.ninos ?? 0),
      tarifa_base: Number(this.reserva.tarifa_base || 0),
      id_habitacion: Number(this.reserva.id_habitacion),

    };

    console.log("DEBUG ESTADO FINAL:", {
      estado: this.reservaEditable.estado,
      checkInReal: this.reservaEditable.check_in_real,
      checkOutReal: this.reservaEditable.check_out_real,
      checkIn: this.reservaEditable.check_in,
      checkOut: this.reservaEditable.check_out,
      puedeCheckIn: this.puedeCheckIn(),
      puedeCheckOut: this.puedeCheckOut()
    });


    this.recalcular();
  }


  onConceptoChange() {
    const c = this.catalogo.find(x => x.id_concepto == this.nuevoMovimiento.id_concepto);
    this.nuevoMovimiento.descripcion = c?.nombre || "";
  }


  private toastAccion(icon: 'success' | 'info' | 'warning' | 'error', title: string, text: string) {
    Swal.fire({
      icon,
      title,
      html: `<p style="margin:4px 0; font-size:13px; color:#4b5563;">${text}</p>`,
      confirmButtonText: 'Cerrar',
      confirmButtonColor: '#0f766e',
      background: '#ffffff',
      color: '#0f172a',
      customClass: {
        popup: 'rounded-2xl shadow-lg',
        title: 'text-lg font-semibold',
      }
    });
  }


  private mostrarSaldoPendiente() {
    const saldo = Math.abs(this.saldo).toLocaleString('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2
    });

    Swal.fire({
      icon: 'warning',
      title: 'Saldo pendiente',
      html: `
        <div style="text-align:left; font-size:13px; color:#4b5563;">
          <p style="margin:0 0 6px;">
            Esta reserva todavía tiene un saldo <b>pendiente por pagar</b>.
          </p>
          <p style="margin:0 0 4px; font-size:12px;">
            Saldo actual: 
            <span style="color:#0f766e; font-weight:600;">
              ${saldo}
            </span>
          </p>
          <p style="margin:8px 0 0; font-size:12px; color:#6b7280;">
            Registra el pago en el estado de cuenta antes de hacer el check-out.
          </p>
        </div>
      `,
      showCancelButton: false,
      confirmButtonText: 'Ir al estado de cuenta',
      confirmButtonColor: '#0f766e',
      background: '#f9fafb',
      color: '#0f172a',
      customClass: {
        popup: 'rounded-2xl shadow-lg',
        title: 'text-lg font-semibold',
      }
    });
  }










  // ========= MÉTODOS QUE FALTABAN =========
  cerrar() {
    this.onCerrar.emit();
  }

  get totalCargos() {
    return this.movimientos
      .filter(m => m.tipo === 'cargo')
      .reduce((acc, m) => acc + Number(m.cantidad || m.monto || 0), 0);
  }

  get totalAbonos() {
    return this.movimientos
      .filter(m => m.tipo === 'abono')
      .reduce((acc, m) => acc + Number(m.cantidad || m.monto || 0), 0);
  }

  get saldo() {
    return this.totalAbonos - this.totalCargos;
  }

  get estadoBloqueado(): boolean {
    const est = this.reservaEditable?.estado;
    return est === 'cancelada' || est === 'finalizada';
  }


  private toLocalDate(str: string): Date {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }

  private getLocalToday(): string {
    const d = new Date();
    d.setHours(0,0,0,0); // evitar saltos por zona horaria
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }



  // =============================
  //  VALIDACIONES (MISMAS QUE NUEVA RESERVA)
  // =============================
  validarFechas(): string | null {
    const llegada = this.reservaEditable.check_in;
    const salida = this.reservaEditable.check_out;
    if (!llegada || !salida) return 'Debe seleccionar fechas válidas.';

    const inDate  = this.toLocalDate(llegada);
    const outDate = this.toLocalDate(salida);
    const hoy     = this.toLocalDate(this.today);

    if (inDate < hoy) return 'La fecha de llegada no puede ser antes de hoy.';
    if (outDate <= inDate) return 'El check-out debe ser posterior al check-in.';
    return null;
  }

  validarPersonas(): string | null {
    const h = this.habitaciones.find(x => x.id_habitacion == this.reservaEditable.id_habitacion);
    if (!h) return null;

    const adultos = this.reservaEditable.adultos;
    const ninos = this.reservaEditable.ninos;

    const maxAdultos = h.adultos_max + h.adultos_extra_max;
    const maxNinos = h.ninos_max + h.ninos_extra_max;

    if (adultos > maxAdultos) return `Máximo ${maxAdultos} adultos permitidos.`;
    if (ninos > maxNinos) return `Máximo ${maxNinos} niños permitidos.`;

    return null;
  }

  validarCapacidad() {
    const hab = this.habitaciones.find(h => h.id_habitacion === this.reservaEditable.id_habitacion);

    const totalPersonas = this.reservaEditable.adultos + this.reservaEditable.ninos;

    if (this.reservaEditable.adultos > hab.max_adultos) {
        return `Máximo ${hab.max_adultos} adultos para esta habitación`;
    }

    if (this.reservaEditable.ninos > hab.max_ninos) {
        return `Máximo ${hab.max_ninos} niños para esta habitación`;
    }

    if (totalPersonas > hab.capacidad_total) {
        return `La habitación no soporta ${totalPersonas} personas`;
    }

    return null;
    }


  normalizeDate(dateStr: string) {
    const [day, month, year] = dateStr.split('/');
    return `${year}-${month}-${day}`;
    }


  // =============================
  //     RECÁLCULOS
  // =============================
  recalcular() {
    const errF = this.validarFechas();
    const errC = this.validarPersonas();
    if (errF || errC) return;

    const tarifa = this.reservaEditable.tarifa_base;

    const inDate = new Date(this.reservaEditable.check_in);
    const outDate = new Date(this.reservaEditable.check_out);
    const noches = Math.max(1, Math.ceil((outDate.getTime() - inDate.getTime()) / (1000 * 3600 * 24)));

    this.reservaEditable.noches = noches;
    this.reservaEditable.total = tarifa * noches;
  }


  private toIso(fecha: string | null): string | null {
  if (!fecha) return null;

  // Caso cuando el input ya viene en formato "YYYY-MM-DD"
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return fecha;
  }

  // Caso "DD/MM/YYYY"
  if (fecha.includes('/')) {
    const [d, m, y] = fecha.split('/');
    return `${y}-${m}-${d}`;
  }

  // Si viene algo raro, lo dejamos nulo
  return null;
}


private toDateInput(fecha: string | null): string {
  if (!fecha) return '';

  // Ya viene en ISO → lo dejamos
  if (fecha.includes('-')) return fecha;

  // Convertir de DD/MM/YYYY → YYYY-MM-DD
  const partes = fecha.split('/');
  if (partes.length === 3) {
    const [d, m, y] = partes;
    return `${y}-${m}-${d}`;
  }

  return '';
}

onFechaChange() {
  // Normaliza ambas fechas a formato YYYY-MM-DD
  this.reservaEditable.check_in  = this.toDateInput(this.reservaEditable.check_in);
  this.reservaEditable.check_out = this.toDateInput(this.reservaEditable.check_out);

  // Lanza el recálculo después de limpiar formato
  this.recalcular();
}

private toDateOnly(str: string): string {
  if (!str) return '';
  return str.split('T')[0];  // garantiza YYYY-MM-DD limpio
}


  

  guardarCambios() {
  if (!this.reservaEditable) {
    alert('Error interno: no hay reserva cargada.');
    return;
  }

  if (!this.reservaEditable.id_reservacion && !this.reservaEditable.id) {
    console.error('⚠️ reservaEditable:', this.reservaEditable);
    alert('Error interno: la reserva no tiene ID.');
    return;
  }

  if (!this.soloLetras.test(this.reservaEditable.nombre.trim())) {
    alert("El nombre solo puede contener letras.");
    return;
  }

  if (!this.soloLetras.test(this.reservaEditable.apellido.trim())) {
    alert("El apellido solo puede contener letras.");
    return;
  }


  const id = this.reservaEditable.id_reservacion ?? this.reservaEditable.id;

  const payload = {
    id_reservacion: this.reservaEditable.id,
    nombre: this.reservaEditable.nombre,
    apellido: this.reservaEditable.apellido,
    llegada: this.toDateOnly(this.reservaEditable.check_in),
    salida: this.toDateOnly(this.reservaEditable.check_out),
    adultos: this.reservaEditable.adultos,
    ninos: this.reservaEditable.ninos,
    id_habitacion: this.reservaEditable.id_habitacion
  };

  console.log('Payload a enviar:', payload);

  if (!payload.id_reservacion) {
    alert("Error: reserva sin ID");
    return;
  }

  // (si quieres, aquí puedes reactivar tus validaciones de fechas/personas)

  this.reservasService.actualizarReserva(payload.id_reservacion, payload).subscribe({
    next: (resp: any) => {
      Swal.fire({
        title: 'Reserva actualizada',
        html: `
          <div style="
            font-size: 14px;
            text-align: left;
            line-height: 1.6;
          ">
            <b>Noches:</b> ${resp.noches}<br>
            <b>Renta base:</b> $${resp.renta_base}<br>
            <b>Adultos extra:</b> ${resp.adultos_extra}<br>
            <b>Niños extra:</b> ${resp.ninos_extra}<br>
            <b>Total:</b> <span style="color:#007566; font-weight:600;">$${resp.cargos_detalle.total}</span>
          </div>
        `,
        iconHtml: `
          <div style="
            width: 60px;
            height: 60px;
            border-radius: 50%;
            backdrop-filter: blur(8px);
            background: rgba(255,255,255,0.25);
            display:flex;
            align-items:center;
            justify-content:center;
            border: 2px solid rgba(255,255,255,0.4);
          ">
            ✔
          </div>
        `,
        customClass: {
          popup: 'swal-glass',
          title: 'swal-title-glass'
        },
        showConfirmButton: false,
        timer: 4000,
        backdrop: `
          rgba(0,0,0,0.15)
        `
      });
      this.cambiosGuardados.emit({
        id_reservacion: payload.id_reservacion,
        nombre_huesped: payload.nombre,
        apellido1_huesped: payload.apellido,
        check_in: this.toIso(this.reservaEditable.check_in),
        check_out: this.toIso(this.reservaEditable.check_out),
        adultos: this.reservaEditable.adultos,
        ninos: this.reservaEditable.ninos,
        id_habitacion: this.reservaEditable.id_habitacion,
        total_pagar: resp.cargos_detalle?.total ?? resp.total ?? null
      });
    },
    error: (err) => {
      console.error('Error actualizando reserva:', err);
      alert('Error guardando cambios');
    }
  });
  }

  onHabitacionChange(nuevaHab: number) {
    console.log("Cambio de habitación detectado:");
    console.log("Nueva habitación seleccionada:", this.reservaEditable.id_habitacion);
    console.log("Nuevo ID habitación:", nuevaHab);
    this.reservaEditable.id_habitacion = nuevaHab;
  }





  cancelarReserva() {
    const id = this.reservaEditable.id_reservacion;

    Swal.fire({
      title: 'Cancelar reserva',
      text: '¿Seguro que deseas cancelar esta reservación?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, cancelar',
      cancelButtonText: 'No, conservar',
      reverseButtons: true,
      background: '#f9fafb',
      color: '#0f172a',
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b',
    }).then((result) => {
      if (!result.isConfirmed) return; // si le da "No", no hacemos nada

      this.reservasService.cancelarReserva(id).subscribe({
        next: (resp) => {
          this.toastAccion(
            'info',
            'Reserva cancelada',
            `La reserva <b>${this.reservaEditable.folio ?? ''}</b> fue cancelada correctamente.`
          );

          this.cambiosGuardados.emit({
            id_reservacion: id,
            estado: 'Cancelada'
          });
        },
        error: (err) => {
          console.error(err);
          this.toastAccion(
            'warning',
            'Error al cancelar',
            err.error?.error || 'Ocurrió un error al cancelar la reserva.'
          );
        }
      });
    });
  }


  // =============================
  //     REGISTRAR MOVIMIENTO
  // =============================
  registrarMovimiento() {

    if (
      !this.nuevoMovimiento.tipo ||
      !this.nuevoMovimiento.id_concepto ||
      this.nuevoMovimiento.monto <= 0
    ) {
      Swal.fire({
        icon: 'warning',
        title: 'Falta información',
        text: 'Completa el movimiento correctamente.',
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#0f766e',
        background: '#f9fafb',
        color: '#0f172a'
      });
      return;
    }

    const concepto = this.catalogo.find(c => c.id_concepto === this.nuevoMovimiento.id_concepto);
    const descripcion = concepto ? concepto.nombre : '';


    const payload = {
      tipo: this.nuevoMovimiento.tipo.toLowerCase(),
      descripcion: this.nuevoMovimiento.descripcion,
      id_concepto: this.nuevoMovimiento.id_concepto,
      cantidad: this.nuevoMovimiento.monto,
      nota: this.nuevoMovimiento.nota ?? ""
    };

    this.reservasService.crearMovimiento(this.reserva.id, payload).subscribe({
      next: (resp) => {
        console.log("Movimiento registrado:", resp);
        this.toastAccion(
          'success',
          'Movimiento registrado',
          `Se ha registrado un <b>${payload.tipo}</b> de <b>$${payload.cantidad}</b> en la reserva.`
        );

        this.cargarMovimientosYTotales();

        this.cambiosGuardados.emit({
          id_reservacion: this.reserva.id
        });

        this.nuevoMovimiento = {
          tipo: "cargo",
          id_concepto: null,
          monto: 0,
          nota: "",
          descripcion: ""
        };
      },
      error: (err: any) => {
        console.error("Error registrando movimiento:", err);
        this.toastAccion(
          'error',
          'Error al registrar',
          err.error?.error || 'No se pudo registrar el movimiento.'
        );
      } 
      
    });
  }

  cargarMovimientosYTotales() {
  // Validar que sí haya una reserva válida
  if (!this.reserva || !this.reserva.id) {
    console.warn("No hay reserva válida para recargar movimientos");
    return;
  }

  const id = this.reserva.id;

  this.http
    .get<any[]>(`http://localhost:5000/api/reservas/${id}/movimientos`)
    .subscribe({
      next: (movs: any[]) => {
        console.log("Movimientos recargados desde backend:", movs);
        this.movimientos = movs;

        // OJO: no seteamos this.totales
        // Tus totales ya se calculan con los getters:
        //  - get totalCargos()
        //  - get totalAbonos()
        //  - get saldo()
        console.log("totalCargos:", this.totalCargos);
        console.log("totalAbonos:", this.totalAbonos);
        console.log("saldo:", this.saldo);
      },
      error: (err: any) => {
        console.error("Error cargando movimientos:", err);
      }
    });
}





  mostrarCheckIn() {
    if (!this.reservaEditable) return false;

    const hoy = new Date().toISOString().slice(0, 10);
    const checkIn = this.reservaEditable.check_in;

    return (
      this.reservaEditable.estado === 'activa' &&
      checkIn === hoy
    );
  }

  mostrarCheckOut() {
    if (!this.reservaEditable) return false;

    const hoy = new Date().toISOString().slice(0, 10);
    const checkOut = this.reservaEditable.check_out;

    return (
      this.reservaEditable.estado === 'en_curso' &&
      checkOut === hoy
    );
  }


  // Normaliza fecha (quita horas)
  normalizarFecha(fecha: any) {
    const d = new Date(fecha);
    d.setHours(0,0,0,0);
    return d.getTime();
  }

  // ¿Es hoy?
  esHoy(fecha: any) {
    const hoy = new Date();
    hoy.setHours(0,0,0,0);
    return this.normalizarFecha(fecha) === hoy.getTime();
  }

  hoy = this.getHoyLocal();
  getHoyLocal() {
    const now = new Date();

    // Ajustar a medianoche LOCAL (00:00:00)
    now.setHours(0, 0, 0, 0);

    return now;
  }



  puedeCheckIn() {
    console.log("---- VALIDANDO CHECK-IN ----");

    if (!this.reservaEditable) {
      console.log("NO hay reservaEditable");
      return false;
    }

    console.log("ReservaEditable:", this.reservaEditable);
    console.log("Reserva ORIGINAL:", this.reserva);

    // Estado real:
    const estado = this.reserva.estado ?? this.reservaEditable.estado;
    console.log("Estado reserva:", estado);

    // Fechas:
    const hoy = this.hoy.toISOString().split('T')[0];
    const checkIn = new Date(this.reservaEditable.check_in).toISOString().split('T')[0];

    console.log("Hoy:", hoy);
    console.log("Fecha check-in:", checkIn);

      return (
      this.reserva.estado === 'activa' &&
      checkIn === hoy
    );
  }



  puedeCheckOut() {
    console.log("---- VALIDANDO CHECK-OUT ----");

    if (!this.reservaEditable) {
      console.log("NO hay reservaEditable");
      return false;
    }

    console.log("ReservaEditable:", this.reservaEditable);
    console.log("Reserva ORIGINAL:", this.reserva);

    // Estado real:
    const estado = this.reserva.estado ?? this.reservaEditable.estado;
    console.log("Estado reserva:", estado);

    if (estado !== 'en_curso') {
      console.log("NO está en en_curso:", estado);
      return false;
    }

    const hoyStr = this.hoy.toISOString().split('T')[0];
    const fechaCO = this.reservaEditable.check_out;
    const fechaCheckOutStr = new Date(fechaCO).toISOString().split('T')[0];

    console.log("Hoy:", hoyStr);
    console.log("Fecha check-out:", fechaCheckOutStr);

    const allowed = fechaCheckOutStr === hoyStr;

    console.log("¿Puede hacer check-out?:", allowed);

    return allowed;
  }




  hacerCheckIn() {
    const id = this.reservaEditable.id_reservacion;
    this.reservasService.checkIn(id).subscribe({
      next: (resp) => {
        this.toastAccion(
          'success',
          'Check-In realizado',
          `La reserva <b>${this.reservaEditable.folio ?? ''}</b> ha pasado a estado <b>En curso</b>.`
        );

        this.cambiosGuardados.emit({
          id_reservacion: id,
          // solo necesitamos estado aquí
          estado: 'En curso'
        });

      },
      error: (err) => {
        console.error(err);
        alert(err.error?.error || 'Error realizando Check-In');
      }
    });
  }

  hacerCheckOut() {
    // Si hay saldo pendiente (más cargos que abonos), avisamos y NO dejamos continuar
    if (this.saldo < 0) {
      this.mostrarSaldoPendiente();
      return;
    }

    const id = this.reservaEditable.id_reservacion;

    this.reservasService.checkOut(id).subscribe({
      next: (resp) => {
        this.toastAccion(
          'success',
          'Check-Out realizado',
          `La reserva <b>${this.reservaEditable.folio ?? ''}</b> ha sido marcada como <b>Finalizada</b>.`
        );

        this.cambiosGuardados.emit({
          id_reservacion: id,
          estado: 'Finalizada'
        });
      },
      error: (err) => {
        console.error(err);

        // Por si el backend también valida saldo y manda error de texto
        const msg = err.error?.error || 'Ocurrió un error al realizar el Check-Out.';

        if (msg.toLowerCase().includes('saldo')) {
          this.mostrarSaldoPendiente();
        } else {
          this.toastAccion('warning', 'Error en Check-Out', msg);
        }
      }
    });
  }


  





}



