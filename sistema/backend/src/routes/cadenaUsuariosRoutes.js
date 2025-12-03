import { Router } from 'express';
import { pool } from '../db.js';
import { authRequired, requireRoles } from '../middleware/auth.js';

const router = Router();

// =========================
// GET: listar admins locales
// =========================
router.get(
  '/',
  authRequired,
  requireRoles('admin_cadena'),
  async (req, res) => {
    try {
      const query = `
        SELECT 
          u.id_usuario,
          u.nombreusuario,
          u.primer_nombre,
          u.apellido,
          u.telefono,
          u.correo,
          u.rol,
          u.es_activo,
          h.id_hotel,
          h.nombre AS hotel_nombre
        FROM usuarios u
        LEFT JOIN hoteles h ON u.id_hotel = h.id_hotel
        WHERE u.rol = 'admin_local'
        ORDER BY u.id_usuario DESC;
      `;

      const result = await pool.query(query);
      res.json(result.rows);
    } catch (error) {
      console.error("GET admin_local: error:", error);
      res.status(500).json({ error: "Error consultando usuarios admin_local" });
    }
  }
);

// =========================
// POST: crear admin_local
// =========================
router.post(
  '/',
  authRequired,
  requireRoles('admin_cadena'),
  async (req, res) => {
    try {
      const {
        nombreusuario,
        usuario,
        contrasena,
        primer_nombre,
        apellido,
        telefono,
        correo,
        id_hotel
      } = req.body;

      const loginUser = nombreusuario ?? usuario;
      const firstName = primer_nombre ;

      // Validación básica
      if (!loginUser || !firstName || !apellido || !contrasena || !id_hotel) {
        return res.status(400).json({
          error:
            'Faltan datos obligatorios: usuario, nombre, apellido, contraseña o hotel.',
        });
      }

      const query = `
        INSERT INTO usuarios (
          nombreusuario, contrasena, primer_nombre, apellido,
          telefono, correo, rol, id_hotel
        ) VALUES ($1, $2, $3, $4, $5, $6, 'admin_local', $7)
        RETURNING *;
      `;

      const params = [
        loginUser,
        contrasena,
        firstName,
        apellido,
        telefono || null,
        correo || null,
        id_hotel
      ];

      const result = await pool.query(query, params);
      res.json(result.rows[0]);

    } catch (error) {
      console.error("POST admin_local:", error);
      res.status(500).json({ error: "Error creando admin_local" });
    }
  }
);

// =========================
// PATCH: cambiar estado (activar/desactivar)
// =========================
router.patch(
  '/:id/estado',
  authRequired,
  requireRoles('admin_cadena'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { es_activo } = req.body;

      const query = `
        UPDATE usuarios
        SET es_activo = $1
        WHERE id_usuario = $2 AND rol = 'admin_local'
        RETURNING *;
      `;

      const result = await pool.query(query, [es_activo, id]);

      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      res.json(result.rows[0]);

    } catch (error) {
      console.error("PATCH admin_local estado:", error);
      res.status(500).json({ error: "Error cambiando estado" });
    }
  }
);

export default router;
