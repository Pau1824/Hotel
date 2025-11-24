export interface Reserva {
  folio: string;
  nombre: string;
  apellido1_huesped: string;
  apellido2_huesped: string;
  habitacion: number;
  check_in: string;
  check_out: string;
  total: number;
  estado: string;
  noches?: number;  // 'noches' se calcula en el frontend
  nombreCompleto?: string; // Aquí agregamos el campo 'nombreCompleto'
}
