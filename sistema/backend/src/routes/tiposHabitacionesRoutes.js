import express from "express";
import { pool } from "../db.js";
import { authRequired } from "../middleware/auth.js";

const router = express.Router();

router.get("/", authRequired, async (req, res) => {
  try {
    const scopeHotelId = req.scopeHotelId;

    const sql = `
      SELECT
        id_tipo,
        nombre,
        adultos_max,
        ninos_max,
        adultos_extra_max,
        ninos_extra_max,
        precio_adulto_extra,
        precio_nino_extra,
        camas_extra_max,
        precio_cama_extra
      FROM tipos_habitaciones
      ORDER BY nombre;
    `;

    const { rows } = await pool.query(sql);
    res.json(rows);
  } catch (error) {
    console.error("Error cargando tipos:", error);
    res.status(500).json({ error: "Error cargando tipos de habitación" });
  }
});

export default router;
