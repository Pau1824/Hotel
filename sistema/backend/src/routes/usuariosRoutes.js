// src/routes/usuariosRoutes.js
import express from 'express';
import { pool } from '../db.js';
import { authRequired } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';

const router = express.Router();

const SALT_ROUNDS = 10;

// GET /api/usuarios?estado=activo|inactivo|todos&search=...
router.get('/', authRequired, async (req, res) => {
  try {
    const { estado = 'activo', search } = req.query;

    // Si ya usas scopeHotel en otros endpoints, mantenemos el patrón:
    const idHotel = req.scopeHotelId; // o req.user.id_hotel, según tu auth

    // === Armamos WHERE dinámico ===
    const where = [];
    const params = [];

    // 1) Siempre: solo recepcionistas
    params.push('recepcionista');      // $1
    where.push('u.rol = $1');

    // siguiente placeholder será $2
    let i = 2;

    // Hotel (si quieres limitar por hotel actual)
    if (idHotel) {
      where.push(`u.id_hotel = $${i++}`);
      params.push(idHotel);
    }

    // Filtro por estado
    if (estado === 'activo') {
      where.push(`u.es_activo = true`);
    } else if (estado === 'inactivo') {
      where.push(`u.es_activo = false`);
    } // si es "todos", no agregamos nada

    // Búsqueda (usuario / nombre / teléfono)
    if (search && search.trim() !== '') {
      where.push(`
        (
          u.nombreusuario ILIKE $${i}
          OR (u.primer_nombre || ' ' || u.apellido) ILIKE $${i}
          OR COALESCE(u.telefono, '') ILIKE $${i}
        )
      `);
      params.push(`%${search.trim()}%`);
      i++;
    }

    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const sql = `
      SELECT
        u.id_usuario,
        u.nombreusuario,
        u.primer_nombre,
        u.apellido,
        u.telefono,
        u.correo,
        u.rol,
        u.es_activo,
        u.hora_creado
      FROM usuarios u
      ${whereSql}
      ORDER BY u.primer_nombre, u.apellido;
    `;

    const { rows } = await pool.query(sql, params);

    // Adaptar al shape que espera el front
    const usuarios = rows.map((r) => ({
      id_usuario: r.id_usuario,
      usuario: r.nombreusuario,
      nombreCompleto: `${r.primer_nombre} ${r.apellido}`,
      telefono: r.telefono,
      correo: r.correo,
      rol: r.rol,                            // 'recepcionista', 'admin_local', etc
      rolTexto: 'Recepcionista',
      estado: r.es_activo ? 'activo' : 'inactivo',
      ultimoAcceso: r.hora_creado,          // por ahora usamos hora_creado
    }));

    return res.json(usuarios);
  } catch (e) {
    console.error('GET /api/usuarios', e);
    return res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// POST /api/usuarios - Crear recepcionista
router.post('/', authRequired, async (req, res) => {
  try {
    const {
      nombreusuario,
      primer_nombre,
      apellido,
      telefono,
      correo,
      contrasena,
    } = req.body;

    // 1) Solo admins pueden crear usuarios
    const user = req.user || {};
    const rolActual = user.rol || user.role; // según cómo lo guardes en auth

    if (rolActual !== 'admin_local' && rolActual !== 'admin_cadena') {
      return res.status(403).json({ error: 'Solo los administradores pueden crear usuarios.' });
    }

    // 2) Validaciones básicas
    if (!nombreusuario || !primer_nombre || !apellido || !contrasena) {
      return res.status(400).json({
        error: 'Faltan datos obligatorios (usuario, nombre, apellido, contraseña).',
      });
    }

    // 3) Validar que el usuario no exista
    const existing = await pool.query(
      'SELECT 1 FROM usuarios WHERE nombreusuario = $1',
      [nombreusuario]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Ese nombre de usuario ya existe.' });
    }

    // 4) Hash de la contraseña
    const hashed = await bcrypt.hash(contrasena, SALT_ROUNDS);

    // 5) Hotel actual (si ya usas scopeHotelId)
    const idHotel = req.scopeHotelId || user.id_hotel || null;

    const insertSql = `
      INSERT INTO usuarios (
        nombreusuario,
        contrasena,
        primer_nombre,
        apellido,
        telefono,
        correo,
        rol,
        id_hotel,
        es_activo
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'recepcionista', $7, true)
      RETURNING
        id_usuario,
        nombreusuario,
        primer_nombre,
        apellido,
        telefono,
        rol,
        es_activo,
        hora_creado
    `;

    const { rows } = await pool.query(insertSql, [
      nombreusuario,
      hashed,
      primer_nombre,
      apellido,
      telefono || null,
      correo || null,
      idHotel,
    ]);

    const r = rows[0];

    const usuarioCreado = {
      id_usuario: r.id_usuario,
      usuario: r.nombreusuario,
      nombreCompleto: `${r.primer_nombre} ${r.apellido}`,
      telefono: r.telefono,
      rol: r.rol,                       // 'recepcionista'
      rolTexto: 'Recepcionista',
      estado: r.es_activo ? 'activo' : 'inactivo',
      ultimoAcceso: r.hora_creado,
    };

    return res.status(201).json(usuarioCreado);
  } catch (e) {
    console.error('POST /api/usuarios', e);
    return res.status(500).json({ error: 'Error al crear usuario' });
  }
});


// PUT /api/usuarios/:id/estado  { es_activo: true|false }
router.put('/:id/estado', authRequired, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { es_activo } = req.body;

    if (!id || typeof es_activo !== 'boolean') {
      return res.status(400).json({ error: 'Datos inválidos' });
    }

    // Opcional: limitar por hotel actual
    const idHotel = req.scopeHotelId || null;

    const params = [es_activo, id];
    let whereHotel = '';

    if (idHotel) {
      whereHotel = 'AND id_hotel = $3';
      params.push(idHotel);
    }

    const sql = `
      UPDATE usuarios
      SET es_activo = $1
      WHERE id_usuario = $2
        AND rol = 'recepcionista'
        ${whereHotel}
      RETURNING id_usuario, nombreusuario, primer_nombre, apellido, telefono, rol, es_activo, hora_creado
    `;

    const { rows } = await pool.query(sql, params);

    if (!rows.length) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const u = rows[0];

    return res.json({
      id_usuario: u.id_usuario,
      usuario: u.nombreusuario,
      nombreCompleto: `${u.primer_nombre} ${u.apellido}`,
      telefono: u.telefono,
      rol: u.rol,
      es_activo: u.es_activo,
      hora_creado: u.hora_creado,
    });
  } catch (e) {
    console.error('PUT /api/usuarios/:id/estado', e);
    return res.status(500).json({ error: 'Error al actualizar estado' });
  }
});


//import bcrypt from 'bcrypt';

// PUT /api/usuarios/:id  (editar datos básicos, solo recepcionistas)
router.put('/:id', authRequired, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const { usuario, nombre, apellido, telefono, correo, contrasena } = req.body;

    if (!nombre || !apellido) {
      return res
        .status(400)
        .json({ error: 'Nombre y apellidos son obligatorios' });
    }

    const idHotel = req.scopeHotelId || null;

    // -------------------------------
    // 1) SET base (nombre, apellido, tel, correo)
    // -------------------------------
    const params = [
      nombre.trim(),        // $1
      apellido.trim(),      // $2
      telefono || null,     // $3
      correo || null,       // $4
    ];

    let setSql = `
      primer_nombre = $1,
      apellido      = $2,
      telefono      = $3,
      correo        = $4
    `;

    let nextIndex = 5; // el siguiente placeholder libre

    // -------------------------------
    // 2) Usuario (nombreusuario) opcional
    // -------------------------------
    if (usuario) {
      setSql += `, nombreusuario = $${nextIndex}`;
      params.push(usuario.trim());
      nextIndex++;
    }

    // -------------------------------
    // 3) Contraseña opcional
    // -------------------------------
    if (contrasena) {
      const hash = await bcrypt.hash(contrasena, 10);
      setSql += `, contrasena = $${nextIndex}`;
      params.push(hash);
      nextIndex++;
    }

    // -------------------------------
    // 4) WHERE: id obligatorio
    // -------------------------------
    params.push(id);
    const idIndex = nextIndex; // posición en la query para id_usuario
    nextIndex++;

    // -------------------------------
    // 5) WHERE: hotel opcional
    // -------------------------------
    let whereHotel = '';
    if (idHotel) {
      whereHotel = ` AND id_hotel = $${nextIndex}`;
      params.push(idHotel);
      // nextIndex++;  // ya no lo usamos después, opcional
    }

    const sql = `
      UPDATE usuarios
      SET ${setSql}
      WHERE id_usuario = $${idIndex}
        AND rol = 'recepcionista'
        ${whereHotel}
      RETURNING 
        id_usuario,
        nombreusuario,
        primer_nombre,
        apellido,
        telefono,
        correo,
        rol,
        es_activo,
        hora_creado
    `;

    const { rows } = await pool.query(sql, params);

    if (!rows.length) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const u = rows[0];

    // Respondemos en el mismo shape que usas en el GET
    return res.json({
      id_usuario: u.id_usuario,
      usuario: u.nombreusuario,
      nombreCompleto: `${u.primer_nombre} ${u.apellido}`,
      telefono: u.telefono,
      correo: u.correo,
      rol: u.rol,
      es_activo: u.es_activo,
      hora_creado: u.hora_creado,
    });
  } catch (e) {
    console.error('PUT /api/usuarios/:id', e);

    // Si hay conflicto de UNIQUE (por ejemplo nombreusuario duplicado)
    if (e.code === '23505') {
      return res
        .status(400)
        .json({ error: 'El nombre de usuario ya está en uso.' });
    }

    return res
      .status(500)
      .json({ error: 'Error al actualizar usuario' });
  }
});




