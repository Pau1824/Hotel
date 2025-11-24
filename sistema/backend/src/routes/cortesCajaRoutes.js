// src/routes/cortesCajaRoutes.js
import { Router } from 'express';
import pool from '../db.js';
import { authRequired, requireRoles } from '../middleware/auth.js';

const router = Router();

// Usa el alcance que puso auth.js:
// - admin_cadena: req.scopeHotelId puede venir null (multi-hotel) o forzarse con ?hotel=ID
// - admin_local/recepcionista: req.scopeHotelId = id_hotel del usuario
function requireHotelId(req, res) {
  const id_hotel = req.scopeHotelId ?? req.user?.id_hotel ?? null;
  if (!id_hotel) {
    // Para admin_cadena sin ?hotel=ID, pide el parámetro
    throw Object.assign(new Error('Hotel no especificado'), { code: 'NO_HOTEL' });
  }
  return id_hotel;
}



/**
 * Helpers
 */
const ensureUserHotel = (req) => {
  const id_usuario = req.user?.id_usuario || null;
  const id_hotel   = req.user?.id_hotel || null; // si tu JWT guarda hotel actual
  return { id_usuario, id_hotel };
};

/**
 * Calcula el resumen (preview) del corte para un rango horario y filtros.
 * Por definición de negocio: "corte" = total de ABONOS cobrados (pagos recibidos),
 * desglosados por método de pago.
 */
async function calcularResumenCorte({ desde, hasta, id_usuario, id_hotel }) {
  // Filtros dinámicos
  const where = [];
  const vals = [];
  let i = 1;

  // rango de tiempo
  if (desde) { where.push(`m.creado_hora >= $${i++}`); vals.push(desde); }
  if (hasta) { where.push(`m.creado_hora <  $${i++}`); vals.push(hasta); }

  // por usuario (cajero)
  if (id_usuario) { where.push(`m.creado_por = $${i++}`); vals.push(id_usuario); }

  // por hotel (desde la reservación)
  if (id_hotel) { where.push(`r.id_hotel = $${i++}`); vals.push(id_hotel); }

  // solo abonos
  where.push(`m.tipo = 'abono'`);

  const sql = `
    SELECT
      COALESCE(SUM(CASE WHEN m.metodo_pago = 'efectivo' THEN m.cantidad ELSE 0 END), 0) AS total_efectivo,
      COALESCE(SUM(CASE WHEN m.metodo_pago = 'tarjeta'  THEN m.cantidad ELSE 0 END), 0) AS total_tarjeta,
      COUNT(*) AS transacciones
    FROM movimientos m
    JOIN reservaciones r ON r.id_reservacion = m.id_reservacion
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
  `;

  const { rows } = await pool.query(sql, vals);
  const { total_efectivo, total_tarjeta, transacciones } = rows[0];
  const total_general = Number(total_efectivo) + Number(total_tarjeta);

  return {
    total_efectivo: Number(total_efectivo),
    total_tarjeta : Number(total_tarjeta),
    total_general : Number(total_general),
    transacciones : Number(transacciones)
  };
}

/**
 * 1) Abrir corte
 * POST /api/corte-caja/abrir
 * body opcional: { desde }  (si no, NOW())
 */
router.post('/abrir', authRequired, requireRoles('recepcionista','admin_local','admin_cadena'), async (req, res) => {
  try {
    const id_hotel   = requireHotelId(req);
    const id_usuario = req.user.id_usuario;

    // ¿Ya hay un corte abierto para este hotel/usuario?
    const q = await pool.query(
      `SELECT id_corte
         FROM corte_caja
        WHERE id_hotel = $1 AND id_usuario = $2 AND fechahora_fin IS NULL
        LIMIT 1`,
      [id_hotel, id_usuario]
    );

    if (q.rowCount) {
      return res.status(409).json({ error: 'Ya tienes un corte abierto.' });
    }

    const ins = await pool.query(
      `INSERT INTO corte_caja (id_usuario, id_hotel, fechahora_inicio, total_dinero, total_tarjeta, total_general, nota)
       VALUES ($1,$2, NOW(), 0, 0, 0, NULL)
       RETURNING id_corte, fechahora_inicio`,
      [id_usuario, id_hotel]
    );

    return res.status(201).json({
      mensaje: 'Corte abierto',
      corte: ins.rows[0]
    });
  } catch (e) {
    console.error('Error abriendo corte:', e);
    const status = e.code === 'NO_HOTEL' ? 400 : 500;
    return res.status(status).json({
      error: 'Error abriendo corte',
      info: { code: e.code, detail: e.detail, message: e.message }
    });
  }
});

