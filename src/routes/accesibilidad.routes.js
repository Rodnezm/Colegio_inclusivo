// src/routes/accesibilidad.routes.js
const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const AccesibilidadController = require('../controllers/accesibilidad.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Todas las rutas requieren autenticación
router.use(authMiddleware.verifyToken);

// GET /api/accesibilidad - Obtener configuración de accesibilidad del usuario actual
router.get('/', AccesibilidadController.getConfiguracion);

// PUT /api/accesibilidad - Actualizar configuración de accesibilidad
router.put('/', 
  [
    // Validaciones para diferentes campos
    body('subtitulos_activados').optional().isBoolean().withMessage('Debe ser un valor booleano'),
    body('lenguajes_señas').optional().isBoolean().withMessage('Debe ser un valor booleano'),
    body('alto_contraste').optional().isBoolean().withMessage('Debe ser un valor booleano'),
    body('tamaño_letra').optional().isInt({ min: 10, max: 36 }).withMessage('Debe ser un número entre 10 y 36'),
    body('velocidad_reproduccion').optional().isFloat({ min: 0.5, max: 2.0 }).withMessage('Debe ser un número entre 0.5 y 2.0'),
    body('modo_tdah').optional().isBoolean().withMessage('Debe ser un valor booleano'),
    body('navegacion_por_teclado').optional().isBoolean().withMessage('Debe ser un valor booleano'),
    body('lector_pantalla').optional().isBoolean().withMessage('Debe ser un valor booleano'),
    body('problema_vision_parcial').optional().isBoolean().withMessage('Debe ser un valor booleano'),
    body('problema_vision_total').optional().isBoolean().withMessage('Debe ser un valor booleano')
  ],
  AccesibilidadController.updateConfiguracion
);

// GET /api/accesibilidad/perfiles - Obtener perfiles disponibles
router.get('/perfiles', AccesibilidadController.getPerfilesDisponibles);

// POST /api/accesibilidad/perfiles/:perfil - Aplicar un perfil predefinido
router.post('/perfiles/:perfil',
  [
    param('perfil').isString().withMessage('ID de perfil debe ser texto')
  ],
  AccesibilidadController.aplicarPerfil
);

module.exports = router;