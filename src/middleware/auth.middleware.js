const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

// Middleware para verificar token JWT
exports.verifyToken = async (req, res, next) => {
  try {
    // Obtener token del encabezado de autorización
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No autorizado - Token requerido' });
    }

    const token = authHeader.split(' ')[1]; // Obtener la parte después de 'Bearer '

    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verificar si el usuario existe en la base de datos
    const result = await query('SELECT idUsuario, nomb_user, tipo_user FROM Usuario WHERE idUsuario = $1', [decoded.id]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'No autorizado - Usuario no encontrado' });
    }

    // Añadir información del usuario al objeto de solicitud
    req.user = {
      id: result.rows[0].idUsuario,
      nomb_user: result.rows[0].nomb_user,
      tipo_user: result.rows[0].tipo_user
    };
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'No autorizado - Token inválido' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'No autorizado - Token expirado' });
    }
    
    console.error('Error en verificación de token:', error);
    return res.status(500).json({ message: 'Error en el servidor' });
  }
};

// Middleware para verificar roles
exports.checkRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'No autorizado - Autenticación requerida' });
    }

    if (!roles.includes(req.user.tipo_user)) {
      return res.status(403).json({ message: 'Prohibido - No tienes permisos suficientes' });
    }

    next();
  };
};

// Middleware para verificar propiedad del recurso
exports.checkOwnership = (resourceType) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;
      const resourceId = req.params.id;
      
      if (req.user.tipo_user === 'admin') {
        // Los administradores tienen acceso a todos los recursos
        return next();
      }
      
      let isOwner = false;
      
      switch (resourceType) {
        case 'estudiante':
          // Verificar si el usuario es el estudiante
          const estudianteResult = await query(
            'SELECT * FROM Estudiante WHERE idEstudiante = $1 AND Usuario_idUsuario = $2',
            [resourceId, userId]
          );
          isOwner = estudianteResult.rows.length > 0;
          break;
          
        case 'profesor':
          // Verificar si el usuario es el profesor
          const profesorResult = await query(
            'SELECT * FROM Profesor WHERE idProfesor = $1 AND Usuario_idUsuario = $2',
            [resourceId, userId]
          );
          isOwner = profesorResult.rows.length > 0;
          break;
          
        default:
          return res.status(500).json({ message: 'Tipo de recurso no válido' });
      }
      
      if (isOwner) {
        return next();
      }
      
      return res.status(403).json({ message: 'Prohibido - No tienes permisos para acceder a este recurso' });
    } catch (error) {
      console.error('Error en verificación de propiedad:', error);
      return res.status(500).json({ message: 'Error en el servidor' });
    }
  };
};