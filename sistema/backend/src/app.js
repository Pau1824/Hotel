import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();
import { pool } from './db.js';

import authRoutes from './routes/authRoutes.js';
import habitacionesRoutes from './routes/habitacionesRoutes.js';
import reservasRoutes from './routes/reservasRoutes.js';
import reportesRoutes from './routes/reportesRoutes.js';
import conceptosRoutes from './routes/conceptosRoutes.js';
import cortesCajaRoutes from './routes/cortesCajaRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import usuariosRoutes from './routes/usuariosRoutes.js';
import iaRoutes from './routes/ia.js';
import habitacionesAdminRoutes from './routes/habitacionesAdminRoutes.js';
import tiposHabitacionesRoutes from './routes/tiposHabitacionesRoutes.js';
import hotelesRoutes from "./routes/cadenaHotelesRoutes.js";
import cadenaUsuariosRoutes from "./routes/cadenaUsuariosRoutes.js";

import { authRequired, requireRoles } from './middleware/auth.js';

//dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
//const conceptosRoutes = require('./routes/conceptosRoutes');

// Verificar conexión
app.get('/api/ping', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ status: 'ok', db_time: result.rows[0].now });
  } catch (error) {
    console.error('Error conectando a DB:', error);
    res.status(500).json({ error: 'Error conectando a la base de datos' });
  }
});

// Rutas públicas
app.use('/api/auth', authRoutes);

// Rutas principales
app.use('/api/habitaciones', authRequired, habitacionesRoutes);
app.use('/api/reservas', authRequired, reservasRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/conceptos', authRequired, conceptosRoutes);
app.use('/api/corte-caja', cortesCajaRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/ia', iaRoutes);
app.use('/api/habitaciones-admin', habitacionesAdminRoutes);
app.use('/api/tipos-habitaciones', tiposHabitacionesRoutes);
app.use("/api/cadena", hotelesRoutes);
app.use("/api/cadena/usuarios-locales", cadenaUsuariosRoutes);


// Ejemplo de ruta SOLO admin_local:
app.get('/api/solo-admin-local', authRequired, requireRoles('admin_local'), (_req, res) => {
  res.json({ ok: true, msg: 'Solo admin_local' });
});

export default app;
