// routes/curso.routes.js
const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');
const CursoController = require('../controllers/curso.controller');
const authMiddleware = require('../middleware/auth.middleware');
const accessibilityMiddleware = require('../middleware/accessibility.middleware');

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware.verifyToken);

// Cargar configuración de accesibilidad
router.use(accessibilityMiddleware.loadAccessibilityConfig);

// Obtener todos los cursos
router.get('/', CursoController.getAllCursos);

// Buscar cursos por término
router.get('/buscar', 
  [
    query('termino').notEmpty().withMessage('El término de búsqueda es requerido')
  ],
  CursoController.searchCursos
);

// Obtener cursos por año
router.get('/año/:año', CursoController.getCursosByYear);

// Obtener curso por ID
router.get('/:id', CursoController.getCursoById);

// Verificar capacidad de un curso
router.get('/:id/capacidad', CursoController.checkCourseCapacity);

// Obtener estudiantes de un curso
router.get('/:id/estudiantes', CursoController.getStudentsByCourse);

// Obtener materias de un curso
router.get('/:id/materias', CursoController.getMateriasByCourse);

// Crear nuevo curso (solo administradores)
router.post('/',
  [
    authMiddleware.checkRole(['admin']),
    body('nomb_curso').notEmpty().withMessage('El nombre del curso es obligatorio'),
    body('año').isInt().withMessage('El año debe ser un número entero'),
    body('capacidad').isInt({ min: 1 }).withMessage('La capacidad debe ser un número entero mayor a cero')
  ],
  CursoController.createCurso
);

// Asignar estudiantes a curso (solo administradores)
router.post('/:id/estudiantes',
  [
    authMiddleware.checkRole(['admin']),
    body('estudiantes').isArray().withMessage('Debe proporcionar un array de IDs de estudiantes')
  ],
  CursoController.assignStudentsToCourse
);

// Actualizar curso (solo administradores)
router.put('/:id',
  [
    authMiddleware.checkRole(['admin'])
  ],
  CursoController.updateCurso
);

// Eliminar curso (solo administradores)
router.delete('/:id',
  [
    authMiddleware.checkRole(['admin'])
  ],
  CursoController.deleteCurso
);

module.exports = router;