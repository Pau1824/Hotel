import express from 'express';
import { body, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { comparePassword, hashPassword } from '../utils/passwords.js';

const router = express.Router();

/**
 * POST /api/auth/login
 * body: { nombreusuario, contrasena }
 * devuelve: { token, user: { id_usuario, rol, id_hotel, nombreusuario } }
 */
router.post(
  '/login',
  body('nombreusuario').isString().trim().notEmpty(),
  body('contrasena').isString().trim().notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ error: 'Datos inválidos', details: errors.array() });

    const { nombreusuario, contrasena } = req.body;

    try {
      const { rows } = await pool.query(
        `SELECT id_usuario, nombreusuario, contrasena, rol, id_hotel, es_activo
         FROM usuarios
         WHERE nombreusuario = $1
         LIMIT 1`,
        [nombreusuario]
      );

      if (!rows.length) return res.status(400).json({ error: 'Credenciales inválidas' });

      const user = rows[0];
      if (!user.es_activo) return res.status(403).json({ error: 'Usuario inactivo' });

      const ok = await comparePassword(contrasena, user.contrasena);
      if (!ok) return res.status(400).json({ error: 'Credenciales inválidas' });

      const token = jwt.sign(
        {
          id_usuario: user.id_usuario,
          nombreusuario: user.nombreusuario,
          rol: user.rol,
          id_hotel: user.id_hotel, // puede ser null para admin_cadena
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES || '7d' }
      );

      res.json({
        token,
        user: {
          id_usuario: user.id_usuario,
          nombreusuario: user.nombreusuario,
          rol: user.rol,
          id_hotel: user.id_hotel,
        },
      });
    } catch (e) {
      console.error('Login error:', e);
      res.status(500).json({ error: 'Error interno' });
    }
  }
);

/**
 * (Opcional) POST /api/auth/seed-demo
 * Crea usuarios demo con contraseñas hasheadas
 */
router.post('/seed-demo', async (req, res) => {
  try {
    const adminLocalPass = await hashPassword('admin123');
    const recepPass = await hashPassword('recep123');
    const chainPass = await hashPassword('chain123');

    // Asegura que exista un hotel demo id 1
    await pool.query(`
      INSERT INTO hoteles (codigo, nombre, locacion, zonahoraria, es_activo)
      VALUES ('COAS','Wyndham Garden Los Mochis','Los Mochis','Mazatlan', true)
      ON CONFLICT (codigo) DO NOTHING
    `);

    // Obtén id_hotel para asignar a admin_local y recepcionista
    const h = await pool.query(`SELECT id_hotel FROM hoteles WHERE codigo='COAS' LIMIT 1`);
    const idHotel = h.rows[0]?.id_hotel || null;

    // Crea/asegura usuarios demo
    await pool.query(
      `INSERT INTO usuarios (nombreusuario, contrasena, primer_nombre, apellido, rol, id_hotel, es_activo)
       VALUES
       ('admin','${adminLocalPass}','Admin','Local','admin_local',$1,true)
       ON CONFLICT (nombreusuario) DO NOTHING`,
      [idHotel]
    );
    await pool.query(
      `INSERT INTO usuarios (nombreusuario, contrasena, primer_nombre, apellido, rol, id_hotel, es_activo)
       VALUES
       ('recep','${recepPass}','Recep','Hotel','recepcionista',$1,true)
       ON CONFLICT (nombreusuario) DO NOTHING`,
      [idHotel]
    );
    await pool.query(
      `INSERT INTO usuarios (nombreusuario, contrasena, primer_nombre, apellido, rol, id_hotel, es_activo)
       VALUES
       ('chainadmin','${chainPass}','Chain','Admin','admin_cadena',NULL,true)
       ON CONFLICT (nombreusuario) DO NOTHING`
    );

    res.json({ mensaje: 'Usuarios demo listos: admin/admin123, recep/recep123, chainadmin/chain123' });
  } catch (e) {
    console.error('Seed error:', e);
    res.status(500).json({ error: 'No se pudo crear usuarios demo' });
  }
});

export default router;
