import express from 'express';
import pool from '../db.js';
import { authRequired } from '../middleware/auth.js';

const router = express.Router();

// Obtener tarifa por número de habitación
router.get('/numero/:numero', async (req, res) => {
  console.log("📥 Petición recibida a /habitaciones/numero:", req.params.numero);
  const { numero } = req.params;
  try {
    const {rows} = await pool.query(
      `SELECT tarifa_base AS tarifa,
              numero_habitacion AS numero,
              estado
       FROM habitaciones 
       WHERE numero_habitacion = $1`,
      [numero]
    );
    console.log("📤 Resultado SQL:", rows);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Habitación no encontrada' });
    }

    res.json({
      tarifa: rows[0].tarifa,
      tipo: rows[0].tipo
    });
  } catch (error) {
    console.error('Error al consultar tarifa:', error);
    res.status(500).json({ error: 'Error interno al obtener tarifa' });
  }
});


//Nueva ruta para obtener tarifa
router.get('/tarifa/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      'SELECT tarifa_base AS tarifa FROM habitaciones WHERE id_habitacion = $1',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Habitación no encontrada' });
    }

    res.json(rows[0]); // { tarifa: 1000 }
  } catch (error) {
    console.error("Error consultando tarifa:", error);
    res.status(500).json({ error: 'Error interno' });
  }
});


// GET /api/habitaciones - Obtener todas las habitaciones
router.get('/', authRequired, async (req, res) => {
  try {
    const scopeHotel = req.scopeHotelId; // ver explicación arriba

    const sql = `
      SELECT 
        h.id_habitacion,
        h.numero_habitacion AS numero,
        t.nombre AS tipo,
        h.tarifa_base,
        t.adultos_max,
        t.ninos_max,
        t.adultos_extra_max,
        t.ninos_extra_max,
        t.precio_adulto_extra,
        t.precio_nino_extra,
        t.camas_extra_max,
        t.precio_cama_extra,
        CASE
          WHEN h.estado IN ('mantenimiento','inactiva') THEN INITCAP(h.estado)
          WHEN EXISTS (
            SELECT 1 
            FROM reservaciones r
            WHERE r.id_habitacion = h.id_habitacion
              AND r.estado = 'en_curso'
              AND CURRENT_DATE >= r.check_in
              AND CURRENT_DATE <  r.check_out
          ) THEN 'Ocupada'
          WHEN EXISTS (
            SELECT 1
            FROM reservaciones r
            WHERE r.id_habitacion = h.id_habitacion
              AND r.estado = 'activa'
              AND r.check_in >= CURRENT_DATE
              AND r.check_in <= CURRENT_DATE + INTERVAL '3 day'
          ) THEN 'Reservada'
          ELSE 'Disponible'
        END AS estado,

        -- HUESPED ACTUAL (si está ocupada)
        (
          SELECT CONCAT(r.nombre_huesped, ' ', r.apellido1_huesped)
          FROM reservaciones r
          WHERE r.id_habitacion = h.id_habitacion
            AND r.estado = 'en_curso'
            LIMIT 1
        ) AS huesped

      FROM habitaciones h
      LEFT JOIN tipos_habitaciones t ON t.id_tipo = h.id_tipo
      ${scopeHotel ? 'WHERE h.id_hotel = $1' : ''}
      ORDER BY h.numero_habitacion
    `;

    const params = scopeHotel ? [scopeHotel] : [];
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener habitaciones:', error);
    res.status(500).json({ error: 'Error al obtener habitaciones' });
  }
});


// PUT /api/habitaciones/:numero/estado - Cambiar estado de una habitación
router.put('/:numero/estado', async (req, res) => {
  const { numero } = req.params;
  const { estado } = req.body;

  if (!['Disponible', 'Ocupada', 'Mantenimiento', 'Reservada'].includes(estado)) {
    return res.status(400).json({ error: 'Estado inválido' });
  }

  try {
    const {result} = await pool.query(
      'UPDATE habitaciones SET estado = ? WHERE numero = $1',
      [estado, numero]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Habitación no encontrada' });
    }

    res.json({ mensaje: 'Estado actualizado correctamente' });
  } catch (error) {
    console.error('Error al actualizar estado:', error);
    res.status(500).json({ error: 'Error al actualizar estado' });
  }
});


// PUT /api/reservas/:id/checkin
router.put('/:id/checkin', async (req, res) => {
  const { id } = req.params;

  try {
    // 1. Verificar que la reserva exista y esté en estado 'Reservada'
    const {reservas} = await pool.query(`SELECT * FROM reservas WHERE id_reserva = $1`, [id]);

    if (reservas.length === 0) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    const reserva = reservas[0];
    if (reserva.estado !== 'Reservada') {
      return res.status(400).json({ error: 'Solo se puede hacer Check-In a reservas con estado Reservada' });
    }

    // 2. Actualizar estado de la reserva
    await pool.query(`UPDATE reservas SET estado = 'En curso' WHERE id_reserva = $1`, [id]);

    // 3. Actualizar estado de la habitación a Ocupada
    await pool.query(`UPDATE habitaciones SET estado = 'Ocupada' WHERE id_habitacion = $1`, [reserva.id_habitacion]);

    res.json({ mensaje: 'Check-In realizado con éxito' });
  } catch (error) {
    console.error('Error en Check-In:', error);
    res.status(500).json({ error: 'Error al realizar el Check-In' });
  }
});


router.get('/disponibles', authRequired, async (req, res) => {
  try {
    const scopeHotel = req.scopeHotelId;

    const sql = `
      SELECT 
        h.id_habitacion AS id,
        h.numero_habitacion AS numero,
        t.nombre AS tipo
      FROM habitaciones h
      LEFT JOIN tipos_habitaciones t ON t.id_tipo = h.id_tipo
      WHERE h.estado = 'disponible'
      ${scopeHotel ? 'AND h.id_hotel = $1' : ''}
      ORDER BY h.numero_habitacion
    `;

    const params = scopeHotel ? [scopeHotel] : [];
    const { rows } = await pool.query(sql, params);

    res.json(rows);
    
  } catch (error) {
    console.error('Error al obtener habitaciones disponibles:', error);
    res.status(500).json({ error: 'Error al obtener habitaciones disponibles' });
  }
});

export default router;

