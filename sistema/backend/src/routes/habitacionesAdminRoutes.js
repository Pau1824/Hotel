// routes/habitacionesAdminRoutes.js
import express from 'express';
import pool from '../db.js';
import { authRequired, requireRoles } from '../middleware/auth.js'; // si manejas roles puedes validar admin aquí

const router = express.Router();

/**
 * GET /api/habitaciones-admin
 * Lista completa SOLO para administración
 */
router.get('/', authRequired, async (req, res) => {
  try {
    const scopeHotelId = req.scopeHotelId;

    const sql = `
      SELECT 
        h.id_habitacion,
        h.numero_habitacion,
        h.piso,
        h.capacidad,
        h.tarifa_base,
        h.estado,
        h.amenidades,
        h.notas,
        t.nombre_tipo
      FROM habitaciones h
      LEFT JOIN tipos_habitaciones t ON t.id_tipo = h.id_tipo
      WHERE h.id_hotel = $1
      ORDER BY h.numero_habitacion;
    `;

    const { rows } = await pool.query(sql, [scopeHotelId]);

    res.json(rows);
  } catch (err) {
    console.error(`GET /habitaciones-admin error:`, err);
    res.status(500).json({ error: 'Error al cargar habitaciones del administrador' });
  }
});


// GET /api/habitaciones/config - versión especial para admin
router.get('/config', authRequired, async (req, res) => {
  try {
    const scopeHotelId = req.scopeHotelId;

    const sql = `
      SELECT
        h.id_habitacion,
        h.id_tipo,
        h.numero_habitacion,
        h.piso,
        t.nombre AS tipo,
        h.capacidad,
        h.tarifa_base,
        h.estado,
        h.notas
      FROM habitaciones h
      LEFT JOIN tipos_habitaciones t ON t.id_tipo = h.id_tipo
      WHERE h.id_hotel = $1
      ORDER BY h.numero_habitacion ASC
    `;

    const { rows } = await pool.query(sql, [scopeHotelId]);

    res.json(rows);
  } catch (error) {
    console.error('GET /habitaciones/config', error);
    res.status(500).json({ error: 'Error al obtener habitaciones config' });
  }
});

// GET /api/tipos-habitaciones
router.get('/tipos-habitaciones', authRequired, async (req, res) => {
  const { rows } = await pool.query(`
    SELECT id_tipo, nombre 
    FROM tipos_habitaciones
    ORDER BY nombre
  `);

  res.json(rows);
});



// POST /api/habitaciones-admin/crear
router.post('/crear', authRequired, async (req, res) => {
  try {
    const scopeHotelId = req.scopeHotelId;
    const {
      numero_habitacion,
      piso,
      capacidad,
      tarifa_base,
      notas,
      id_tipo
    } = req.body;

    if (!numero_habitacion || !id_tipo) {
      return res
        .status(400)
        .json({ error: 'Número y tipo de habitación son obligatorios.' });
    }

    const sql = `
      INSERT INTO habitaciones (
        id_hotel,
        id_tipo,
        numero_habitacion,
        piso,
        capacidad,
        tarifa_base,
        notas
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id_habitacion;
    `;

    const params = [
      scopeHotelId,
      id_tipo,
      numero_habitacion,
      piso,
      capacidad,
      tarifa_base,
      notas
    ];

    const { rows } = await pool.query(sql, params);

    return res.json({
      ok: true,
      mensaje: 'Habitación creada correctamente',
      id_habitacion: rows[0].id_habitacion
    });

  } catch (e) {
    console.error('POST /habitaciones-admin/crear', e);
    return res.status(500).json({
      error: 'Error al crear habitación'
    });
  }
});


// PUT /api/habitaciones-admin/:id
router.put('/:id', authRequired, requireRoles('admin_local'), async (req, res) => {
  try {
    const id = req.params.id;
    const {
      numero_habitacion,
      piso,
      tarifa_base,
      notas
    } = req.body;

    const sql = `
      UPDATE habitaciones
      SET 
        numero_habitacion = $1,
        piso = $2,
        tarifa_base = $3,
        notas = $4,
        actualiza_tiempo = NOW()
      WHERE id_habitacion = $5
      RETURNING *;
    `;

    const { rows } = await pool.query(sql, [
      numero_habitacion,
      piso,
      tarifa_base,
      notas,
      id
    ]);

    return res.json({ mensaje: "Habitación actualizada", habitacion: rows[0] });
  } catch (err) {
    console.error("PUT /habitaciones-admin error:", err);
    res.status(500).json({ error: "Error al actualizar habitación" });
  }
});





/**
 * PUT /api/habitaciones-admin/:id/estado
 * Cambiar estado (disponible, mantenimiento, inactiva)
 */
