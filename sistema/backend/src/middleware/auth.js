import jwt from 'jsonwebtoken';

export function authRequired(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Token requerido' });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    // payload: { id_usuario, rol, id_hotel, nombreusuario }
    req.user = payload;

    // Alcance por hotel:
    // - recepcionista / admin_local: forzar su hotel
    // - admin_cadena: puede ver todos o filtrar por ?hotel=ID
    if (payload.rol === 'admin_cadena') {
      req.scopeHotelId = req.query.hotel ? parseInt(req.query.hotel, 10) : null; // null = multi-hotel
    } else {
      req.scopeHotelId = payload.id_hotel; // siempre su hotel
    }

    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

export function requireRoles(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'No autenticado' });
    if (!rolesPermitidos.includes(req.user.rol)) {
      return res.status(403).json({ error: 'Permisos insuficientes' });
    }
    next();
  };
}
