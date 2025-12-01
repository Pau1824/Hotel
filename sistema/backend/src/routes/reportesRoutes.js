// src/routes/reportesRoutes.js
import express from 'express';
import pool from '../db.js';

const router = express.Router();

/**
 * GET /api/reportes/resumen
 * Resumen general para las cards de Analíticas:
 * - total habitaciones
 * - ocupadas
 * - reservadas (reservas activas/en curso)
 * - disponibles
 * - porcentaje ocupación
 * - tarifa promedio (ADR)
 */
// GET /api/reportes/resumen?range=7d|30d|month
router.get('/resumen', async (req, res) => {
  try {
    const range = req.query.range || '30d';

    // ===== 1. Calcular fecha de inicio según el rango =====
    const today = new Date(); // hoy (fecha del servidor)
    let startDate = new Date(today);

    if (range === '7d') {
      // últimos 7 días (hoy y 6 días atrás)
      startDate.setDate(today.getDate() - 6);
    } else if (range === 'month') {
      // desde el día 1 del mes actual
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    } else {
      // default: últimos 30 días
      startDate.setDate(today.getDate() - 29);
    }

    // días en el rango (incluyendo hoy)
    const oneDayMs = 24 * 60 * 60 * 1000;
    const daysRange =
      Math.floor((today.getTime() - startDate.getTime()) / oneDayMs) + 1;

    // ===== 2. Snapshot de habitaciones (no depende del rango) =====
    const habSql = `
      SELECT 
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE estado = 'ocupada')       AS ocupadas,
        COUNT(*) FILTER (WHERE estado = 'disponible')    AS disponibles,
        COUNT(*) FILTER (WHERE estado = 'mantenimiento') AS mantenimiento
      FROM habitaciones;
    `;
    const { rows: habRows } = await pool.query(habSql);
    const totalHabs = Number(habRows[0].total || 0);
    const ocupadas = Number(habRows[0].ocupadas || 0);
    const disponibles = Number(habRows[0].disponibles || 0);

    // ===== 3. Noches vendidas y revenue en el rango =====
    // Usamos la tabla reservaciones
    const rsvSql = `
      SELECT
        COALESCE(
          SUM(
            (LEAST(check_out, CURRENT_DATE) - GREATEST(check_in, $1::date))::int
          ),
          0
        ) AS room_nights_sold,
        COALESCE(
          SUM(
            (LEAST(check_out, CURRENT_DATE) - GREATEST(check_in, $1::date))::int
            * tarifa_por_noche
          ),
          0
        ) AS room_revenue
      FROM reservaciones
      WHERE estado IN ('activa','en_curso','finalizada')
        AND check_out > $1::date
        AND check_in < (CURRENT_DATE + INTERVAL '1 day');
    `;
    const { rows: rsvRows } = await pool.query(rsvSql, [startDate]);
    const roomNightsSold = Number(rsvRows[0].room_nights_sold || 0);
    const roomRevenue = Number(rsvRows[0].room_revenue || 0);

    // ===== 4. Calcular KPIs del rango =====
    const totalRoomNightsAvailable =
      totalHabs > 0 ? totalHabs * daysRange : 0;

    const ocupacionRange =
      totalRoomNightsAvailable > 0
        ? (roomNightsSold / totalRoomNightsAvailable) * 100
        : 0;

    const adr =
      roomNightsSold > 0 ? roomRevenue / roomNightsSold : 0;

    const revpar =
      totalRoomNightsAvailable > 0
        ? roomRevenue / totalRoomNightsAvailable
        : 0;

    return res.json({
      total: totalHabs,
      ocupadas,
      reservadas: 0,                 // si luego quieres, sacamos las reservadas reales
      disponibles,
      porcentajeOcupacion: Math.round(ocupacionRange),
      tarifaPromedio: adr,
      revpar,
      meta: {
        range,
        roomNightsSold,
        totalRoomNightsAvailable,
        daysRange,
      },
    });
  } catch (error) {
    console.error('GET /reportes/resumen', error);
    return res
      .status(500)
      .json({ error: 'Error al generar resumen de reportes' });
  }
});


/**
 * GET /api/reportes/habitaciones-en-uso
 * Habitaciones que no están disponibles
 */
