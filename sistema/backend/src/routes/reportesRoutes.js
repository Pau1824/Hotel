// BACKEND - RUTA DE REPORTES - /api/reportes
import express from 'express';
import pool from '../db.js';

const router = express.Router();

// GET /api/reportes/resumen
router.get('/resumen', async (req, res) => {
  try {
    const [habitaciones] = await pool.query('SELECT COUNT(*) AS total FROM habitaciones');
    const [ocupadas] = await pool.query("SELECT COUNT(*) AS ocupadas FROM habitaciones WHERE estado = 'Ocupada'");
    const [reservadas] = await pool.query("SELECT COUNT(*) AS reservadas FROM reservas WHERE estado = 'Reservada'");
    const [disponibles] = await pool.query("SELECT COUNT(*) AS disponibles FROM habitaciones WHERE estado = 'Disponible'");
    const [tarifa] = await pool.query("SELECT AVG(tarifa) AS promedio FROM reservas WHERE estado IN ('En curso', 'Reservada')");

    const total = habitaciones[0].total;
    const ocupadasCount = ocupadas[0].ocupadas;
    const reservadasCount = reservadas[0].reservadas;
    const disponiblesCount = disponibles[0].disponibles;
    const porcentajeOcupacion = ((ocupadasCount + reservadasCount) / total) * 100;

    res.json({
      total,
      ocupadas: ocupadasCount,
      reservadas: reservadasCount,
      disponibles: disponiblesCount,
      porcentajeOcupacion: Math.round(porcentajeOcupacion),
      tarifaPromedio: parseFloat(tarifa[0].promedio || 0).toFixed(2)
    });
  } catch (error) {
    console.error('Error al generar resumen:', error);
    res.status(500).json({ error: 'Error al generar resumen de reportes' });
  }
});

// GET /api/reportes/ingresos-mensuales
router.get('/ingresos-mensuales', async (req, res) => {
  try {
    const [result] = await pool.query(`
      SELECT 
        MONTH(llegada) AS mes,
        SUM(ingreso_renta) AS total
      FROM reservas
      WHERE YEAR(llegada) = YEAR(CURDATE())
      GROUP BY mes
      ORDER BY mes ASC
    `);

    const meses = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    const data = Array.from({ length: 12 }, (_, i) => {
      const mesEncontrado = result.find(r => r.mes === i + 1);
      return {
        mes: meses[i],
        ingreso: mesEncontrado ? parseFloat(mesEncontrado.total) : 0
      };
    });

    res.json(data);
  } catch (error) {
    console.error('Error al obtener ingresos mensuales:', error);
    res.status(500).json({ error: 'Error al obtener ingresos mensuales' });
  }
});

// GET /api/reportes/habitaciones-en-uso
router.get('/habitaciones-en-uso', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT numero, piso, estado, tarifa
      FROM habitaciones
      WHERE estado IN ('Ocupada', 'Reservada', 'Mantenimiento')
      ORDER BY numero ASC
    `);

    res.json(rows);
  } catch (error) {
    console.error('Error al obtener habitaciones en uso:', error);
    res.status(500).json({ error: 'Error al obtener habitaciones en uso' });
  }
});


export default router;
