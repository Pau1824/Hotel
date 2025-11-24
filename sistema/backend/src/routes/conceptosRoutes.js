import express from 'express';
const router = express.Router();

import pool from '../db.js';
import { authRequired } from '../middleware/auth.js';
// =======================
// GET /api/conceptos
// ?q=texto   (búsqueda por codigo/nombre)
// =======================
router.get('/', authRequired, async (req, res) => {
  const { q } = req.query;
  try {
    let rows;
    if (q && q.trim()) {
      const like = `%${q.trim()}%`;
      const result = await pool.query(
        `SELECT id_concepto, codigo, nombre, descripcion, cantidad_default
           FROM concepto_codigo
          WHERE codigo ILIKE $1 OR nombre ILIKE $1
          ORDER BY codigo`,
        [like]
      );
      rows = result.rows;
    } else {
      const result = await pool.query(
        `SELECT id_concepto, codigo, nombre, descripcion, cantidad_default
           FROM concepto_codigo
          ORDER BY codigo`
      );
      rows = result.rows;
    }
    res.json(rows);
  } catch (e) {
    console.error('Error listando conceptos:', e);
    res.status(500).json({ error: 'Error listando conceptos' });
  }
});


// GET catálogo de movimientos
router.get('/catalogo-movimientos', authRequired, async (req, res) => {
  try {
    const sql = `
      SELECT id_concepto, codigo, nombre, descripcion, cantidad_default
      FROM concepto_codigo
      ORDER BY id_concepto ASC
    `;

    const { rows } = await pool.query(sql);
    res.json(rows);

  } catch (error) {
    console.error("Error obteniendo catálogo:", error);
    res.status(500).json({ error: "Error obteniendo catálogo de movimientos" });
  }
});


// =======================
// GET /api/conceptos/:id
// =======================
router.get('/:id', authRequired, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT id_concepto, codigo, nombre, descripcion, cantidad_default
         FROM concepto_codigo
        WHERE id_concepto = $1`,
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Concepto no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (e) {
    console.error('Error obteniendo concepto:', e);
    res.status(500).json({ error: 'Error obteniendo concepto' });
  }
});



// =======================
// POST /api/conceptos
// body: { codigo, nombre, descripcion?, cantidad_default? }
// =======================
router.post('/', authRequired, async (req, res) => {
  const { codigo, nombre, descripcion = null, cantidad_default = null } = req.body || {};
  if (!codigo || !nombre) {
    return res.status(400).json({ error: 'codigo y nombre son requeridos' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO concepto_codigo (codigo, nombre, descripcion, cantidad_default)
       VALUES ($1,$2,$3,$4)
       RETURNING id_concepto, codigo, nombre, descripcion, cantidad_default`,
      [codigo, nombre, descripcion, cantidad_default]
    );
    res.status(201).json(result.rows[0]);
  } catch (e) {
    // clave única en "codigo"
    if (e.code === '23505') {
      return res.status(409).json({ error: 'El código ya existe' });
    }
    console.error('Error creando concepto:', e);
    res.status(500).json({ error: 'Error creando concepto' });
  }
});



// =======================
// PUT /api/conceptos/:id
// body: { codigo?, nombre?, descripcion?, cantidad_default? }
// =======================
router.put('/:id', authRequired, async (req, res) => {
  const { id } = req.params;
  const { codigo, nombre, descripcion, cantidad_default } = req.body || {};

  // construir update dinámico
  const fields = [];
  const values = [];
  let i = 1;

  if (codigo != null) { fields.push(`codigo=$${i++}`); values.push(codigo); }
  if (nombre != null) { fields.push(`nombre=$${i++}`); values.push(nombre); }
  if (descripcion !== undefined) { fields.push(`descripcion=$${i++}`); values.push(descripcion); }
  if (cantidad_default !== undefined) { fields.push(`cantidad_default=$${i++}`); values.push(cantidad_default); }

  if (fields.length === 0) {
    return res.status(400).json({ error: 'Nada para actualizar' });
  }

  try {
    values.push(id);
    const result = await pool.query(
      `UPDATE concepto_codigo
          SET ${fields.join(', ')}
        WHERE id_concepto = $${i}
        RETURNING id_concepto, codigo, nombre, descripcion, cantidad_default`,
      values
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Concepto no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ error: 'El código ya existe' });
    }
    console.error('Error actualizando concepto:', e);
    res.status(500).json({ error: 'Error actualizando concepto' });
  }
});



// =======================
// DELETE /api/conceptos/:id
// (si prefieres soft-delete, agrega columna es_activo y actualízala)
// =======================
router.delete('/:id', authRequired, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `DELETE FROM concepto_codigo WHERE id_concepto = $1`,
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Concepto no encontrado' });
    }
    res.json({ message: 'Concepto eliminado' });
  } catch (e) {
    console.error('Error eliminando concepto:', e);
    res.status(500).json({ error: 'Error eliminando concepto' });
  }
});

export default router;