router.get('/habitaciones-en-uso', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        id_habitacion,
        numero_habitacion,
        piso,
        estado,
        tarifa_base
      FROM habitaciones
      WHERE estado IN ('ocupada','mantenimiento')
      ORDER BY numero_habitacion
    `);

    res.json(rows);
  } catch (error) {
    console.error('Error al obtener habitaciones en uso:', error);
    res
      .status(500)
      .json({ error: 'Error al obtener habitaciones en uso' });
  }
});


// GET /api/reportes/ingresos-mensuales
router.get('/ingresos-mensuales', async (req, res) => {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();     // año actual
    const currentMonth = now.getMonth() + 1;   // 1–12
    const startMonth = Math.max(1, currentMonth - 5); // últimos 6 meses dentro del año

    const sql = `
      SELECT 
        EXTRACT(MONTH FROM r.check_in)::int AS mes,
        SUM(
          CASE 
            WHEN m.tipo = 'cargo' THEN m.cantidad
            ELSE 0
          END
        ) AS total_cargos
      FROM reservaciones r
      JOIN movimientos m 
        ON m.id_reservacion = r.id_reservacion
      WHERE 
        r.estado <> 'cancelada'                      -- ignorar canceladas
        AND EXTRACT(YEAR FROM r.check_in) = $1       -- SOLO año actual
        AND EXTRACT(MONTH FROM r.check_in) BETWEEN $2 AND $3
      GROUP BY mes
      ORDER BY mes;
    `;

    const { rows } = await pool.query(sql, [
      currentYear,
      startMonth,
      currentMonth,
    ]);

    const mesesNombres = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    const data = [];
    for (let mes = startMonth; mes <= currentMonth; mes++) {
      const row = rows.find((r) => Number(r.mes) === mes);
      const ingreso = row ? Number(row.total_cargos ?? 0) : 0;

      data.push({
        mes: mesesNombres[mes - 1],
        ingreso,
      });
    }

    return res.json(data);
  } catch (e) {
    console.error('GET /reportes/ingresos-mensuales', e);
    return res
      .status(500)
      .json({ error: 'Error al obtener ingresos mensuales' });
  }
});





// GET /api/reportes/ingresos-rango?range=7d|30d|month
router.get('/ingresos-rango', async (req, res) => {
  try {
    const range = req.query.range || '30d';

    let dateCondition;

    // El rango ahora va sobre r.check_in (no sobre creado_hora)
    if (range === '7d') {
      dateCondition = `
        r.check_in::date BETWEEN (CURRENT_DATE - INTERVAL '6 days') 
        AND CURRENT_DATE
      `;
    } else if (range === 'month') {
      dateCondition = `
        r.check_in::date >= date_trunc('month', CURRENT_DATE)::date
      `;
    } else {
      // default: últimos 30 días
      dateCondition = `
        r.check_in::date >= (CURRENT_DATE - INTERVAL '29 days')
      `;
    }

    const sql = `
      SELECT
        COALESCE(
          SUM(
            CASE 
              WHEN mov.tipo = 'cargo' THEN mov.cantidad
              ELSE 0
            END
          ), 0
        ) AS total_cargos
      FROM reservaciones r
      JOIN movimientos mov
        ON mov.id_reservacion = r.id_reservacion
      WHERE
        r.check_in IS NOT NULL
        AND r.estado <> 'cancelada'
        AND ${dateCondition};
    `;

    const { rows } = await pool.query(sql);
    const totalCargos = Number(rows[0].total_cargos || 0);

    return res.json({
      range,
      totalIngresos: totalCargos,
    });
  } catch (e) {
    console.error('GET /reportes/ingresos-rango', e);
    return res
      .status(500)
      .json({ error: 'Error al obtener ingresos por rango' });
  }
});



// GET /api/reportes/ocupacion-semanal
router.get('/ocupacion-semanal', async (req, res) => {
  try {
    // 1) Parámetros de mes actual
    const { rows: paramRows } = await pool.query(`
      SELECT
        date_trunc('month', CURRENT_DATE)::date AS inicio_mes,
        (date_trunc('month', CURRENT_DATE) + interval '1 month - 1 day')::date AS fin_mes,
        (SELECT COUNT(*)::int FROM habitaciones)                      AS total_habitaciones
    `);

    const { inicio_mes, fin_mes, total_habitaciones } = paramRows[0];

    // 2) Ocupación por semana del mes
    const { rows } = await pool.query(
      `
      WITH reservas_mes AS (
        SELECT
          r.id_reservacion,
          r.id_habitacion,
          r.check_in,
          r.estado
        FROM reservaciones r
        WHERE
          r.check_in BETWEEN $1 AND $2
          AND r.estado IN ('activa', 'en_curso', 'finalizada')
      ),
      semanas AS (
        SELECT
          1 + floor((EXTRACT(DAY FROM check_in) - 1) / 7)::int AS semana,
          COUNT(DISTINCT id_habitacion)::int                  AS habs_ocupadas
        FROM reservas_mes
        GROUP BY semana
      )
      SELECT
        semana,
        habs_ocupadas,
        $3::int AS total_habs,
        ROUND(
          CASE 
            WHEN $3::int > 0 
              THEN (habs_ocupadas::numeric / $3::numeric) * 100
            ELSE 0
          END
        , 1) AS ocupacion
      FROM semanas
      ORDER BY semana;
      `,
      [inicio_mes, fin_mes, total_habitaciones]
    );

    // Si no hay semanas, devolvemos 4 puntos en 0 para que el gráfico no muera
    if (!rows.length) {
      const fake = [1, 2, 3, 4].map((s) => ({
        semana: s,
        habs_ocupadas: 0,
        total_habs: total_habitaciones,
        ocupacion: 0,
      }));
      return res.json(fake);
    }

    return res.json(rows);
  } catch (e) {
    console.error('GET /reportes/ocupacion-semanal', e);
    return res
      .status(500)
      .json({ error: 'Error al obtener ocupación semanal' });
  }
});



// GET /api/reportes/mix-habitaciones
router.get('/mix-habitaciones', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE estado = 'ocupada')::int       AS ocupadas,
        COUNT(*) FILTER (WHERE estado = 'disponible')::int    AS libres,
        COUNT(*) FILTER (WHERE estado = 'mantenimiento')::int AS mantenimiento
      FROM habitaciones
      `
    );

    const row = rows[0];

    if (!row || row.total === 0) {
      return res.json({
        ocupadas: 0,
        libres: 0,
        mantenimiento: 0,
        total: 0,
        porcentaje: {
          ocupadas: 0,
          libres: 0,
          mantenimiento: 0
        }
      });
    }

    const total = Number(row.total);
    const ocupadas = Number(row.ocupadas);
    const libres = Number(row.libres);
    const mantenimiento = Number(row.mantenimiento);

    const porcentaje = {
      ocupadas: Math.round((ocupadas * 100) / total),
      libres: Math.round((libres * 100) / total),
      mantenimiento: Math.round((mantenimiento * 100) / total)
    };

    return res.json({
      ocupadas,
      libres,
      mantenimiento,
      total,
      porcentaje
    });
  } catch (e) {
    console.error('GET /reportes/mix-habitaciones', e);
    return res
      .status(500)
      .json({ error: 'Error al obtener mix de habitaciones' });
  }
});


