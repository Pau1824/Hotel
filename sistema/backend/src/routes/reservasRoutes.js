import express from 'express';
import pool from '../db.js';
import { authRequired } from '../middleware/auth.js';

const router = express.Router();

console.log("🟢 CARGANDO ARCHIVO reservasRoutes.js CORRECTO");


// GET /api/reservas/folio - Generar folio automático por hotel
router.get('/folio/siguiente', authRequired, async (req, res) => {
  try {
    const { id_hotel } = req.user;

    if (!id_hotel) {
      return res.status(400).json({ error: "ID de hotel no encontrado en token" });
    }

    // 1. Obtener código del hotel (prefijo del folio)
    const sqlHotel = `SELECT codigo FROM hoteles WHERE id_hotel = $1 LIMIT 1`;
    const hotelResp = await pool.query(sqlHotel, [id_hotel]);

    if (hotelResp.rows.length === 0) {
      return res.status(404).json({ error: "Hotel no encontrado" });
    }

    const prefijo = hotelResp.rows[0].codigo; // ej: "COAS"

    // 2. Buscar último folio de ese hotel que empiece con ese prefijo
    const sqlFolio = `
      SELECT folio
      FROM reservaciones
      WHERE id_hotel = $1
        AND folio LIKE $2 || '%'
      ORDER BY id_reservacion DESC
      LIMIT 1
    `;

    const folioResp = await pool.query(sqlFolio, [id_hotel, prefijo]);
    const ultimoFolio = folioResp.rows[0]?.folio || null;

    // 3. Calcular siguiente número
    let numero = 1;

    if (ultimoFolio) {
      const numerico = parseInt(ultimoFolio.replace(prefijo, ""));
      if (!isNaN(numerico)) {
        numero = numerico + 1;
      }
    }

    const folioNuevo = prefijo + numero.toString().padStart(4, '0');

    return res.json({ folio: folioNuevo });

  } catch (error) {
    console.error("❌ Error generando folio:", error);
    res.status(500).json({ error: "Error generando folio" });
  }
});




/*
// POST /api/reservas - Crear nueva reserva
router.post('/', authRequired, async (req, res) => {
  const r = req.body;

  // Validación rápida del payload
  if (!r.id_habitacion || !r.llegada || !r.salida || !r.folio || !r.nombre || !r.apellido) {
    return res.status(400).json({ error: 'Faltan datos requeridos (id_habitacion, llegada, salida, folio, nombre, apellido).' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Consultar tarifa de la habitación
    const {rows: habRows} = await pool.query(
      `
      SELECT 
        h.id_habitacion,
        h.tarifa_base,
        t.camas_extra_max,
        t.precio_cama_extra
      FROM habitaciones h
      JOIN tipos_habitaciones t ON t.id_tipo = h.id_tipo
      WHERE h.id_habitacion = $1
      `,
      [r.id_habitacion]
    );
    

    if (!habRows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Habitación no encontrada' });
    }

    const hab = habRows[0];

    const id_habitacion = hab[0].id_habitacion;
    const tarifa = Number(hab[0].tarifa_base);

    const camas_extra_max = Number(hab.camas_extra_max || 0);
    const precio_cama_extra = Number(hab.precio_cama_extra || 0);

    // Antes del SELECT de conflicto
    console.log('[RESERVA] id_habitacion:', id_habitacion,
            'llegada:', r.llegada, 'salida:', r.salida);

    const { rows: conflictos } = await pool.query(
      `SELECT id_reservacion, check_in, check_out, estado, folio
        FROM reservaciones
        WHERE id_habitacion = $1
          AND NOT (check_out <= $2::date OR check_in >= $3::date)
          AND estado IN ('activa','en_curso')
        LIMIT 1`,
      [id_habitacion, r.llegada, r.salida]
    );

    console.log('[RESERVA] conflictos hallados:', conflictos);

    if (conflictos.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'La habitación ya está reservada en ese rango de fechas.' });
    }

    const inDate  = new Date(r.llegada); inDate.setHours(0,0,0,0);
    const outDate = new Date(r.salida ); outDate.setHours(0,0,0,0);
    const noches  = Math.max(1, Math.ceil((outDate - inDate) / (1000*60*60*24)));

    //const cargo_extra = Number(r.cargo_extra || 0);
    //const total = tarifa * noches + cargo_extra;

    // 4. CAMAS EXTRA
    const camas_extra = Number(r.camas_extra || 0);

    if (camas_extra < 0 || camas_extra > camas_extra_max) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Número de camas extra inválido. Máximo permitido: ${camas_extra_max}`
      });
    }

    const total_camas_extra = camas_extra * precio_cama_extra * noches;

    // 🔥 TOTAL FINAL
    const total = tarifa * noches + total_camas_extra;


    // 3. Insertar reserva
    const apellido2 = r.apellido2 ?? '';
    const { rows: ins } = await pool.query(
      `INSERT INTO reservaciones (
        id_habitacion, check_in, check_out, adultos, ninos,
        tarifa_por_noche, total_pagar, estado,
        nombre_huesped, apellido1_huesped, apellido2_hespued,
        folio, metodo_pago,
        camas_extra, total_camas_extra
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,'activa',$8,$9,$10,$11,$12,$13,$14)
      RETURNING id_reservacion`,
      [
        id_habitacion,
        r.llegada,
        r.salida,
        r.personas || 1,
        r.ninos || 0,
        tarifa,
        total,
        r.nombre,
        r.apellido,
        apellido2,
        r.folio,
        r.metodo_pago,
        r.camas_extra,
        r.total_camas_extra
      ]
    );

    if (!ins?.length) throw new Error('INSERT reservaciones no devolvió id_reservacion');
    const id_reservacion = ins[0].id_reservacion;

    // 4. Insertar movimiento inicial (cargo)
    await client.query(`
      INSERT INTO movimientos (id_reservacion, tipo, descripcion, cantidad, moneda)
      VALUES ($1, 'cargo', 'Renta', $2, 'MXN')
    `, [id_reservacion, total]);

    // 5. Recalcular saldo
    const { rows: tot} = await client.query(
      `SELECT 
         COALESCE(SUM(CASE WHEN tipo='cargo' THEN cantidad ELSE 0 END),0) AS debitos,
         COALESCE(SUM(CASE WHEN tipo='abono' THEN cantidad ELSE 0 END),0) AS creditos
       FROM movimientos WHERE id_reservacion=$1`,
      [id_reservacion]
    );

    const debitos  = Number(tot?.[0]?.debitos  ?? 0);
    const creditos = Number(tot?.[0]?.creditos ?? 0);
    const saldo    = creditos - debitos;

    await client.query('COMMIT');

    // 6. Actualizar saldo en reservas
    /*await pool.query(
      `UPDATE reservas SET saldo = ? WHERE id_reserva = ?`,
      [nuevoSaldo, id_reserva]
    );*//*

    return res.status(201).json({
      mensaje: 'Reserva registrada correctamente',
      id_reservacion,
      noches,
      tarifa,
      total,
      camas_extra,
      total_camas_extra,
      totales: { debitos, creditos, saldo }
    });

    } catch (e) {
    // Log súper explícito
    await client.query('ROLLBACK');
    console.error('Error al registrar reserva >>>');
    console.error('name:', e.name);
    console.error('message:', e.message);
    console.error('code:', e.code);
    console.error('constraint:', e.constraint);
    console.error('detail:', e.detail);
    console.error('where:', e.where);
    console.error('stack:', e.stack);

    // (Opcional en desarrollo) devolver detalle:
    if (process.env.NODE_ENV !== 'production') {
      return res.status(500).json({
        error: 'Error al registrar la reserva',
        pg: process.env.NODE_ENV !== 'production'
          ? { name: e.name, message: e.message, code: e.code, constraint: e.constraint, detail: e.detail }
          : undefined
      });
    } 
  }
});*/




