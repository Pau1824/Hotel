import { Router } from "express";
import pool from "../db.js";
import { authRequired, requireRoles } from "../middleware/auth.js";

const router = Router();

// ===============================
//   GET — Lista de hoteles
// ===============================
router.get("/hoteles", authRequired, requireRoles("admin_cadena"), async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id_hotel, codigo, nombre, locacion, zonahoraria, es_activo
      FROM hoteles
      ORDER BY id_hotel ASC
    `);

    
    res.json(rows);

  } catch (err) {
    console.error("GET hoteles:", err);
    res.status(500).json({ error: "Error obteniendo los hoteles" });
  }
});

// ===============================
//   POST — Crear hotel
// ===============================
router.post("/hoteles", authRequired, requireRoles("admin_cadena"), async (req, res) => {
  try {
    const { codigo, nombre, locacion, zonahoraria } = req.body;

    if (!codigo || !nombre || !locacion) {
      return res.status(400).json({ error: "Datos incompletos" });
    }

    const { rows } = await pool.query(
      `
      INSERT INTO hoteles (codigo, nombre, locacion, zonahoraria)
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [codigo, nombre, locacion, zonahoraria || "GMT-6"]
    );

    res.json(rows[0]);

  } catch (err) {
    console.error("POST hoteles:", err);
    res.status(500).json({ error: "Error creando hotel" });
  }
});


// PATCH /api/cadena/hoteles/:id/estado
router.patch("/hoteles/:id/estado", authRequired, requireRoles("admin_cadena"), async (req, res) => {
  try {
    const { id } = req.params;
    const { es_activo } = req.body; // true o false

    if (typeof es_activo !== "boolean") {
      return res.status(400).json({ error: "Valor es_activo inválido" });
    }

    // Actualizar hotel
    const result = await pool.query(
      `UPDATE hoteles 
       SET es_activo = $1
       WHERE id_hotel = $2
       RETURNING *`,
      [es_activo, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Hotel no encontrado" });
    }

    res.json({
      message: es_activo ? "Hotel activado" : "Hotel desactivado",
      hotel: result.rows[0],
    });

  } catch (err) {
    console.error("PATCH /api/cadena/hoteles/:id/estado error:", err);
    res.status(500).json({ error: "Error actualizando estado del hotel" });
  }
});



export default router;
