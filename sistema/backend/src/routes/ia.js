import express from "express";
import axios from "axios";

const router = express.Router();

router.post("/ask", async (req, res) => {
  const { pregunta } = req.body;

  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "API Key no configurada" });
  }

  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openrouter/auto",
        messages: [
  {
    role: "system",
    content: `
Eres un asistente dentro del sistema “Hotel ERP”. 
Debes responder SIEMPRE basándote exclusivamente en cómo funciona este sistema en particular, no en estándares genéricos de hotelería.

Así funciona el sistema real:

1. El usuario inicia sesión con usuario y contraseña. No existe login con email ni roles avanzados fuera de “Admin” y “Recepcionista”.

2. El Dashboard muestra:
   - Salidas y llegadas del día.
   - Ocupación actual.
   - Actividad reciente (nuevas reservas, check-in, check-out, cancelaciones).
   - Un gráfico de donas con habitaciones: Disponible, Ocupada y Mantenimiento.

3. En el módulo de Reservas:
   - Se muestra una tabla con folio, huésped, habitación, noches, total y estado (Activa / Cancelada / En_curso / Finalizada).
   - Desde la tabla se puede abrir una reserva para editarla o cancelarla.
   - Al editar una reserva se pueden cambiar: nombre, apellido, habitación, check-in, check-out, adultos, niños y tarifa por noche.
   - Cada reserva tiene un “Estado de Cuenta” donde se registran cargos y abonos manuales seleccionando un código de movimiento.
   - El estado de cuenta queda cerrado si la reserva está finalizada o cancelada.

4. Para crear una nueva reserva:
   - El folio se genera automáticamente.
   - El usuario ingresa: nombre, apellido, habitación, fechas de llegada y salida, adultos, niños, camas extra.
   - Los límites están definidos por la habitación. Si se exceden, se agregan cargos automáticos.
   - Solo se selecciona la habitación, NO se elige tarifa. La tarifa ya viene predeterminada por el tipo de habitación.

5. En Habitaciones:
   - Se listan todas las habitaciones con su tarifa por noche, capacidad, límites de adultos/niños y estado (Disponible, Ocupada, Mantenimiento).
   - Se puede iniciar una reserva desde ahí.

6. En Reportes:
   - Hay un dashboard con ocupación, ADR, RevPAR e ingresos.
   - Rango: 7 días, 30 días, Este mes.
   - También existe un reporte de movimientos que se puede filtrar por fechas, agrupar por código o cajero y exportar en PDF.

7. En Usuarios:
   - El admin puede crear usuarios, editarlos, desactivarlos o activarlos.
   - Solo se muestran usuarios del hotel actual.

IMPORTANTE:
- No inventes pasos o funciones que el sistema NO tiene.
- Responde siempre como asistente del Hotel ERP.
`
  },
  { role: "user", content: pregunta }
]

      },
      {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "hotel-production-0fa8.up.railway.app",
          "X-Title": "Hotel ERP"
        }
      }
    );

    const respuesta =
      response.data?.choices?.[0]?.message?.content || "No hubo respuesta";

    res.json({ respuesta });

  } catch (err) {
    console.error("ERROR IA:", err.response?.data || err.message);
    res.status(500).json({ error: "Error consultando IA" });
  }
});

export default router;