// POST /api/reservas - Crear nueva reserva
router.get('/siguiente-folio', authRequired, async (req, res) => {
  try {
    const idHotel = req.scopeHotelId;

    const { rows: hotel } = await pool.query(
      `SELECT codigo FROM hoteles WHERE id_hotel = $1 LIMIT 1`,
      [idHotel]
    );

    const prefijo = hotel?.[0]?.codigo || "HTL";

    const { rows: ult } = await pool.query(`
      SELECT folio
      FROM reservaciones
      WHERE folio LIKE '${prefijo}%'
      ORDER BY id_reservacion DESC
      LIMIT 1;
    `);

    let nuevo = `${prefijo}0001`;

    if (ult.length > 0) {
      const anterior = ult[0].folio;
      const num = parseInt(anterior.replace(prefijo, "")) + 1;
      nuevo = prefijo + num.toString().padStart(4, "0");
    }

    res.json({ folio: nuevo });

  } catch (err) {
    console.error("Error generando folio:", err);
    res.status(500).json({ error: "Error generando folio" });
  }
});


// GET /api/habitaciones/disponibles - Obtener habitaciones disponibles para un rango de fechas
router.get('/habitaciones/disponibles', authRequired, async (req, res) => {
  const { llegada, salida } = req.query;

  console.log('🔍 Consultando disponibilidad:', { llegada, salida });

  if (!llegada || !salida) {
    return res.status(400).json({ error: 'Se requieren fechas de llegada y salida' });
  }

  try {
    // Obtener todas las habitaciones que NO tienen conflictos en ese rango
    const { rows } = await pool.query(`
      SELECT DISTINCT h.*
      FROM habitaciones h
      WHERE h.estado NOT IN ('mantenimiento', 'bloqueada', 'fuera_servicio', 'inactiva')
        AND h.id_habitacion NOT IN (
          -- Habitaciones que YA tienen reservas activas en ese rango
          SELECT r.id_habitacion
          FROM reservaciones r
          WHERE r.estado IN ('activa', 'en_curso')
            AND NOT (r.check_out <= $1 OR r.check_in >= $2)
        )
      ORDER BY h.numero_habitacion
    `, [llegada, salida]);

    console.log(`✅ Encontradas ${rows.length} habitaciones disponibles`);

    return res.json(rows);
  } catch (error) {
    console.error('❌ Error consultando disponibilidad:', error);
    return res.status(500).json({ error: 'Error al consultar disponibilidad' });
  }
});


/* ============================================================
   🔥 POST /api/reservas  - Crear reserva con TODAS las validaciones
   ============================================================ */