/**
 * 2) Consultar corte abierto del usuario
 * GET /api/corte-caja/abierto
 */
router.get('/abierto', authRequired, async (req, res) => {
  const { id_usuario, id_hotel } = ensureUserHotel(req);
  if (!id_usuario) return res.status(401).json({ error: 'Usuario no autenticado' });

  try {
    const { rows } = await pool.query(
      `SELECT id_corte, id_usuario, id_hotel, fechahora_inicio, fechahora_fin,
              total_dinero, total_tarjeta, total_general, nota, creado_hora
         FROM corte_caja
        WHERE id_usuario = $1 AND id_hotel = COALESCE($2, id_hotel)
          AND fechahora_fin IS NULL
        ORDER BY fechahora_inicio DESC
        LIMIT 1`,
      [id_usuario, id_hotel]
    );
    if (!rows.length) return res.status(204).send(); // sin contenido
    res.json(rows[0]);
  } catch (e) {
    console.error('Error consultando corte abierto:', e);
    res.status(500).json({ error: 'Error consultando corte abierto' });
  }
});


// GET /api/corte-caja/actual
router.get('/actual', authRequired, requireRoles('recepcionista','admin_local','admin_cadena'), async (req, res) => {
  try {
    const id_hotel   = requireHotelId(req);
    const id_usuario = req.user.id_usuario;

    const q = await pool.query(
      `SELECT *
         FROM corte_caja
        WHERE id_hotel = $1 AND id_usuario = $2
        ORDER BY id_corte DESC
        LIMIT 1`,
      [id_hotel, id_usuario]
    );

    if (!q.rowCount) return res.json({ abierto: false });

    const corte = q.rows[0];
    return res.json({ abierto: !corte.fechahora_fin, corte });
  } catch (e) {
    console.error('Error consultando corte:', e);
    return res.status(500).json({ error: 'Error consultando corte' });
  }
});



/**
 * 3) Preview totales del corte (para confirmar)
 * GET /api/corte-caja/preview
 * usa el corte abierto (si existe) o query params: ?desde=..&hasta=..
 */
router.get('/preview', authRequired, async (req, res) => {
  const { id_usuario, id_hotel } = ensureUserHotel(req);
  if (!id_usuario) return res.status(401).json({ error: 'Usuario no autenticado' });

  try {
    // si no llega desde/hasta, usar el corte abierto
    let desde = req.query.desde ? new Date(req.query.desde) : null;
    let hasta = req.query.hasta ? new Date(req.query.hasta) : null;

    if (!desde || !hasta) {
      const { rows } = await pool.query(
        `SELECT id_corte, fechahora_inicio FROM corte_caja
          WHERE id_usuario = $1 AND id_hotel = COALESCE($2, id_hotel)
            AND fechahora_fin IS NULL
          ORDER BY fechahora_inicio DESC
          LIMIT 1`,
        [id_usuario, id_hotel]
      );
      if (!rows.length) {
        return res.status(400).json({ error: 'Sin corte abierto y sin rango de fechas' });
      }
      desde = rows[0].fechahora_inicio;
      // si no mandan "hasta", tomar NOW (lado servidor)
      hasta = new Date();
    }

    const tot = await calcularResumenCorte({ desde, hasta, id_usuario, id_hotel });
    res.json({ desde, hasta, ...tot });
  } catch (e) {
    console.error('Error preview corte:', e);
    res.status(500).json({ error: 'Error calculando preview del corte' });
  }
});

/**
 * 4) Cerrar corte
 * POST /api/corte-caja/cerrar
 * body opcional: { hasta, nota }
 * Toma el corte abierto del usuario, calcula totales y lo cierra.
 */
