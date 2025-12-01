// src/routes/usuariosRoutes.js
import express from 'express';
import { pool } from '../db.js';
import { authRequired } from '../middleware/auth.js';
//import bcrypt from 'bcrypt';

const router = express.Router();

// GET /api/usuarios?estado=activo|inactivo|todos&search=...
router.get('/', authRequired, async (req, res) => {
  try {
    const { estado = 'activo', search } = req.query;

    // Si ya usas scopeHotel en otros endpoints, mantenemos el patrón:
    const idHotel = req.scopeHotelId; // o req.user.id_hotel, según tu auth

    const where = [];
    const params = [];
    let i = 1;

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

// POST /api/usuarios - crear usuario recepcionista
router.post('/', authRequired, async (req, res) => {
  try {
    const scopeHotelId = req.scopeHotelId;
    const {
      username,
      primerNombre,
      apellidos,
      telefono,
      email,
      password,
      rol = 'recepcionista',
      estado = 'activo',
    } = req.body;

    if (!username || !primerNombre || !apellidos || !password) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    const passHash = await bcrypt.hash(password, 10);

    const sql = `
      INSERT INTO usuarios (
        username, primer_nombre, apellido,
        telefono, email, password_hash,
        rol, estado, id_hotel
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING id_usuario
    `;

    const params = [
      username,
      primerNombre,
      apellidos,
      telefono || null,
      email || null,
      passHash,
      rol,
      estado,
      scopeHotelId,
    ];

    const { rows } = await pool.query(sql, params);

    return res.status(201).json({
      id: rows[0].id_usuario,
      message: 'Usuario creado correctamente',
    });
  } catch (e) {
    console.error('POST /usuarios', e);
    return res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// PUT /api/usuarios/:id - editar datos básicos (no password)
router.put('/:id', authRequired, async (req, res) => {
  try {
    const id = req.params.id;
    const {
      primerNombre,
      apellidos,
      telefono,
      email,
      rol,
      estado,
    } = req.body;

    const sql = `
      UPDATE usuarios
      SET primer_nombre = $1,
          apellido      = $2,
          telefono      = $3,
          email         = $4,
          rol           = $5,
          estado        = $6
      WHERE id_usuario = $7
    `;

    await pool.query(sql, [
      primerNombre,
      apellidos,
      telefono || null,
      email || null,
      rol,
      estado,
      id,
    ]);

    return res.json({ message: 'Usuario actualizado' });
  } catch (e) {
    console.error('PUT /usuarios/:id', e);
    return res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// PATCH /api/usuarios/:id/estado - activar / desactivar
router.patch('/:id/estado', authRequired, async (req, res) => {
  try {
    const id = req.params.id;
    const { estado } = req.body; // 'activo' | 'inactivo'

    await pool.query(
      `UPDATE usuarios SET estado = $1 WHERE id_usuario = $2`,
      [estado, id]
    );

    return res.json({ message: 'Estado actualizado' });
  } catch (e) {
    console.error('PATCH /usuarios/:id/estado', e);
    return res.status(500).json({ error: 'Error al cambiar estado' });
  }
});

export default router;