router.post('/', authRequired, async (req, res) => {
  const r = req.body;
  console.log('🟦 BODY RECIBIDO:', r);

  // =============================
  // 1. Validaciones de payload
  // =============================
  if (!r.id_habitacion || !r.llegada || !r.salida || !r.folio || !r.nombre || !r.apellido) {
    return res.status(400).json({ error: 'Faltan datos requeridos.' });
  }

  // =============================
  // 2. Validaciones de fechas
  // =============================
  const hoy = new Date(); hoy.setHours(0,0,0,0);

  const [yIn, mIn, dIn] = r.llegada.split('-').map(Number);
  const [yOut, mOut, dOut] = r.salida.split('-').map(Number);

  const inDate = new Date(yIn, mIn - 1, dIn);
  const outDate = new Date(yOut, mOut - 1, dOut);

  inDate.setHours(0, 0, 0, 0);
  outDate.setHours(0, 0, 0, 0);

  console.log('🔍 Backend - Validación de fechas:', {
    llegada: r.llegada,
    salida: r.salida,
    hoy: hoy.toISOString().split('T')[0],
    inDate: inDate.toISOString().split('T')[0],
    inTime: inDate.getTime(),
    hoyTime: hoy.getTime(),
    esAntes: inDate.getTime() < hoy.getTime()
  });

  if (inDate.getTime() < hoy.getTime()) {
    return res.status(400).json({ error: "La fecha de llegada no puede ser antes de hoy." });
  }

  if (outDate.getTime() <= inDate.getTime()) {
    return res.status(400).json({ error: "El check-out debe ser posterior al check-in." });
  }

  const noches = Math.ceil((outDate.getTime() - inDate.getTime()) / (1000 * 60 * 60 * 24));
  if (noches < 1) {
    return res.status(400).json({ error: "La estancia mínima es de 1 noche." });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    /* =========================================
       3. Traer habitación + tipo + restricciones
       ========================================= */
    const { rows: habRows } = await client.query(`
      SELECT 
        h.id_habitacion, h.estado, h.tarifa_base,
        t.adultos_max, t.ninos_max,
        t.adultos_extra_max, t.ninos_extra_max,
        t.camas_extra_max, t.precio_cama_extra
      FROM habitaciones h
      JOIN tipos_habitaciones t ON t.id_tipo = h.id_tipo
      WHERE h.id_habitacion = $1
      LIMIT 1
    `, [r.id_habitacion]);

    if (!habRows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Habitación no encontrada.' });
    }

    const hab = habRows[0];

    // Estado físico de la habitación
    if (["mantenimiento","bloqueada","fuera_servicio","inactiva"].includes(hab.estado)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: "La habitación no está disponible." });
    }

    /* =========================================
       4. Validación de Capacidad
       ========================================= */
    const maxAdultos = hab.adultos_max + hab.adultos_extra_max;
    const maxNinos   = hab.ninos_max   + hab.ninos_extra_max;

    if ((r.personas || 1) > maxAdultos) {
      return res.status(400).json({ error: `Excede el máximo de adultos (${maxAdultos}).` });
    }

    if ((r.ninos || 0) > maxNinos) {
      return res.status(400).json({ error: `Excede el máximo de niños (${maxNinos}).` });
    }

    /* =========================================
       5. Validar que no esté ocupada en el rango
       ========================================= */
    const { rows: conflictos } = await client.query(`
      SELECT id_reservacion, folio
      FROM reservaciones
      WHERE id_habitacion = $1
        AND NOT (check_out <= $2 OR check_in >= $3)
        AND estado IN ('activa', 'en_curso')
      LIMIT 1
    `, [hab.id_habitacion, r.llegada, r.salida]);

    if (conflictos.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'La habitación ya está reservada en ese rango de fechas.'
      });
    }

    /* =========================================
       6. Validación de camas extra
       ========================================= */
    if ((r.camas_extra || 0) > hab.camas_extra_max) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Máximo ${hab.camas_extra_max} camas extra.`
      });
    }

    //const totalCamas = (r.camas_extra || 0) * hab.precio_cama_extra * noches;

    /* =========================================
       7. Calcular total
       ========================================= */
    const tarifa = Number(r.tarifa_por_noche);
    const totalCamas = Number(r.total_camas_extra || 0);
    const total = Number(r.total_pagar || 0);

    console.log("🟩 Usando total del FRONT:", total);

    /* =========================================
       8. Insertar reserva
       ========================================= */
    const apellido2 = r.apellido2 ?? "";
    const { id_hotel } = req.user;

    const insert = await client.query(`
      INSERT INTO reservaciones (
        id_habitacion, check_in, check_out,
        adultos, ninos,
        tarifa_por_noche, total_pagar, estado,
        nombre_huesped, apellido1_huesped, apellido2_hespued,
        folio, metodo_pago,
        camas_extra, total_camas_extra,
        id_hotel
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,'activa',$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING id_reservacion
    `, [
      hab.id_habitacion,
      r.llegada,
      r.salida,
      r.personas || 1,
      r.ninos    || 0,
      tarifa,
      total,
      r.nombre,
      r.apellido,
      apellido2,
      r.folio,
      r.metodo_pago || "efectivo",
      r.camas_extra || 0,
      totalCamas,
      id_hotel
    ]);

    const id_reservacion = insert.rows[0].id_reservacion;

    // Movimiento inicial
    await client.query(`
      INSERT INTO movimientos (id_reservacion, tipo, descripcion, cantidad, moneda)
      VALUES ($1,'cargo','Renta',$2,'MXN')
    `, [id_reservacion, total]);

    await client.query('COMMIT');

    res.status(201).json({
      mensaje: "Reserva registrada correctamente",
      id_reservacion,
      noches,
      total
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al registrar reserva:', err);
    res.status(500).json({ error: "Error al registrar la reserva." });
  } finally {
    client.release();
  }
});



// GET /api/reservas - lista
router.get('/', authRequired, async (req, res) => {
  try {
    const scopeHotel = req.scopeHotelId;
    const sql = `
      SELECT r.id_reservacion, r.folio,
             r.nombre_huesped AS nombre, r.apellido1_huesped AS apellido1, r.apellido2_hespued AS apellido2,
             h.numero_habitacion AS habitacion,
             r.check_in AS llegada, r.check_out AS salida,
             r.adultos AS personas, r.tarifa_por_noche AS tarifa,
             r.total_pagar AS total, r.estado
      FROM reservaciones r
      JOIN habitaciones h ON h.id_habitacion = r.id_habitacion
      ${scopeHotel ? 'WHERE h.id_hotel = $1' : ''}
      ORDER BY r.check_in DESC, r.id_reservacion DESC`;
    const params = scopeHotel ? [scopeHotel] : [];
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener reservas:', error);
    res.status(500).json({ error: 'Error al obtener reservas' });
  }
});



//GET /habitaciones/numero/:numero (buscar id por número)
router.get('/habitaciones/numero/:numero', authRequired, async (req, res) => {
  const { numero } = req.params;
  try {
    const {rows} = await pool.query('SELECT id_habitacion FROM habitaciones WHERE numero_habitacion = $1 LIMIT 1', [numero]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Habitación no encontrada' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Error buscando habitación:', error);
    res.status(500).json({ error: 'Error buscando habitación' });
  }
});



// GET /api/reservas/:id/movimientos
router.get('/:id/movimientos', authRequired, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id_movimiento, tipo, id_concepto, descripcion, cantidad, moneda,
              metodo_pago, nota, creado_hora
         FROM movimientos
        WHERE id_reservacion = $1
        ORDER BY creado_hora ASC, id_movimiento ASC`,
      [id]
    );

    return res.json(rows);
  } catch (e) {
    console.error('GET /reservas/:id/movimientos error:', {
      code: e.code, detail: e.detail, message: e.message
    });
    return res.status(500).json({ error: 'Error al obtener movimientos' });
  }
});


