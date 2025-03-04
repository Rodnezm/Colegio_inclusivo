const express = require('express');
const router = express.Router();
const { body, query, param } = require('express-validator');
const ProfesorController = require('../controllers/profesor.controller');
const authMiddleware = require('../middleware/auth.middleware');
const accessibilityMiddleware = require('../middleware/accessibility.middleware');

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware.verifyToken);

// Middleware para aplicar configuración de accesibilidad
router.use(accessibilityMiddleware.loadAccessibilityConfig);

// ===== RUTAS PARA PROFESORES =====

// Obtener todos los profesores
router.get(
  '/',
  ProfesorController.getAllProfesor
);

// Buscar profesores por término
router.get(
  '/buscar',
  [
    query('termino').notEmpty().withMessage('El término de búsqueda es requerido')
  ],
  ProfesorController.buscarProfesores
);

// Obtener profesores por especialidad
router.get(
  '/especialidad/:especialidad',
  ProfesorController.getProfesoresPorEspecialidad
);

// Obtener profesor por ID
router.get(
  '/:id',
  ProfesorController.getProfesorById
);

// Obtener materias asignadas a un profesor
router.get(
  '/:id/materias',
  ProfesorController.getMateriasByProfesor
);

// Obtener estudiantes asignados a un profesor
router.get(
  '/:id/estudiantes',
  ProfesorController.getEstudiantesByProfesor
);

// Obtener estadísticas de un profesor
router.get(
  '/:id/estadisticas',
  ProfesorController.getEstadisticasProfesor
);

// Crear nuevo profesor (solo para admin)
router.post(
  '/',
  authMiddleware.checkRole(['admin']),
  [
    body('nomb_prof').notEmpty().withMessage('El nombre es requerido'),
    body('ape_prof').notEmpty().withMessage('El apellido es requerido'),
    body('ci_prof').notEmpty().withMessage('La cédula es requerida'),
    body('nomb_user').notEmpty().withMessage('El nombre de usuario es requerido'),
    body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
    body('email').optional().isEmail().withMessage('El email debe ser válido')
  ],
  ProfesorController.createProfesor
);

// Asignar materias a un profesor
router.post(
  '/:id/materias',
  authMiddleware.checkRole(['admin']),
  [
    body('materias').isArray().withMessage('Debe proporcionar un array de IDs de materias')
  ],
  ProfesorController.asignarMaterias
);

// Actualizar profesor
router.put(
  '/:id',
  authMiddleware.checkRole(['admin']),
  ProfesorController.updateProfesor
);

// Desasignar materias de un profesor
router.delete(
  '/:id/materias',
  authMiddleware.checkRole(['admin']),
  [
    body('materias').isArray().withMessage('Debe proporcionar un array de IDs de materias')
  ],
  ProfesorController.desasignarMaterias
);

// Eliminar profesor (solo para admin)
router.delete(
  '/:id',
  authMiddleware.checkRole(['admin']),
  ProfesorController.deleteProfesor
);

module.exports = router;