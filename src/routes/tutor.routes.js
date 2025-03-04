
const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');
const TutorController = require('../controllers/tutor.controller');
const authMiddleware = require('../middleware/auth.middleware');
const accessibilityMiddleware = require('../middleware/accessibility.middleware');

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware.verifyToken);

// Aplicar middleware de accesibilidad
router.use(accessibilityMiddleware.loadAccessibilityConfig);

// ===== RUTAS PARA TUTORES =====

// Obtener todos los tutores
router.get(
  '/',
  authMiddleware.checkRole(['admin', 'profesor']),
  TutorController.getAllTutores
);

// Buscar tutores por término
router.get(
  '/buscar',
  authMiddleware.checkRole(['admin', 'profesor']),
  [
    query('termino').notEmpty().withMessage('El término de búsqueda es requerido')
  ],
  TutorController.searchTutores
);

// Obtener un tutor por ID
router.get(
  '/:id',
  TutorController.getTutorById
);

// Obtener estudiantes de un tutor
router.get(
  '/:id/estudiantes',
  TutorController.getEstudiantesByTutor
);

// Crear un nuevo tutor (sin usuario asociado)
router.post(
  '/',
  [
    body('nomb_tut').notEmpty().withMessage('El nombre es requerido'),
    body('ape_tut').notEmpty().withMessage('El apellido es requerido'),
    body('ci_tu').notEmpty().withMessage('La cédula es requerida')
  ],
  TutorController.createTutor
);

// Crear un nuevo tutor con usuario asociado
router.post(
  '/with-user',
  [
    body('nomb_tut').notEmpty().withMessage('El nombre es requerido'),
    body('ape_tut').notEmpty().withMessage('El apellido es requerido'),
    body('ci_tu').notEmpty().withMessage('La cédula es requerida'),
    body('nomb_user').notEmpty().withMessage('El nombre de usuario es requerido'),
    body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres')
  ],
  TutorController.createTutorWithUser
);

// Asociar tutor a estudiante
router.post(
  '/:tutorId/estudiantes/:estudianteId',
  [
    body('parentesco').optional()
  ],
  TutorController.associateTutorWithEstudiante
);

// Actualizar un tutor
router.put(
  '/:id',
  TutorController.updateTutor
);

// Desasociar tutor de estudiante
router.delete(
  '/:tutorId/estudiantes/:estudianteId',
  TutorController.dissociateTutorFromEstudiante
);

// Eliminar un tutor
router.delete(
  '/:id',
  authMiddleware.checkRole(['admin']),
  TutorController.deleteTutor
);

module.exports = router;