// POST /api/reservas/:id/movimientos
router.post('/:id/movimientos', authRequired, async (req, res) => {
  const id = Number(req.params.id);
  const { tipo, descripcion, cantidad, nota, id_concepto } = req.body;

  if (!tipo || !cantidad) {
    return res.status(400).json({ error: "Faltan datos obligatorios" });
  }

  console.log("DEBUG INSERT MOV:", {
    id,
    tipo,
    descripcion,
    cantidad,
    id_concepto,
    nota
  });

  try {
    // ✅ PRIMERO: Verificar el estado de la reserva
    const { rows: reservaRows } = await pool.query(
      `SELECT estado FROM reservaciones WHERE id_reservacion = $1`,
      [id]
    );

    if (!reservaRows.length) {
      return res.status(404).json({ error: "Reserva no encontrada" });
    }

    const estado = reservaRows[0].estado; // ✅ AHORA SÍ EXISTE

    // 2) Bloquear si está cancelada o finalizada
    if (estado === 'cancelada' || estado === 'finalizada') {
      return res.status(400).json({
        error: `No se pueden registrar movimientos en una reserva ${estado}.`
      });
    }

    // 3) Insertar el movimiento
    const sql = `
      INSERT INTO movimientos
        (id_reservacion, id_concepto, tipo, descripcion, cantidad, moneda, metodo_pago, creado_por, nota)
      VALUES
        ($1, $2, $3, $4, $5, 'MXN', NULL, $6, $7)
      RETURNING *;
    `;

    const params = [
      id,
      id_concepto ?? null,
      tipo,
      descripcion,
      cantidad,
      req.user?.id_usuario || null,
      nota
    ];

    const { rows } = await pool.query(sql, params);

    console.log("✅ Movimiento registrado exitosamente:", rows[0]);

    return res.json({ mensaje: "Movimiento registrado", movimiento: rows[0] });
  } catch (e) {
    console.error("❌ ERROR REAL en POST /reservas/:id/movimientos");
    console.error("Mensaje:", e.message);
    console.error("Detalle:", e.detail);
    console.error("Código:", e.code);
    console.error("Stack:", e.stack);
    res.status(500).json({ error: "Error al registrar movimiento", detalle: e.message });
  }
});




