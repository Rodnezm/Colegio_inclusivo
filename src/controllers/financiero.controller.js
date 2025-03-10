// src/controllers/financiero.controller.js
const { query } = require('../config/database');
const { validationResult } = require('express-validator');

class FinancieroController {
  /**
   * Obtiene el extracto financiero de un estudiante
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async getExtractoFinanciero(req, res) {
    try {
      const { id } = req.params; // ID del estudiante
      
      // Verificar si el estudiante existe
      const estudianteResult = await query(
        'SELECT * FROM Estudiante WHERE idEstudiante = $1',
        [id]
      );
      
      if (estudianteResult.rows.length === 0) {
        return res.status(404).json({ message: 'Estudiante no encontrado' });
      }
      
      // Obtener información de becas
      const becasResult = await query(`
        SELECT * FROM Beca
        WHERE Estudiante_idEstudiante = $1 AND estado = 'activo'
        ORDER BY fech_inicio DESC
      `, [id]);
      
      // Obtener cuotas y pagos
      const cuotasResult = await query(`
        SELECT 
          c.*,
          json_agg(
            json_build_object(
              'idPago', p.idPago,
              'monto_pagado', p.monto_pagado,
              'fech_pago', p.fech_pago,
              'forma_pago', p.forma_pago,
              'comprobante_nro', p.comprobante_nro,
              'estado_pago', p.estado_pago
            ) ORDER BY p.fech_pago
          ) FILTER (WHERE p.idPago IS NOT NULL) as pagos,
          COALESCE(SUM(p.monto_pagado), 0) as total_pagado
        FROM Cuota c
        LEFT JOIN Pago p ON p.Cuota_idCuota = c.idCuota
        WHERE c.Estudiante_idEstudiante = $1
        GROUP BY c.idCuota
        ORDER BY c.fech_vecimiento
      `, [id]);
      
      // Calcular resumen financiero
      let totalCuotas = 0;
      let totalPagado = 0;
      let saldoPendiente = 0;
      
      cuotasResult.rows.forEach(cuota => {
        totalCuotas += cuota.monto_final;
        totalPagado += parseInt(cuota.total_pagado);
      });
      
      saldoPendiente = totalCuotas - totalPagado;
      
      return res.status(200).json({
        message: 'Extracto financiero obtenido correctamente',
        estudiante: estudianteResult.rows[0],
        becas: becasResult.rows,
        cuotas: cuotasResult.rows,
        resumen: {
          totalCuotas,
          totalPagado,
          saldoPendiente
        }
      });
    } catch (error) {
      console.error('Error al obtener extracto financiero:', error);
      return res.status(500).json({ 
        message: 'Error al obtener extracto financiero',
        error: error.message 
      });
    }
  }

  /**
   * Registra un nuevo pago para una cuota
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async registrarPago(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { 
        cuota_idCuota,
        tutor_idTutor,
        monto_pagado,
        forma_pago,
        comprobante_nro
      } = req.body;
      
      // Verificar si la cuota existe
      const cuotaResult = await query(
        'SELECT * FROM Cuota WHERE idCuota = $1',
        [cuota_idCuota]
      );
      
      if (cuotaResult.rows.length === 0) {
        return res.status(404).json({ message: 'Cuota no encontrada' });
      }
      
      // Verificar si el monto pagado no excede el saldo pendiente
      const pagosAnterioresResult = await query(
        'SELECT COALESCE(SUM(monto_pagado), 0) as total_pagado FROM Pago WHERE Cuota_idCuota = $1',
        [cuota_idCuota]
      );
      
      const totalPagado = parseInt(pagosAnterioresResult.rows[0].total_pagado);
      const montoFinalCuota = cuotaResult.rows[0].monto_final;
      
      if (totalPagado + monto_pagado > montoFinalCuota) {
        return res.status(400).json({ 
          message: 'El monto pagado excede el saldo pendiente de la cuota',
          saldoPendiente: montoFinalCuota - totalPagado
        });
      }
      
      // Insertar el pago
      const pagoResult = await query(`
        INSERT INTO Pago (
          Cuota_idCuota,
          Tutor_idTutor,
          fech_pago,
          monto_pagado,
          forma_pago,
          comprobante_nro,
          estado_pago
        )
        VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5, 'completado')
        RETURNING *
      `, [
        cuota_idCuota,
        tutor_idTutor,
        monto_pagado,
        forma_pago,
        comprobante_nro
      ]);
      
      // Actualizar estado de la cuota si se pagó completamente
      const nuevoTotalPagado = totalPagado + monto_pagado;
      
      if (nuevoTotalPagado >= montoFinalCuota) {
        await query(
          'UPDATE Cuota SET estado_cuota = $1 WHERE idCuota = $2',
          ['pagado', cuota_idCuota]
        );
      } else if (nuevoTotalPagado > 0) {
        await query(
          'UPDATE Cuota SET estado_cuota = $1 WHERE idCuota = $2',
          ['parcial', cuota_idCuota]
        );
      }
      
      return res.status(201).json({
        message: 'Pago registrado correctamente',
        pago: pagoResult.rows[0]
      });
    } catch (error) {
      console.error('Error al registrar pago:', error);
      return res.status(500).json({ 
        message: 'Error al registrar pago',
        error: error.message 
      });
    }
  }

  /**
   * Genera comprobante de pago (no es factura legal)
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async generarComprobante(req, res) {
    try {
      const { id } = req.params; // ID del pago
      
      // Verificar si el pago existe
      const pagoResult = await query(
        'SELECT * FROM Pago WHERE idPago = $1',
        [id]
      );
      
      if (pagoResult.rows.length === 0) {
        return res.status(404).json({ message: 'Pago no encontrado' });
      }
      
      // Obtener información relacionada para el comprobante
      const cuotaId = pagoResult.rows[0].cuota_idcuota;
      
      const datosComprobanteResult = await query(`
        SELECT 
          p.*,
          c.periodo,
          c.monto_base,
          c.descuento,
          c.monto_final,
          e.nomb_est,
          e.ape_est,
          e.ci_est,
          t.nomb_tut,
          t.ape_tut,
          t.ci_tu
        FROM Pago p
        INNER JOIN Cuota c ON p.Cuota_idCuota = c.idCuota
        INNER JOIN Estudiante e ON c.Estudiante_idEstudiante = e.idEstudiante
        LEFT JOIN Tutor t ON p.Tutor_idTutor = t.idTutor
        WHERE p.idPago = $1
      `, [id]);
      
      if (datosComprobanteResult.rows.length === 0) {
        return res.status(404).json({ message: 'No se encontraron datos para el comprobante' });
      }
      
      // Marcar como impreso
      await query(
        'UPDATE Pago SET comprobante_impreso = true, fecha_impresion = CURRENT_TIMESTAMP WHERE idPago = $1',
        [id]
      );
      
      return res.status(200).json({
        message: 'Comprobante generado correctamente',
        comprobante: {
          ...datosComprobanteResult.rows[0],
          fecha_impresion: new Date()
        }
      });
    } catch (error) {
      console.error('Error al generar comprobante:', error);
      return res.status(500).json({ 
        message: 'Error al generar comprobante',
        error: error.message 
      });
    }
  }

  /**
   * Crea una nueva cuota para un estudiante
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async crearCuota(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { 
        estudiante_idEstudiante,
        monto_base,
        descuento,
        fech_vecimiento,
        periodo
      } = req.body;
      
      // Verificar si el estudiante existe
      const estudianteResult = await query(
        'SELECT * FROM Estudiante WHERE idEstudiante = $1',
        [estudiante_idEstudiante]
      );
      
      if (estudianteResult.rows.length === 0) {
        return res.status(404).json({ message: 'Estudiante no encontrado' });
      }
      
      // Verificar si ya existe una cuota para ese periodo
      const cuotaExistenteResult = await query(
        'SELECT * FROM Cuota WHERE Estudiante_idEstudiante = $1 AND periodo = $2',
        [estudiante_idEstudiante, periodo]
      );
      
      if (cuotaExistenteResult.rows.length > 0) {
        return res.status(400).json({ 
          message: 'Ya existe una cuota para este periodo',
          cuota: cuotaExistenteResult.rows[0]
        });
      }
      
      // Calcular monto final
      const montoFinal = monto_base - descuento;
      
      // Insertar la cuota
      const cuotaResult = await query(`
        INSERT INTO Cuota (
          Estudiante_idEstudiante,
          monto_base,
          descuento,
          monto_final,
          fech_vecimiento,
          estado_cuota,
          periodo
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        estudiante_idEstudiante,
        monto_base,
        descuento,
        montoFinal,
        fech_vecimiento,
        'pendiente',
        periodo
      ]);
      
      return res.status(201).json({
        message: 'Cuota creada correctamente',
        cuota: cuotaResult.rows[0]
      });
    } catch (error) {
      console.error('Error al crear cuota:', error);
      return res.status(500).json({ 
        message: 'Error al crear cuota',
        error: error.message 
      });
    }
  }
}

module.exports = FinancieroController;