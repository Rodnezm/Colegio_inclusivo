// middleware/accessibility.middleware.js
const { query } = require('../config/database');

// Middleware para cargar configuración de accesibilidad
exports.loadAccessibilityConfig = async (req, res, next) => {
  try {
    // Solo proceder si hay un usuario autenticado
    if (!req.user || !req.user.id) {
      return next();
    }

    // Obtener configuración de accesibilidad del usuario
    const result = await query(
      'SELECT * FROM Conf_accesibilidad WHERE Usuario_idUsuario = $1',
      [req.user.id]
    );
    
    if (result.rows.length > 0) {
      req.accessibilityConfig = result.rows[0];
      
      // Añadir headers específicos de accesibilidad
      if (req.accessibilityConfig.alto_contraste) {
        res.setHeader('X-Accessibility-High-Contrast', 'true');
      }
      
      if (req.accessibilityConfig.tamaño_letra) {
        res.setHeader('X-Accessibility-Font-Size', req.accessibilityConfig.tamaño_letra);
      }
      
      // Otros headers relacionados con accesibilidad pueden ser añadidos aquí
    }
    
    next();
  } catch (error) {
    console.error('Error cargando configuración de accesibilidad:', error);
    next(); // Continuar aunque haya error para no bloquear la respuesta
  }
};

// Middleware para verificar tiempo extra
exports.handleExtraTime = async (req, res, next) => {
  try {
    // Solo proceder si hay configuración de accesibilidad
    if (!req.accessibilityConfig) {
      return next();
    }
    
    // Si el usuario tiene configurado tiempo extra para actividades
    if (req.accessibilityConfig.time_extra_actividad > 0) {
      // Esta información puede ser utilizada en el frontend para ajustar temporizadores
      res.setHeader('X-Accessibility-Extra-Time', req.accessibilityConfig.time_extra_actividad);
    }
    
    next();
  } catch (error) {
    console.error('Error manejando tiempo extra:', error);
    next();
  }
};

// Middleware para aplicar adaptaciones de lectura fácil
exports.applyEasyReading = async (req, res, next) => {
  try {
    // Solo proceder si hay configuración de accesibilidad
    if (!req.accessibilityConfig || !req.accessibilityConfig.modo_lect_facil) {
      return next();
    }
    
    // Añadir header para que el frontend pueda aplicar transformaciones de lectura fácil
    res.setHeader('X-Accessibility-Easy-Reading', 'true');
    
    next();
  } catch (error) {
    console.error('Error aplicando modo lectura fácil:', error);
    next();
  }
};