router.put('/:id/checkin', authRequired, async (req, res) => {
  const id = req.params.id;

  try {
    const reserva = await pool.query(`
      SELECT id_habitacion, estado
      FROM reservaciones
      WHERE id_reservacion = $1
    `, [id]);

    if (!reserva.rows.length) {
      return res.status(404).json({ error: "Reserva no encontrada" });
    }

    const { id_habitacion, estado } = reserva.rows[0];

    if (estado === 'finalizada' || estado === 'cancelada') {
      return res.status(400).json({ error: "No se puede hacer check-in en esta reserva" });
    }

    await pool.query(`UPDATE reservaciones SET estado = 'en_curso' WHERE id_reservacion = $1`, [id]);
    await pool.query(`UPDATE habitaciones SET estado = 'ocupada' WHERE id_habitacion = $1`, [id_habitacion]);

    res.json({ message: "Check-in exitoso" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en check-in" });
  }
});




// PUT /api/reservas/:id/checkout
/*router.put('/:id/checkout', authRequired, async (req, res) => {
  const { id } = req.params;

  try {
    const {reservas} = await pool.query('SELECT * FROM reservaciones WHERE id_reservacion = $1', [req.params.id]);

    if (reservas.length === 0) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    const reserva = reservas[0];

    // 1. Validar que esté en curso
    if (reserva.estado !== 'En curso') {
      return res.status(400).json({ error: 'Solo se puede hacer check-out a reservas en curso' });
    }

    // 2. Validar que el saldo sea exactamente 0
    if (parseFloat(reserva.saldo) !== 0) {
      return res.status(400).json({ error: 'No se puede hacer check-out: el saldo no es 0.00' });
    }

    // 3. Validar que la fecha actual esté dentro del rango (>= llegada)
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const outDate = new Date(reserva.check_out);
    outDate.setHours(0, 0, 0, 0);

    if (hoy < llegada) {
      return res.status(400).json({ error: 'No se puede hacer check-out antes de la fecha de llegada' });
    }

    // Cambiar estado de la reserva
    await pool.query('UPDATE reservacion SET estado = \"Finalizada\" WHERE id_reservacion = ?', [id]);

    // Cambiar estado de la habitación
    await pool.query('UPDATE habitaciones SET estado = \"Disponible\" WHERE id_habitacion = ?', [reserva.id_habitacion]);

    res.json({ mensaje: 'Check-out realizado con éxito' });
  } catch (error) {
    console.error('Error al hacer check-out:', error);
    res.status(500).json({ error: 'Error al realizar el check-out' });
  }
});*/



// POST /api/reservas/:id/checkin
router.post('/:id/checkin', authRequired, async (req, res) => {
  const id = Number(req.params.id);
  let client;

  try {
    client = await pool.connect();    // <<--- OBTÉN UN CLIENTE
    await client.query('BEGIN');

    // 1) Carga la reserva
    const { rows: rsv } = await client.query(
      `SELECT r.id_reservacion, r.id_habitacion, r.estado, r.check_in::date AS check_in
         FROM reservaciones r
        WHERE r.id_reservacion = $1
        FOR UPDATE`,                   // bloquéala durante el check-in
      [id]
    );
    if (!rsv.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    const reserva = rsv[0];

    // 2) Validaciones básicas (ajusta a tu lógica de negocio)
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const checkIn = new Date(reserva.check_in); checkIn.setHours(0,0,0,0);

    if (reserva.estado !== 'activa') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `No se puede hacer check-in si el estado es '${reserva.estado}'` });
    }
    // si quieres exigir misma fecha:
    // if (checkIn.getTime() !== hoy.getTime()) { ... }

    // 3) Marcar habitación ocupada y reserva en_curso
    await client.query(
      `UPDATE habitaciones
          SET estado = 'ocupada'
        WHERE id_habitacion = $1`,
      [reserva.id_habitacion]
    );

    await client.query(
      `UPDATE reservaciones
          SET estado = 'en_curso'
        WHERE id_reservacion = $1`,
      [id]
    );

    // 4) (Opcional) registra un movimiento informativo del check-in
    await client.query(
      `INSERT INTO movimientos
         (id_reservacion, tipo, descripcion, cantidad, moneda, creado_por)
       VALUES ($1,'cargo','Apertura de cuenta (check-in)',0,'MXN',$2)`,
      [id, req.user?.id_usuario || null]
    );

    await client.query('COMMIT');
    res.json({ mensaje: 'Check-in realizado', id_reservacion: id });

  } catch (e) {
    if (client) { try { await client.query('ROLLBACK'); } catch (_) {} }
    console.error('POST /reservas/:id/checkin', e.code, e.message, e.detail);
    res.status(500).json({ error: 'Error al procesar check-in' });
  } finally {
    if (client) client.release();     // <<--- SUÉLTALO SIEMPRE
  }
});


/*
router.put('/:id/checkout', authRequired, async (req, res) => {
  const id = req.params.id;

  try {
    const reserva = await pool.query(`
      SELECT id_habitacion
      FROM reservaciones
      WHERE id_reservacion = $1
    `, [id]);

    if (!reserva.rows.length) {
      return res.status(404).json({ error: "Reserva no encontrada" });
    }

    const { id_habitacion } = reserva.rows[0];

    await pool.query(`UPDATE reservaciones SET estado = 'finalizada' WHERE id_reservacion = $1`, [id]);
    await pool.query(`UPDATE habitaciones SET estado = 'disponible' WHERE id_habitacion = $1`, [id_habitacion]);

    res.json({ message: "Check-out exitoso" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en check-out" });
  }
});*/




// POST /api/reservas/:id/checkout  -> cierra una reserva si no hay saldo pendiente
router.post('/:id/checkout', authRequired, async (req, res) => {
  const id = Number(req.params.id);

  try {
    // 1) Verificar que exista la reserva
    const { rows: rsv } = await pool.query(
      `SELECT id_reservacion, id_habitacion, estado
         FROM reservaciones
        WHERE id_reservacion = $1
        LIMIT 1`,
      [id]
    );

    if (!rsv.length) {
      return res.status(404).json({ error: 'Reserva no existe' });
    }

    const reserva = rsv[0];                    // 👈 AQUÍ usamos rsv, no rows
    const { estado, id_habitacion } = reserva; // 👈 recuperamos estado y hab

    console.log('🔹 Checkout reserva:', reserva);

    // (Opcional) validar estado actual antes de cerrar
    if (estado === 'cancelada' || estado === 'finalizada') {
      return res.status(400).json({
        error: `No se puede hacer checkout de una reserva ${estado}`
      });
    }

    // 2) Totales en movimientos (tu tabla real)
    const { rows: tot } = await pool.query(
      `SELECT
          COALESCE(SUM(CASE WHEN tipo='cargo' THEN cantidad ELSE 0 END),0) AS debitos,
          COALESCE(SUM(CASE WHEN tipo='abono' THEN cantidad ELSE 0 END),0) AS creditos
         FROM movimientos
        WHERE id_reservacion = $1`,
      [id]
    );

    const debitos  = Number(tot[0].debitos);
    const creditos = Number(tot[0].creditos);
    const saldo    = creditos - debitos;   // saldo <= 0 para permitir checkout

    if (saldo < 0) {
      return res.status(409).json({
        error: 'Saldo pendiente',
        detalle: { debitos, creditos, saldo }
      });
    }

    // 3) Cambiar estado de la reserva a 'finalizada'
    await pool.query(
      `UPDATE reservaciones
          SET estado = 'finalizada'
        WHERE id_reservacion = $1`,
      [id]
    );

    // 4) Liberar habitación: ponerla en 'disponible'
    const { rows: roomRows } = await pool.query(
      `UPDATE habitaciones
          SET estado = 'disponible'
        WHERE id_habitacion = $1
        RETURNING id_habitacion, estado`,
      [id_habitacion]
    );

    console.log('🏨 Habitacion liberada:', roomRows[0]);

    // 5) (Opcional) registrar un movimiento “Check-out” informativo
    await pool.query(
      `INSERT INTO movimientos
         (id_reservacion, id_concepto, tipo, descripcion, cantidad, moneda, metodo_pago, creado_por)
       VALUES ($1, 5, 'cargo', 'Cierre de cuenta (checkout)', 0, 'MXN', NULL, $2)`,
      [id, req.user?.id_usuario || null]
    );

    return res.json({
      mensaje: 'Checkout realizado',
      totales: { debitos, creditos, saldo },
      reserva: { id_reservacion: id, estado: 'finalizada' },
      habitacion: roomRows[0] ?? null
    });
  } catch (e) {
    console.error('POST /reservas/:id/checkout', e);
    return res.status(500).json({ error: 'Error al procesar checkout' });
  }
});




