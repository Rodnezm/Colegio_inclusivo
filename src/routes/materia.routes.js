// src/routes/materia.routes.js
const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const MateriaController = require('../controllers/materia.controller');
const authMiddleware = require('../middleware/auth.middleware');
const accessibilityMiddleware = require('../middleware/accessibility.middleware');

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware.verifyToken);

// Cargar configuración de accesibilidad
router.use(accessibilityMiddleware.loadAccessibilityConfig);

// ===== RUTAS GENERALES =====

// GET /api/materias - Obtener todas las materias
router.get('/', MateriaController.getAllMaterias);

// GET /api/materias/search - Buscar materias por término
router.get(
  '/search',
  [
    query('q').notEmpty().withMessage('El término de búsqueda es requerido')
  ],
  MateriaController.searchMaterias
);

// GET /api/materias/:id - Obtener materia por ID
router.get(
  '/:id',
  [
    param('id').isInt().withMessage('ID de materia debe ser un número entero')
  ],
  MateriaController.getMateriaById
);

// ===== RUTAS POR CURSO Y PROFESOR =====

// GET /api/materias/curso/:cursoId - Obtener materias por curso
router.get(
  '/curso/:cursoId',
  [
    param('cursoId').isInt().withMessage('ID de curso debe ser un número entero')
  ],
  MateriaController.getMateriasByCurso
);

// GET /api/materias/profesor/:profesorId - Obtener materias por profesor
router.get(
  '/profesor/:profesorId',
  [
    param('profesorId').isInt().withMessage('ID de profesor debe ser un número entero')
  ],
  MateriaController.getMateriasByProfesor
);

// ===== RUTAS PARA ADMINISTRADORES =====

// POST /api/materias - Crear nueva materia
router.post(
  '/',
  [
    authMiddleware.checkRole(['admin']),
    body('curso_idcurso').isInt().withMessage('ID de curso debe ser un número entero'),
    body('nomb_materia').notEmpty().withMessage('El nombre de la materia es requerido'),
    body('profesor_idprofesor').optional().isInt().withMessage('ID de profesor debe ser un número entero')
  ],
  MateriaController.createMateria
);

// PUT /api/materias/:id - Actualizar materia
router.put(
  '/:id',
  [
    authMiddleware.checkRole(['admin']),
    param('id').isInt().withMessage('ID de materia debe ser un número entero'),
    body('nomb_materia').optional().notEmpty().withMessage('El nombre de la materia no puede estar vacío')
  ],
  MateriaController.updateMateria
);

// DELETE /api/materias/:id - Eliminar materia
router.delete(
  '/:id',
  [
    authMiddleware.checkRole(['admin']),
    param('id').isInt().withMessage('ID de materia debe ser un número entero')
  ],
  MateriaController.deleteMateria
);

// ===== RUTAS PARA ASIGNACIÓN DE PROFESORES =====

// PUT /api/materias/:materiaId/profesor/:profesorId - Asignar profesor a materia
router.put(
  '/:materiaId/profesor/:profesorId',
  [
    authMiddleware.checkRole(['admin']),
    param('materiaId').isInt().withMessage('ID de materia debe ser un número entero'),
    param('profesorId').isInt().withMessage('ID de profesor debe ser un número entero')
  ],
  MateriaController.asignarProfesor
);

// DELETE /api/materias/:id/profesor - Desasignar profesor de materia
router.delete(
  '/:id/profesor',
  [
    authMiddleware.checkRole(['admin']),
    param('id').isInt().withMessage('ID de materia debe ser un número entero')
  ],
  MateriaController.desasignarProfesor
);

module.exports = router;