router.put("/:id_habitacion/estado", authRequired, async (req, res) => {
  const client = await pool.connect();

  try {
    const scopeHotelId = req.scopeHotelId;
    const { id_habitacion } = req.params;
    const { nuevoEstado } = req.body;

    if (!["disponible", "mantenimiento", "inactiva"].includes(nuevoEstado)) {
      return res.status(400).json({ error: "Estado no válido" });
    }

    // 1. Verificar que la habitación pertenece al hotel
    const { rows: habRows } = await client.query(
      `SELECT * FROM habitaciones WHERE id_habitacion = $1 AND id_hotel = $2`,
      [id_habitacion, scopeHotelId]
    );

    if (!habRows.length) {
      return res
        .status(404)
        .json({ error: "Habitación no encontrada en este hotel" });
    }

    const habitacion = habRows[0];
    const idTipo = habitacion.id_tipo;

    // 2. Si NO es mantenimiento → solo actualizar estado
    if (nuevoEstado !== "mantenimiento") {
      await client.query(
        `UPDATE habitaciones SET estado = $1 WHERE id_habitacion = $2`,
        [nuevoEstado, id_habitacion]
      );

      return res.json({
        message: "Estado actualizado correctamente",
        reservas_afectadas: [],
      });
    }

    // 3. Si ES MANTENIMIENTO → buscar reservas activas / en_curso / futuras
    const { rows: reservas } = await client.query(
      `
      SELECT 
        id_reservacion,
        folio,
        id_habitacion,
        nombre_huesped,
        apellido1_huesped,
        check_in,
        check_out
      FROM reservaciones
      WHERE id_habitacion = $1
      AND estado IN ('activa','en_curso','finalizada')
      AND check_out >= CURRENT_DATE   -- incluye futuras sin límite
      ORDER BY check_in;
    `,
      [id_habitacion]
    );
    console.log("RESERVAS A REUBICAR:", reservas);

    if (!reservas.length) {
      // No afecta reservas → solo marcar mantenimiento
      await client.query(
        `UPDATE habitaciones SET estado = 'mantenimiento' WHERE id_habitacion = $1`,
        [id_habitacion]
      );

      return res.json({
        message: "Habitación puesta en mantenimiento",
        reservas_afectadas: [],
      });
    }

    // 4. Buscar OTRAS habitaciones del MISMO TIPO disponibles
    const { rows: alternativas } = await client.query(
      `
      SELECT id_habitacion, numero_habitacion
      FROM habitaciones
      WHERE id_hotel = $1
        AND id_tipo = $2
        AND estado = 'disponible'
        AND id_habitacion != $3
      ORDER BY numero_habitacion;
      `,
      [scopeHotelId, idTipo, id_habitacion]
    );

    if (alternativas.length < reservas.length) {
      // No alcanza para reubicar a todos → cancelar
      return res.status(409).json({
        error: "No hay habitaciones disponibles del mismo tipo",
        reservas_afectadas: reservas.map((r) => ({
          id_reservacion: r.id_reservacion,
          huesped: `${r.nombre_huesped} ${r.apellido1_huesped}`,
          fecha_entrada: r.check_in,
          fecha_salida: r.check_out,
        })),
      });
    }

    // 5. Reubicar UNA POR UNA
    const movimientos = [];

    for (let i = 0; i < reservas.length; i++) {
      const r = reservas[i];
      const nuevaHab = alternativas[i];

      await client.query(
        `
        UPDATE reservaciones 
        SET id_habitacion = $1 
        WHERE id_reservacion = $2
      `,
        [nuevaHab.id_habitacion, r.id_reservacion]
      );

      movimientos.push({
        folio: r.folio,
        id_reservacion: r.id_reservacion,
        vieja_habitacion: habitacion.numero_habitacion,
        nueva_habitacion: nuevaHab.numero_habitacion,
      });
    }

    // 6. Finalmente poner la habitación en mantenimiento
    await client.query(
      `UPDATE habitaciones SET estado = 'mantenimiento' WHERE id_habitacion = $1`,
      [id_habitacion]
    );

    return res.json({
      message: "Habitación puesta en mantenimiento y reservas reubicadas",
      reservas_afectadas: movimientos,
    });
  } catch (err) {
    console.error("PUT /habitaciones-admin/:id/estado error:", err);
    return res.status(500).json({
      error: "Error al cambiar el estado de la habitación",
    });
  } finally {
    client.release();
  }
});




/**
 * PUT /api/habitaciones-admin/:id/reubicar
 * Reubicar automáticamente reservas afectadas por mantenimiento
 */
router.put('/:id_habitacion/reubicar', authRequired, async (req, res) => {
  try {
    const scopeHotelId = req.scopeHotelId;
    const { id_habitacion } = req.params;

    // 1) Obtener reservas activas ocupando la habitación
    const { rows: reservas } = await pool.query(
      `
      SELECT id_reservacion, id_habitacion, check_in, check_out
      FROM reservaciones
      WHERE id_hotel = $1
        AND id_habitacion = $2
        AND estado IN ('activa','en_curso')
      `,
      [scopeHotelId, id_habitacion]
    );

    if (!reservas.length) {
      return res.json({ message: 'No hay reservas afectadas' });
    }

    // 2) Obtener habitaciones alternativas
    const { rows: disponibles } = await pool.query(
      `
      SELECT *
      FROM habitaciones
      WHERE id_hotel = $1
        AND estado = 'disponible'
        AND id_habitacion != $2
      ORDER BY numero_habitacion
      `,
      [scopeHotelId, id_habitacion]
    );

    if (!disponibles.length) {
      return res.status(409).json({
        error: 'No hay habitaciones disponibles para reubicar'
      });
    }

    // 3) Reubicar cada reserva a la primera opción disponible
    for (const r of reservas) {
      const nueva = disponibles.shift(); // tomar la primera disponible
      if (!nueva) break;

      await pool.query(
        `
        UPDATE reservaciones
        SET id_habitacion = $1
        WHERE id_reservacion = $2
        `,
        [nueva.id_habitacion, r.id_reservacion]
      );
    }

    res.json({
      message: 'Reservas reubicadas correctamente',
      total: reservas.length
    });
  } catch (err) {
    console.error(`PUT /habitaciones-admin/:id/reubicar error:`, err);
    res.status(500).json({ error: 'Error al reubicar reservas' });
  }
});

export default router;
