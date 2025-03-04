const express = require('express');
const { check } = require('express-validator');
const multer = require('multer');
const path = require('path');
const EstudianteController = require('../controllers/estudiante.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const router = express.Router();

// Configuración de Multer para subida de archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/documentos');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `documento-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Límite 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido. Solo se permiten PDF, JPG, PNG, DOC y DOCX.'));
    }
  }
});

// Middlewares de validación
const validateEstudiante = [
  check('nomb_est', 'El nombre es obligatorio').not().isEmpty(),
  check('ape_est', 'El apellido es obligatorio').not().isEmpty(),
  check('ci_est', 'El número de documento es obligatorio').not().isEmpty(),
  check('Curso_idCurso', 'El curso es obligatorio').isNumeric()
];

// Rutas públicas (no requieren autenticación)
// Ninguna para estudiantes

// Rutas protegidas (requieren autenticación)
// Middleware de autenticación para todas las rutas siguientes
router.use(authMiddleware.verifyToken);

// Rutas para todos los usuarios autenticados
// GET /api/estudiantes/search - Buscar estudiantes
router.get('/search', authMiddleware.hasRole(['admin', 'profesor']), EstudianteController.searchEstudiantes);

// GET /api/estudiantes/curso/:cursoId - Obtener estudiantes por curso
router.get('/curso/:cursoId', authMiddleware.hasRole(['admin', 'profesor']), EstudianteController.getEstudiantesByCurso);

// Rutas que requieren rol específico
// GET /api/estudiantes - Obtener todos los estudiantes
router.get('/', authMiddleware.hasRole(['admin', 'profesor']), EstudianteController.getAllEstudiantes);

// GET /api/estudiantes/:id - Obtener estudiante por ID
router.get('/:id', authMiddleware.hasRole(['admin', 'profesor', 'estudiante', 'tutor']), 
  authMiddleware.checkEstudianteAccess, // Middleware que verifica si es el propio estudiante o tiene acceso
  EstudianteController.getEstudianteById
);

// POST /api/estudiantes - Crear nuevo estudiante
router.post('/', 
  authMiddleware.hasRole(['admin']), 
  validateEstudiante,
  EstudianteController.createEstudiante
);

// PUT /api/estudiantes/:id - Actualizar estudiante
router.put('/:id', 
  authMiddleware.hasRole(['admin']), 
  validateEstudiante,
  EstudianteController.updateEstudiante
);

// DELETE /api/estudiantes/:id - Eliminar estudiante
router.delete('/:id', 
  authMiddleware.hasRole(['admin']),
  EstudianteController.deleteEstudiante
);

// POST /api/estudiantes/:id/documentos - Subir documento
router.post('/:id/documentos',
  authMiddleware.hasRole(['admin', 'profesor', 'estudiante', 'tutor']),
  authMiddleware.checkEstudianteAccess,
  upload.single('documento'),
  [check('tipo_doc', 'El tipo de documento es obligatorio').not().isEmpty()],
  EstudianteController.uploadDocumento
);

// POST /api/estudiantes/:estudianteId/tutores/:tutorId - Agregar tutor a estudiante
router.post('/:estudianteId/tutores/:tutorId',
  authMiddleware.hasRole(['admin']),
  EstudianteController.addTutor
);

// DELETE /api/estudiantes/:estudianteId/tutores/:tutorId - Eliminar tutor de estudiante
router.delete('/:estudianteId/tutores/:tutorId',
  authMiddleware.hasRole(['admin']),
  EstudianteController.removeTutor
);

module.exports = router;