/// PUT /api/usuarios/:id/estado  { es_activo: true|false }
router.put('/:id/estado', authRequired, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { es_activo } = req.body;

    if (!id || typeof es_activo !== 'boolean') {
      return res.status(400).json({ error: 'Datos inválidos' });
    }

    // Si tu middleware de auth mete el hotel, lo usamos; si no, lo dejamos vacío
    const idHotel = req.scopeHotelId || null;

    const params = [es_activo, id];
    let whereHotel = '';

    if (idHotel) {
      whereHotel = ' AND id_hotel = $3';
      params.push(idHotel);
    }

    const sql = `
      UPDATE usuarios
      SET es_activo = $1
      WHERE id_usuario = $2
        AND rol = 'recepcionista'
        ${whereHotel}
      RETURNING id_usuario,
                nombreusuario,
                primer_nombre,
                apellido,
                telefono,
                rol,
                es_activo,
                hora_creado
    `;

    const { rows } = await pool.query(sql, params);

    if (!rows.length) {
      // Útil para depurar: ver por qué no encontró fila
      console.warn('PUT /usuarios/:id/estado -> sin filas', {
        id,
        es_activo,
        idHotel,
      });
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const u = rows[0];

    return res.json({
      id_usuario: u.id_usuario,
      usuario: u.nombreusuario,
      nombreCompleto: `${u.primer_nombre} ${u.apellido}`,
      telefono: u.telefono,
      rol: u.rol,
      es_activo: u.es_activo,
      hora_creado: u.hora_creado,
    });
  } catch (e) {
    console.error('PUT /api/usuarios/:id/estado', e);
    return res.status(500).json({ error: 'Error al actualizar estado' });
  }
});


export default router;
