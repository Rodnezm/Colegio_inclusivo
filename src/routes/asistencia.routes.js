// src/routes/asistencia.routes.js
const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const AsistenciaController = require('../controllers/asistencia.controller');
const authMiddleware = require('../middleware/auth.middleware');
const accessibilityMiddleware = require('../middleware/accessibility.middleware');

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware.verifyToken);

// Cargar configuración de accesibilidad
router.use(accessibilityMiddleware.loadAccessibilityConfig);

// ===== RUTAS PARA ESTUDIANTES =====

// GET /api/asistencias/estudiante/:id - Obtener asistencia de un estudiante
router.get(
  '/estudiante/:id',
  [
    param('id').isInt().withMessage('ID de estudiante debe ser un número entero')
  ],
  authMiddleware.checkOwnership('estudiante'), // Verificar que sea el propio estudiante o tutor
  AsistenciaController.getAsistenciasByEstudiante
);

// ===== RUTAS PARA PROFESORES =====

// GET /api/asistencias/materia/:materiaId/fecha/:fecha - Obtener lista de asistencia por materia y fecha
router.get(
  '/materia/:materiaId/fecha/:fecha',
  [
    param('materiaId').isInt().withMessage('ID de materia debe ser un número entero'),
    param('fecha').isDate().withMessage('Fecha debe tener formato YYYY-MM-DD')
  ],
  authMiddleware.checkRole(['admin', 'profesor']),
  AsistenciaController.getAsistenciaByMateriaAndFecha
);

// POST /api/asistencias - Registrar asistencia
router.post(
  '/',
  [
    authMiddleware.checkRole(['admin', 'profesor']),
    body('materia_idmateria').isInt().withMessage('ID de materia debe ser un número entero'),
    body('fecha_asist').isDate().withMessage('Fecha debe tener formato YYYY-MM-DD'),
    body('asistencias').isArray().withMessage('Debe proporcionar un array de asistencias'),
    body('asistencias.*.estudiante_idestudiante').isInt().withMessage('ID de estudiante debe ser un número entero'),
    body('asistencias.*.estado_asist').isIn(['presente', 'ausente', 'justificado']).withMessage('Estado de asistencia debe ser: presente, ausente o justificado')
  ],
  AsistenciaController.registrarAsistencia
);

// PUT /api/asistencias/:id/justificar - Justificar una ausencia
router.put(
  '/:id/justificar',
  [
    authMiddleware.checkRole(['admin', 'profesor']),
    param('id').isInt().withMessage('ID de asistencia debe ser un número entero'),
    body('justificacion_asist').notEmpty().withMessage('Debe proporcionar una justificación')
  ],
  AsistenciaController.justificarAusencia
);

// GET /api/asistencias/reporte/materia/:materiaId - Obtener reporte de asistencia por materia
router.get(
  '/reporte/materia/:materiaId',
  [
    param('materiaId').isInt().withMessage('ID de materia debe ser un número entero')
  ],
  authMiddleware.checkRole(['admin', 'profesor']),
  AsistenciaController.getReporteAsistenciaPorMateria
);

module.exports = router;