// POST /api/reservas/:id/cancelar
/*router.post('/:id/cancelar', authRequired, async (req, res) => {
  const id = Number(req.params.id);
  const motivo = (req.body?.motivo ?? '').toString().slice(0, 250) || 'Cancelación';

  try {
    // 1) Trae la reserva
    const { rows: rsv } = await pool.query(
      `SELECT id_reservacion, estado, id_habitacion
         FROM reservaciones
        WHERE id_reservacion = $1`,
      [id]
    );
    if (!rsv.length) return res.status(404).json({ error: 'Reserva no encontrada' });

    const estado = rsv[0].estado;
    if (estado === 'en_curso' || estado === 'finalizada') {
      return res.status(409).json({ error: 'No se puede cancelar una reserva en curso o finalizada' });
    }

    // 2) Calcula totales actuales (para reportar)
    const { rows: tot } = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN tipo='cargo' THEN cantidad ELSE 0 END),0) AS debitos,
         COALESCE(SUM(CASE WHEN tipo='abono' THEN cantidad ELSE 0 END),0) AS creditos
       FROM movimientos
       WHERE id_reservacion = $1`,
      [id]
    );
    const debitos  = Number(tot[0].debitos);
    const creditos = Number(tot[0].creditos);
    const saldo_cliente   = creditos - debitos; // saldo a favor del cliente (+) o en contra (-)
    const saldo_pendiente = debitos - creditos; // lo que debe el cliente

    await pool.query('BEGIN');

    // 3) Marca la reserva cancelada
    await pool.query(
      `UPDATE reservaciones
          SET estado = 'cancelada'
        WHERE id_reservacion = $1`,
      [id]
    );

    // 4) (Opcional) registra un movimiento informativo
    await pool.query(
      `INSERT INTO movimientos (id_reservacion, tipo, descripcion, cantidad, moneda, creado_por)
       VALUES ($1, 'cargo', $2, 0, 'MXN', $3)`,
      [id, `Cancelación: ${motivo}`, req.user?.id_usuario ?? null]
    );

    await pool.query('COMMIT');

    res.json({
      mensaje: 'Reserva cancelada',
      totales: { debitos, creditos, saldo_cliente, saldo_pendiente }
    });
  } catch (e) {
    await pool.query('ROLLBACK');
    console.error('POST /reservas/:id/cancelar', e.code, e.message, e.detail);
    res.status(500).json({ error: 'Error al cancelar la reserva' });
  }
});*/



