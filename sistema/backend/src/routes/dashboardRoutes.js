// src/routes/dashboardRoutes.js
import express from 'express';
import pool from '../db.js';
import { authRequired } from '../middleware/auth.js';

const router = express.Router();

router.get('/resumen', authRequired, async (req, res) => {
  try {
    const scopeHotel = req.scopeHotelId ?? null;
    // Usaremos siempre $1, que puede ser null
    const params = [scopeHotel];

    // 1️⃣ SALIDAS DE HOY (check_out = hoy)
    const salidasResult = await pool.query(
      `
      SELECT
        COUNT(*) AS totales,
        SUM(
          CASE 
            WHEN estado = 'finalizada' THEN 1 
            ELSE 0 
          END
        ) AS realizadas
      FROM reservaciones
      WHERE check_out = CURRENT_DATE
        AND ($1::int IS NULL OR id_hotel = $1)
      `,
      params
    );

    const salidas = salidasResult.rows[0] || { totales: 0, realizadas: 0 };

    // 2️⃣ LLEGADAS DE HOY (check_in = hoy)
    // totales: todas las reservas con check_in hoy
    // realizadas: las que ya están en_curso o finalizada
    const llegadasResult = await pool.query(
      `
      SELECT
        COUNT(*) AS totales,
        SUM(
          CASE 
            WHEN estado IN ('en_curso','finalizada') THEN 1 
            ELSE 0 
          END
        ) AS realizadas
      FROM reservaciones
      WHERE check_in = CURRENT_DATE
        AND ($1::int IS NULL OR id_hotel = $1)
      `,
      params
    );

    const llegadas = llegadasResult.rows[0] || { totales: 0, realizadas: 0 };

    // 3️⃣ OCUPACIÓN / ESTADO DE HABITACIONES
    // Usamos el campo estado de la tabla habitaciones directamente.
    const habEstadosResult = await pool.query(
      `
      SELECT estado, COUNT(*) AS cantidad
      FROM habitaciones
      WHERE ($1::int IS NULL OR id_hotel = $1)
      GROUP BY estado
      `,
      params
    );

    let totalHabs = 0;
    let disponibles = 0;
    let ocupadas = 0;
    let reservadas = 0;      // lo dejamos en 0 por ahora
    let mantenimiento = 0;

    habEstadosResult.rows.forEach((row) => {
      const cant = Number(row.cantidad) || 0;
      totalHabs += cant;

      switch (row.estado) {
        case 'disponible':
          disponibles = cant;
          break;
        case 'ocupada':
          ocupadas = cant;
          break;
        case 'mantenimiento':
          mantenimiento += cant;
          break;
        case 'inactiva':
          // si quieres, la cuentas como mantenimiento también
          mantenimiento += cant;
          break;
      }
    });

    // 4️⃣ ACTIVIDAD RECIENTE (últimas reservaciones)
    const actividadResult = await pool.query(
      `
      SELECT
        r.estado,
        r.nombre_huesped,
        r.apellido1_huesped,
        r.apellido2_hespued,
        h.numero_habitacion,
        r.hora_creacion AS fecha
      FROM reservaciones r
      JOIN habitaciones h ON h.id_habitacion = r.id_habitacion
      WHERE ($1::int IS NULL OR r.id_hotel = $1)
      ORDER BY r.hora_creacion DESC
      LIMIT 10
      `,
      params
    );

    const actividad = actividadResult.rows.map((row) => {
      let tipo = 'reserva';
      let prefix = 'Nueva reserva';

      if (row.estado === 'en_curso') {
        tipo = 'checkin';
        prefix = 'Check-in';
      } else if (row.estado === 'finalizada') {
        tipo = 'checkout';
        prefix = 'Check-out';
      } else if (row.estado === 'cancelada') {
        tipo = 'cancelacion';
        prefix = 'Reserva cancelada';
      }

      const nombreCompleto = `${row.nombre_huesped ?? ''} ${row.apellido1_huesped ?? ''}`.trim();

      return {
        tipo,
        texto: `${prefix} ${nombreCompleto} - Hab ${row.numero_habitacion}`,
        fecha: row.fecha
      };
    });

    // 5️⃣ RESPUESTA PARA EL FRONT
    res.json({
      salidasRealizadas: Number(salidas.realizadas) || 0,
      salidasTotales: Number(salidas.totales) || 0,

      llegadasRealizadas: Number(llegadas.realizadas) || 0,
      llegadasTotales: Number(llegadas.totales) || 0,

      ocupadas,
      totalHabs,

      estadosHabitacion: [
        { estado: 'Disponible',    cantidad: disponibles },
        { estado: 'Ocupada',       cantidad: ocupadas },
        { estado: 'Mantenimiento', cantidad: mantenimiento }
      ],

      actividad
    });
  } catch (error) {
    console.error('Error en /api/dashboard/resumen:', error);
    res.status(500).json({ error: 'Error al obtener resumen de dashboard' });
  }
});

export default router;