// GET /api/reportes/movimientos
// Query params:
//   - desde: 'YYYY-MM-DD' (opcional)
//   - hasta: 'YYYY-MM-DD' (opcional)
//   - agruparPor: 'codigo' | 'cajero' (opcional, default 'codigo')
//   - cajero: nombre del cajero (opcional)
// GET /api/reportes/movimientos
router.get('/movimientos', async (req, res) => {
  try {
    const { fechaDesde, fechaHasta, agruparPor, cajero } = req.query;

    const where = [];
    const params = [];
    //let i = 1;

    // Filtro por rango de fechas (sobre la fecha del movimiento)
    if (fechaDesde) {
      params.push(fechaDesde); // "2025-11-20"
      where.push(`mov.creado_hora::date >= $${params.length}`);
    }

    if (fechaHasta) {
      params.push(fechaHasta); // "2025-11-30"
      where.push(`mov.creado_hora::date <= $${params.length}`);
    }

    // Filtro por cajero (nombre completo) si NO es "todos"
    if (cajero && cajero !== 'todos') {
      params.push(cajero);
      where.push(`(u.primer_nombre || ' ' || u.apellido) = $${params.length}`);
    }

    // Armamos el WHERE final
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

    // Orden según "agrupar por"
    let orderBy = 'ORDER BY mov.creado_hora DESC';

    if (agruparPor === 'codigo') {
      orderBy = 'ORDER BY c.codigo, mov.creado_hora DESC';
    } else if (agruparPor === 'cajero') {
      orderBy = 'ORDER BY cajero, mov.creado_hora DESC';
    }

    const sql = `
      SELECT
        mov.id_movimiento,
        mov.creado_hora,
        COALESCE(h.numero_habitacion::text, '') AS habitacion,
        COALESCE(
          r.nombre_huesped || ' ' || r.apellido1_huesped,
          ''
        ) AS huesped,
        COALESCE(c.codigo, 'SIN-COD') AS codigo,
        COALESCE(c.descripcion, mov.descripcion) AS descripcion,
        'MOV-' || mov.id_movimiento AS comprobante,
        mov.moneda,
        CASE 
          WHEN mov.tipo = 'cargo' THEN mov.cantidad 
          ELSE 0 
        END AS cargo,
        CASE 
          WHEN mov.tipo = 'abono' THEN mov.cantidad 
          ELSE 0 
        END AS pago,
        COALESCE(u.primer_nombre || ' ' || u.apellido, '—') AS cajero
      FROM movimientos mov
      LEFT JOIN reservaciones r ON r.id_reservacion = mov.id_reservacion
      LEFT JOIN habitaciones h ON h.id_habitacion = r.id_habitacion
      LEFT JOIN usuarios u ON u.id_usuario = mov.creado_por
      LEFT JOIN concepto_codigo c ON c.id_concepto = mov.id_concepto
      ${whereSql}
      ${orderBy};
    `;

    const { rows } = await pool.query(sql, params);

    // Adaptamos al shape que espera el frontend
    const movimientos = rows.map((r) => ({
      fechaHora: r.creado_hora, // luego lo formateas en el front
      habitacion: r.habitacion,
      huesped: r.huesped,
      codigo: r.codigo,
      descripcion: r.descripcion,
      comprobante: r.comprobante,
      moneda: r.moneda,
      cargo: Number(r.cargo),
      pago: Number(r.pago),
      cajero: r.cajero,
      // "grupo" lo usas para el título de cada bloque en la tabla
      grupo:
        agruparPor === 'cajero'
          ? r.cajero
          : `Trans. Code ${r.codigo} - ${r.descripcion}`,
    }));

    return res.json(movimientos);
  } catch (e) {
    console.error('GET /reportes/movimientos', e);
    return res
      .status(500)
      .json({ error: 'Error al obtener movimientos' });
  }
});



export default router;