// PUT /api/reservas/:id  - Editar / reagendar reserva
router.put('/:id', authRequired, async (req, res) => {
  console.log('ENTRO A PUT RESERVA:', req.params.id);
  console.log('Body recibido:', req.body);

  const id = Number(req.params.id);
  const r = req.body;

  try {
    // =========================
    // 1) VALIDACIONES BÁSICAS
    // =========================
    if (!r.id_habitacion) {
      return res.status(400).json({ error: 'Falta seleccionar la habitación' });
    }

    const adultos = Number(r.adultos ?? 0);
    const ninos   = Number(r.ninos ?? 0);

    if (adultos < 0 || ninos < 0) {
      return res.status(400).json({ error: 'Los huéspedes no pueden ser negativos' });
    }

    if (adultos + ninos < 1) {
      return res.status(400).json({ error: 'Debe haber al menos 1 huésped en la reserva' });
    }

    const llegada = new Date(`${r.llegada}T00:00:00`);
    const salida  = new Date(`${r.salida}T00:00:00`);

    if (isNaN(llegada.getTime()) || isNaN(salida.getTime())) {
      return res.status(400).json({ error: 'Fechas inválidas' });
    }

    llegada.setHours(0, 0, 0, 0);
    salida.setHours(0, 0, 0, 0);

    if (salida <= llegada) {
      return res
        .status(400)
        .json({ error: 'El check-out debe ser posterior al check-in' });
    }

    const diffTime = salida.getTime() - llegada.getTime();
    const noches = Math.max(1, Math.ceil(diffTime / 86400000)); // 86400000 = ms/día

    // ======================================
    // 2) OBTENER HABITACIÓN + TIPO Y ESTADO
    // ======================================
    const { rows: habRows } = await pool.query(
      `
      SELECT 
        h.id_habitacion,
        h.numero_habitacion,
        -- si tienes columna de estado / mantenimiento, ponla aquí:
        h.estado,
        h.tarifa_base,
        t.adultos_max,
        t.ninos_max,
        t.adultos_extra_max,
        t.ninos_extra_max,
        t.precio_adulto_extra,
        t.precio_nino_extra,
        t.camas_extra_max,
        t.precio_cama_extra
      FROM habitaciones h
      JOIN tipos_habitaciones t ON h.id_tipo = t.id_tipo
      WHERE h.id_habitacion = $1
      `,
      [r.id_habitacion]
    );

    if (!habRows.length) {
      return res.status(404).json({ error: 'Habitación no encontrada' });
    }

    const hab = habRows[0];


    // Traer la reserva actual
    const { rows: rsvRows } = await pool.query(`
      SELECT camas_extra 
      FROM reservaciones 
      WHERE id_reservacion = $1
    `, [id]);

    if (!rsvRows.length) {
      return res.status(404).json({ error: "Reserva no encontrada." });
    }

    const reservaActual = rsvRows[0];


     const estadosNoReservables = [
      "mantenimiento",
      "bloqueada",
      "fuera_servicio",
      "inactiva"
    ];

    if (estadosNoReservables.includes(hab.estado)) {
      return res.status(400).json({
        error: `La habitación ${hab.numero_habitacion} no puede reservarse (${hab.estado})`
      });
    }

    // VALIDAR DISPONIBILIDAD POR FECHAS
    const { rows: conflictos } = await pool.query(
      `
      SELECT id_reservacion
      FROM reservaciones
      WHERE id_habitacion = $1
        AND id_reservacion <> $2
        AND estado <> 'cancelada'
        AND (check_in < $4 AND check_out > $3)
      `,
      [r.id_habitacion, id, llegada, salida]
    );

    if (conflictos.length > 0) {
      return res.status(400).json({
        error: "La habitación ya está reservada en ese rango de fechas"
      });
    }


    const camasExtra =
      r.camas_extra !== undefined && r.camas_extra !== null
        ? Number(r.camas_extra)
        : Number(reservaActual.camas_extra ?? 0);

    // ====================================
    // 4) VALIDAR CAPACIDAD (CON EXTRAS)
    // ====================================
    const maxAdultosNormales = Number(hab.adultos_max ?? 0);
    const maxNinosNormales   = Number(hab.ninos_max ?? 0);

    const maxAdultosExtras = Number(hab.adultos_extra_max ?? 0);
    const maxNinosExtras   = Number(hab.ninos_extra_max ?? 0);

    const maxAdultosTotal = maxAdultosNormales + maxAdultosExtras;
    const maxNinosTotal   = maxNinosNormales + maxNinosExtras;

    if (adultos > maxAdultosTotal) {
      return res.status(400).json({
        error: `Exceso de adultos para esta habitación. Máximo ${maxAdultosNormales} sin cargo + ${maxAdultosExtras} extra(s).`,
      });
    }

    if (ninos > maxNinosTotal) {
      return res.status(400).json({
        error: `Exceso de niños para esta habitación. Máximo ${maxNinosNormales} sin cargo + ${maxNinosExtras} extra(s).`,
      });
    }

    if (camasExtra > hab.camas_extra_max) {
      return res.status(400).json({ error: `Máximo ${hab.camas_extra_max} camas extra.` });
    }

    const adultosExtra = Math.max(0, adultos - maxAdultosNormales);
    const ninosExtra   = Math.max(0, ninos   - maxNinosNormales);

    // =======================================
    // 5) CÁLCULO DE PRECIOS (POR NOCHE + IVA)
    // =======================================
    const precioBaseNoche       = Number(hab.tarifa_base ?? 0);
    const precioAdultoExtraNoc  = Number(hab.precio_adulto_extra ?? 0);
    const precioNinoExtraNoc    = Number(hab.precio_nino_extra ?? 0);
    const precioCamaExtraNoc    = Number(hab.precio_cama_extra ?? 0);

    const rentaBase   = precioBaseNoche * noches;
    const cargoAdultosExtra = adultosExtra * precioAdultoExtraNoc * noches;
    const cargoNinosExtra   = ninosExtra   * precioNinoExtraNoc   * noches;
    const cargoCamasExtra   = camasExtra   * precioCamaExtraNoc   * noches;

    const subtotal = rentaBase + cargoAdultosExtra + cargoNinosExtra + cargoCamasExtra;

    const IVA_RATE = 0.16; // si usas 19% cámbialo a 0.19
    const iva   = Number((subtotal * IVA_RATE).toFixed(2));
    const total = Number((subtotal + iva).toFixed(2));

    console.log('💰 CÁLCULOS REAGENDAR:', {
      noches,
      adultos,
      ninos,
      camasExtra,
      rentaBase,
      cargoAdultosExtra,
      cargoNinosExtra,
      cargoCamasExtra,
      subtotal,
      iva,
      total,
    });

    // ==========================
    // 6) ACTUALIZAR RESERVACIÓN
    // ==========================
    await pool.query(
      `
      UPDATE reservaciones SET 
        nombre_huesped    = $1,
        apellido1_huesped = $2,
        check_in          = $3,
        check_out         = $4,
        adultos           = $5,
        ninos             = $6,
        id_habitacion     = $7,
        tarifa_por_noche  = $8,
        total_pagar       = $9,
        camas_extra        = $10,
        total_camas_extra  = $11
      WHERE id_reservacion = $12
      `,
      [
        r.nombre,
        r.apellido,
        llegada,
        salida,
        adultos,
        ninos,
        r.id_habitacion,
        precioBaseNoche,
        total,
        camasExtra,
        cargoCamasExtra,
        id,
      ]
    );

    // ==========================================
    // 7) UPSERT DEL MOVIMIENTO "Renta" (CARGO)
    // ==========================================
    const { rows: cargoRows } = await pool.query(
      `
      SELECT id_movimiento
      FROM movimientos
      WHERE id_reservacion = $1
        AND tipo = 'cargo'
        AND descripcion = 'Renta'
      LIMIT 1
      `,
      [id]
    );

    if (cargoRows.length) {
      await pool.query(
        `
        UPDATE movimientos
        SET cantidad = $1
        WHERE id_movimiento = $2
        `,
        [total, cargoRows[0].id_movimiento]
      );
    } else {
      await pool.query(
        `
        INSERT INTO movimientos (id_reservacion, tipo, descripcion, cantidad, moneda)
        VALUES ($1, 'cargo', 'Renta', $2, 'MXN')
        `,
        [id, total]
      );
    }

    // ======================================
    // 8) RE-CALCULAR ESTADO DE CUENTA TOTAL
    // ======================================
    const { rows: totRows } = await pool.query(
      `
      SELECT
        COALESCE(SUM(CASE WHEN tipo='cargo' THEN cantidad ELSE 0 END),0) AS cargos,
        COALESCE(SUM(CASE WHEN tipo='abono' THEN cantidad ELSE 0 END),0) AS abonos
      FROM movimientos
      WHERE id_reservacion = $1
      `,
      [id]
    );

    const cargosTot = Number(totRows[0].cargos);
    const abonosTot = Number(totRows[0].abonos);
    const saldo     = Number((cargosTot - abonosTot).toFixed(2));

    // ==================
    // 9) RESPUESTA JSON
    // ==================
    return res.json({
      message: 'Reserva actualizada con nuevos montos',
      noches,
      tarifa_por_noche: precioBaseNoche,
      renta_base: rentaBase,
      adultos_extra: adultosExtra,
      ninos_extra: ninosExtra,
      cargos_detalle: {
        cargoAdultosExtra,
        cargoNinosExtra,
        cargoCamasExtra,
        subtotal,
        iva,
        total,
      },
      estado_cuenta: {
        cargos: cargosTot,
        abonos: abonosTot,
        saldo,
      },
    });
  } catch (err) {
    console.error('Error actualizando reserva:', err);
    return res
      .status(500)
      .json({ error: 'Error actualizando reserva', detalle: err.message });
  }
});


