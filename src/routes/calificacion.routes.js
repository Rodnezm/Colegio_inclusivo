// src/routes/calificacion.routes.js
const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const CalificacionController = require('../controllers/calificacion.controller');
const authMiddleware = require('../middleware/auth.middleware');
const accessibilityMiddleware = require('../middleware/accessibility.middleware');

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware.verifyToken);

// Middleware para aplicar configuración de accesibilidad
router.use(accessibilityMiddleware.loadAccessibilityConfig);

// Rutas para estudiantes y tutores
// GET /api/calificaciones/estudiante/:id - Obtener calificaciones de un estudiante
router.get(
  '/estudiante/:id',
  [param('id').isInt().withMessage('ID de estudiante debe ser un número entero')],
  authMiddleware.checkOwnership('estudiante'), // Verifica que el usuario tenga acceso a este estudiante
  CalificacionController.getCalificacionesByEstudiante
);

// Rutas para profesores
// GET /api/calificaciones/materia/:id - Obtener calificaciones por materia
router.get(
  '/materia/:id',
  [param('id').isInt().withMessage('ID de materia debe ser un número entero')],
  authMiddleware.checkRole(['admin', 'profesor']),
  CalificacionController.getCalificacionesByMateria
);

// POST /api/calificaciones - Registrar nueva calificación (solo profesores)
router.post(
  '/',
  authMiddleware.checkRole(['admin', 'profesor']),
  [
    body('materia_idmateria').isInt().withMessage('ID de materia debe ser un número entero'),
    body('estudiante_idestudiante').isInt().withMessage('ID de estudiante debe ser un número entero'),
    body('valor_calif').isFloat({ min: 0, max: 100 }).withMessage('Valor de calificación debe ser un número entre 0 y 100'),
    body('tipo_calif').isString().withMessage('Tipo de calificación debe ser una cadena de texto')
  ],
  CalificacionController.createCalificacion
);

// PUT /api/calificaciones/:id - Actualizar calificación (solo profesores)
router.put(
  '/:id',
  authMiddleware.checkRole(['admin', 'profesor']),
  [
    param('id').isInt().withMessage('ID de calificación debe ser un número entero'),
    body('valor_calif').optional().isFloat({ min: 0, max: 100 }).withMessage('Valor de calificación debe ser un número entre 0 y 100'),
    body('tipo_calif').optional().isString().withMessage('Tipo de calificación debe ser una cadena de texto')
  ],
  CalificacionController.updateCalificacion
);

// DELETE /api/calificaciones/:id - Eliminar calificación (solo admin)
router.delete(
  '/:id',
  authMiddleware.checkRole(['admin']),
  [param('id').isInt().withMessage('ID de calificación debe ser un número entero')],
  CalificacionController.deleteCalificacion
);

// GET /api/calificaciones/reporte/materia/:id - Obtener reporte de calificaciones por materia
router.get(
  '/reporte/materia/:id',
  authMiddleware.checkRole(['admin', 'profesor']),
  [param('id').isInt().withMessage('ID de materia debe ser un número entero')],
  CalificacionController.getReportePorMateria
);

// GET /api/calificaciones/promedio/estudiante/:estudianteId/materia/:materiaId - Obtener promedio de calificaciones
router.get(
  '/promedio/estudiante/:estudianteId/materia/:materiaId',
  [
    param('estudianteId').isInt().withMessage('ID de estudiante debe ser un número entero'),
    param('materiaId').isInt().withMessage('ID de materia debe ser un número entero')
  ],
  CalificacionController.getPromedio
);

module.exports = router;