router.post('/cerrar', authRequired, requireRoles('recepcionista','admin_local','admin_cadena'), async (req, res) => {
  try {
    const id_hotel   = requireHotelId(req);
    const id_usuario = req.user.id_usuario;

    // Recalcular totales del periodo abierto
    const abierto = await pool.query(
      `SELECT id_corte, fechahora_inicio
         FROM corte_caja
        WHERE id_hotel = $1 AND id_usuario = $2 AND fechahora_fin IS NULL
        LIMIT 1`,
      [id_hotel, id_usuario]
    );

    if (!abierto.rowCount) {
      return res.status(409).json({ error: 'No tienes un corte abierto.' });
    }

    const { id_corte, fechahora_inicio } = abierto.rows[0];

    // Suma de movimientos desde que abrió el corte (ejemplo simple)
    const tot = await pool.query(
      `SELECT
          COALESCE(SUM(CASE WHEN tipo='abono' THEN cantidad ELSE 0 END),0) AS total_abonos,
          COALESCE(SUM(CASE WHEN tipo='cargo' THEN cantidad ELSE 0 END),0) AS total_cargos
         FROM movimientos
        WHERE creado_hora >= $1
          AND (SELECT id_hotel FROM reservaciones r WHERE r.id_reservacion = movimientos.id_reservacion) = $2`,
      [fechahora_inicio, id_hotel]
    );

    const totalTarjeta = 0; // si quieres separar por método, haz otro SUM con WHERE metodo_pago='tarjeta'
    const totalDinero  = Number(tot.rows[0].total_abonos) - Number(tot.rows[0].total_cargos);
    const totalGeneral = totalDinero + totalTarjeta;

    const upd = await pool.query(
      `UPDATE corte_caja
          SET fechahora_fin = NOW(),
              total_dinero = $1,
              total_tarjeta = $2,
              total_general = $3
        WHERE id_corte = $4
        RETURNING *`,
      [totalDinero, totalTarjeta, totalGeneral, id_corte]
    );

    return res.json({ mensaje: 'Corte cerrado', corte: upd.rows[0] });
  } catch (e) {
    console.error('Error cerrando corte:', e);
    return res.status(500).json({ error: 'Error cerrando corte', info: { code: e.code, detail: e.detail } });
  }
});

/**
 * 5) Listar cortes (histórico)
 * GET /api/corte-caja?from=..&to=..&usuario=..&hotel=..
 */
router.get('/', authRequired, async (req, res) => {
  const from   = req.query.from ? new Date(req.query.from) : null;
  const to     = req.query.to   ? new Date(req.query.to)   : null;
  const usuario = req.query.usuario ? Number(req.query.usuario) : null;
  const hotel   = req.query.hotel   ? Number(req.query.hotel)   : null;

  const where = [];
  const vals = [];
  let i = 1;

  if (from)  { where.push(`c.fechahora_inicio >= $${i++}`); vals.push(from); }
  if (to)    { where.push(`c.fechahora_inicio <  $${i++}`); vals.push(to); }
  if (usuario) { where.push(`c.id_usuario = $${i++}`); vals.push(usuario); }
  if (hotel)   { where.push(`c.id_hotel = $${i++}`);   vals.push(hotel); }

  const sql = `
    SELECT c.id_corte, c.id_usuario, c.id_hotel, c.fechahora_inicio, c.fechahora_fin,
           c.total_dinero, c.total_tarjeta, c.total_general, c.nota, c.creado_hora,
           u.nombreusuario AS cajero, h.nombre AS hotel
      FROM corte_caja c
      LEFT JOIN usuarios u ON u.id_usuario = c.id_usuario
      LEFT JOIN hoteles  h ON h.id_hotel   = c.id_hotel
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY c.fechahora_inicio DESC, c.id_corte DESC
      LIMIT 500
  `;

  try {
    const { rows } = await pool.query(sql, vals);
    res.json(rows);
  } catch (e) {
    console.error('Error listando cortes:', e);
    res.status(500).json({ error: 'Error listando cortes' });
  }
});

/**
 * 6) Detalle de un corte
 * GET /api/corte-caja/:id
 * (incluye resumen y un top de movimientos del período)
 */
router.get('/:id', authRequired, async (req, res) => {
  const id = req.params.id;
  try {
    const { rows, rowCount } = await pool.query(
      `SELECT id_corte, id_usuario, id_hotel, fechahora_inicio, fechahora_fin,
              total_dinero, total_tarjeta, total_general, nota, creado_hora
         FROM corte_caja
        WHERE id_corte = $1`,
      [id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Corte no encontrado' });

    const corte = rows[0];
    // movimientos del periodo (solo abonos), limitado para no explotar
    const movs = await pool.query(
      `SELECT m.id_movimiento, m.id_reservacion, m.tipo, m.metodo_pago, m.descripcion, m.cantidad, m.creado_hora
         FROM movimientos m
         JOIN reservaciones r ON r.id_reservacion = m.id_reservacion
        WHERE m.tipo='abono'
          AND m.creado_hora >= $1
          AND m.creado_hora <  $2
          AND r.id_hotel = COALESCE($3, r.id_hotel)
        ORDER BY m.creado_hora ASC, m.id_movimiento ASC
        LIMIT 500`,
      [corte.fechahora_inicio, corte.fechahora_fin || new Date(), corte.id_hotel]
    );

    res.json({ corte, movimientos: movs.rows });
  } catch (e) {
    console.error('Error obteniendo corte:', e);
    res.status(500).json({ error: 'Error obteniendo corte' });
  }
});

export default router;