// CANCELAR RESERVA
router.put('/:id/cancelar', authRequired, async (req, res) => {
  const id = req.params.id;

  try {
    // 1) Obtener la reserva
    const { rows: reservaRows } = await pool.query(`
      SELECT r.*, h.estado AS estado_habitacion
      FROM reservaciones r
      JOIN habitaciones h ON h.id_habitacion = r.id_habitacion
      WHERE r.id_reservacion = $1
    `, [id]);

    if (!reservaRows.length) {
      return res.status(404).json({ error: "Reserva no encontrada" });
    }

    const reserva = reservaRows[0];

    // =============================
    // VALIDACIÓN 1 — Estado inválido
    // =============================
    if (reserva.estado === 'cancelada' || reserva.estado === 'finalizada') {
      return res.status(400).json({
        error: "No se puede cancelar una reserva finalizada o ya cancelada"
      });
    }

    // =============================
    // VALIDACIÓN 2 — No cancelar si ya hubo check-in
    // =============================
    /*if (reserva.estado_habitacion === 'ocupada') {
      return res.status(400).json({
        error: "No se puede cancelar: el huésped ya hizo check-in"
      });
    }*/

    // =============================
    // 3) Registrar movimiento auditoría
    // =============================
    await pool.query(`
      INSERT INTO movimientos 
      (id_reservacion, tipo, descripcion, cantidad, moneda)
      VALUES ($1, 'cargo', 'Cancelación de reserva', 0, 'MXN')
    `, [id]);

    // =============================
    // 4) Cambiar estado de la reserva
    // =============================
    await pool.query(`
      UPDATE reservaciones
      SET estado = 'cancelada'
      WHERE id_reservacion = $1
    `, [id]);

    // =============================
    // 5) Liberar habitación
    // =============================
    await pool.query(`
      UPDATE habitaciones
      SET estado = 'disponible'
      WHERE id_habitacion = $1
    `, [reserva.id_habitacion]);

    res.json({
      message: "Reserva cancelada exitosamente",
      id_reservacion: id
    });

  } catch (err) {
    console.error("Error cancelando reserva:", err);
    res.status(500).json({ error: "Error interno al cancelar la reserva" });
  }
});





// GET /api/reservas/:id  - Detalle de una reserva
router.get('/:id', authRequired, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  try {
    // Datos de la reserva + info de habitación (número/tipo)
    const { rows } = await pool.query(
      `SELECT r.id_reservacion, r.folio, r.id_hotel, r.id_habitacion,
              r.nombre_huesped, r.apellido1_huesped, r.apellido2_hespued,
              r.check_in, r.check_out, r.adultos, r.ninos,
              r.tarifa_por_noche, r.total_pagar, r.estado, r.metodo_pago,
              h.numero_habitacion, h.id_tipo
         FROM reservaciones r
         JOIN habitaciones h ON h.id_habitacion = r.id_habitacion
        WHERE r.id_reservacion = $1
        LIMIT 1`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Reserva no encontrada' });
    }

    const reserva = rows[0];

    // Totales del estado de cuenta (débitos = cargos, créditos = abonos)
    const { rows: tot } = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN tipo='cargo' THEN cantidad ELSE 0 END),0) AS debitos,
         COALESCE(SUM(CASE WHEN tipo='abono' THEN cantidad ELSE 0 END),0) AS creditos
       FROM movimientos
      WHERE id_reservacion = $1`,
      [id]
    );

    const debitos  = Number(tot[0].debitos || 0);
    const creditos = Number(tot[0].creditos || 0);
    const saldo    = creditos - debitos;

    return res.json({
      ...reserva,
      totales: { debitos, creditos, saldo }
    });
  } catch (e) {
    console.error('GET /reservas/:id error:', e);
    return res.status(500).json({ error: 'Error al obtener la reserva' });
  }
});

export default router;
