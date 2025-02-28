const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const userController = require('../controllers/user.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Middleware para verificar token en todas las rutas
router.use(authMiddleware.verifyToken);

// ===== RUTAS PARA ESTUDIANTES =====

// Obtener todos los estudiantes (solo para admin y profesores)
router.get(
  '/estudiantes',
  authMiddleware.checkRole(['admin', 'profesor']),
  userController.getAllEstudiantes
);

// Obtener estudiante por ID
router.get(
  '/estudiantes/:id',
  userController.getEstudianteById
);

// Crear nuevo estudiante (solo para admin)
router.post(
  '/estudiantes',
  authMiddleware.checkRole(['admin']),
  [
    body('nomb_est').notEmpty().withMessage('El nombre es requerido'),
    body('ape_est').notEmpty().withMessage('El apellido es requerido'),
    body('ci_est').notEmpty().withMessage('La cédula es requerida'),
    body('Curso_idCurso').isInt().withMessage('El ID del curso debe ser un número entero')
  ],
  userController.createEstudiante
);

// Actualizar estudiante
router.put(
  '/estudiantes/:id',
  authMiddleware.checkRole(['admin']),
  userController.updateEstudiante
);

// Eliminar estudiante (solo para admin)
router.delete(
  '/estudiantes/:id',
  authMiddleware.checkRole(['admin']),
  userController.deleteEstudiante
);

// ===== RUTAS PARA PROFESORES =====

// Obtener todos los profesores
router.get(
  '/profesores',
  userController.getAllProfesores
);

// Obtener profesor por ID
router.get(
  '/profesores/:id',
  userController.getProfesorById
);

// Crear nuevo profesor (solo para admin)
router.post(
  '/profesores',
  authMiddleware.checkRole(['admin']),
  [
    body('nomb_prof').notEmpty().withMessage('El nombre es requerido'),
    body('ape_prof').notEmpty().withMessage('El apellido es requerido'),
    body('ci_prof').notEmpty().withMessage('La cédula es requerida'),
    body('email').isEmail().withMessage('El email debe ser válido')
  ],
  userController.createProfesor
);

// Actualizar profesor
router.put(
  '/profesores/:id',
  authMiddleware.checkRole(['admin']),
  userController.updateProfesor
);

// Eliminar profesor (solo para admin)
router.delete(
  '/profesores/:id',
  authMiddleware.checkRole(['admin']),
  userController.deleteProfesor
);

// ===== RUTAS PARA TUTORES =====

// Obtener todos los tutores
router.get(
  '/tutores',
  authMiddleware.checkRole(['admin', 'profesor']),
  userController.getAllTutores
);

// Obtener tutor por ID
router.get(
  '/tutores/:id',
  userController.getTutorById
);

// Crear nuevo tutor
router.post(
  '/tutores',
  [
    body('nomb_tut').notEmpty().withMessage('El nombre es requerido'),
    body('ape_tut').notEmpty().withMessage('El apellido es requerido'),
    body('ci_tu').notEmpty().withMessage('La cédula es requerida')
  ],
  userController.createTutor
);

// Actualizar tutor
router.put(
  '/tutores/:id',
  userController.updateTutor
);

// Eliminar tutor (solo para admin)
router.delete(
  '/tutores/:id',
  authMiddleware.checkRole(['admin']),
  userController.deleteTutor
);

// Asociar tutor a estudiante
router.post(
  '/tutores/:tutorId/estudiantes/:estudianteId',
  [
    body('parentesco').notEmpty().withMessage('El parentesco es requerido')
  ],
  userController.associateTutorWithEstudiante
);

// Desasociar tutor de estudiante
router.delete(
  '/tutores/:tutorId/estudiantes/:estudianteId',
  userController.dissociateTutorFromEstudiante
);

module.exports = router;