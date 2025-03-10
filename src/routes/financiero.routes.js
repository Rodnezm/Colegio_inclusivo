// src/routes/financiero.routes.js
const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const FinancieroController = require('../controllers/financiero.controller');
const authMiddleware = require('../middleware/auth.middleware');
const accessibilityMiddleware = require('../middleware/accessibility.middleware');

// Aplicar middleware de autenticación a todas las rutas
router.use(authMiddleware.verifyToken);

// Cargar configuración de accesibilidad
router.use(accessibilityMiddleware.loadAccessibilityConfig);

// ===== RUTAS PARA EXTRACTO FINANCIERO =====

// GET /api/financiero/extracto/:id - Obtener extracto financiero de un estudiante
router.get(
  '/extracto/:id',
  [
    param('id').isInt().withMessage('ID de estudiante debe ser un número entero')
  ],
  // Solo el propio estudiante, sus tutores o administradores pueden ver su extracto
  authMiddleware.checkOwnership('estudiante'),
  FinancieroController.getExtractoFinanciero
);

// ===== RUTAS PARA GESTIÓN DE PAGOS =====

// POST /api/financiero/pagos - Registrar un nuevo pago
router.post(
  '/pagos',
  [
    authMiddleware.checkRole(['admin']), // Solo administradores pueden registrar pagos
    body('cuota_idCuota').isInt().withMessage('ID de cuota debe ser un número entero'),
    body('tutor_idTutor').optional().isInt().withMessage('ID de tutor debe ser un número entero'),
    body('monto_pagado').isInt({ min: 1 }).withMessage('Monto pagado debe ser un número positivo'),
    body('forma_pago').isIn(['efectivo', 'transferencia', 'cheque', 'tarjeta']).withMessage('Forma de pago no válida'),
    body('comprobante_nro').optional().isString().withMessage('Número de comprobante debe ser texto')
  ],
  FinancieroController.registrarPago
);

// GET /api/financiero/pagos/:id/comprobante - Generar comprobante de pago
router.get(
  '/pagos/:id/comprobante',
  [
    authMiddleware.checkRole(['admin']), // Solo administradores pueden generar comprobantes
    param('id').isInt().withMessage('ID de pago debe ser un número entero')
  ],
  FinancieroController.generarComprobante
);

// ===== RUTAS PARA GESTIÓN DE CUOTAS =====

// POST /api/financiero/cuotas - Crear una nueva cuota
router.post(
  '/cuotas',
  [
    authMiddleware.checkRole(['admin']), // Solo administradores pueden crear cuotas
    body('estudiante_idEstudiante').isInt().withMessage('ID de estudiante debe ser un número entero'),
    body('monto_base').isInt({ min: 0 }).withMessage('Monto base debe ser un número no negativo'),
    body('descuento').isInt({ min: 0 }).withMessage('Descuento debe ser un número no negativo'),
    body('fech_vecimiento').isDate().withMessage('Fecha de vencimiento debe tener formato YYYY-MM-DD'),
    body('periodo').isString().withMessage('Periodo debe ser texto (ej: "2025-03")')
  ],
  FinancieroController.crearCuota
);

module.exports = router;