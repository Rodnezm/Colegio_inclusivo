// src/models/financiero.model.js
const { query } = require('../config/database');

/**
 * Modelo para gestionar las finanzas (cuotas y pagos)
 */
class FinancieroModel {
  /**
   * Obtiene el extracto financiero de un estudiante
   * @param {number} estudianteId - ID del estudiante
   * @returns {Promise<Object>} Datos financieros del estudiante
   */
  static async getExtractoFinanciero(estudianteId) {
    try {
      // Verificar si el estudiante existe
      const estudianteResult = await query(
        'SELECT * FROM Estudiante WHERE idEstudiante = $1',
        [estudianteId]
      );
      
      if (estudianteResult.rows.length === 0) {
        throw new Error('Estudiante no encontrado');
      }
      
      // Obtener información de becas
      const becasResult = await query(`
        SELECT * FROM Beca
        WHERE estudiante_idestudiante = $1 AND estado = 'activo'
        ORDER BY fech_inicio DESC
      `, [estudianteId]);
      
      // Obtener cuotas y pagos
      const cuotasResult = await query(`
        SELECT 
          c.*,
          json_agg(
            json_build_object(
              'idPago', p.idpago,
              'monto_pagado', p.monto_pagado,
              'fech_pago', p.fech_pago,
              'forma_pago', p.forma_pago,
              'comprobante_nro', p.comprobante_nro,
              'estado_pago', p.estado_pago
            ) ORDER BY p.fech_pago
          ) FILTER (WHERE p.idpago IS NOT NULL) as pagos,
          COALESCE(SUM(p.monto_pagado), 0) as total_pagado
        FROM Cuota c
        LEFT JOIN Pago p ON p.cuota_idcuota = c.idcuota
        WHERE c.estudiante_idestudiante = $1
        GROUP BY c.idcuota
        ORDER BY c.fech_vecimiento
      `, [estudianteId]);
      
      // Calcular resumen financiero
      let totalCuotas = 0;
      let totalPagado = 0;
      let saldoPendiente = 0;
      
      cuotasResult.rows.forEach(cuota => {
        totalCuotas += cuota.monto_final;
        totalPagado += parseInt(cuota.total_pagado);
      });
      
      saldoPendiente = totalCuotas - totalPagado;
      
      return {
        estudiante: estudianteResult.rows[0],
        becas: becasResult.rows,
        cuotas: cuotasResult.rows,
        resumen: {
          totalCuotas,
          totalPagado,
          saldoPendiente
        }
      };
    } catch (error) {
      throw new Error(`Error al obtener extracto financiero: ${error.message}`);
    }
  }
  
  /**
   * Registra un nuevo pago para una cuota
   * @param {Object} pago - Datos del pago
   * @returns {Promise<Object>} Pago registrado
   */
  static async registrarPago(pago) {
    try {
      const { 
        cuota_idcuota,
        tutor_idtutor,
        monto_pagado,
        forma_pago,
        comprobante_nro
      } = pago;
      
      // Verificar si la cuota existe
      const cuotaResult = await query(
        'SELECT * FROM Cuota WHERE idcuota = $1',
        [cuota_idcuota]
      );
      
      if (cuotaResult.rows.length === 0) {
        throw new Error('Cuota no encontrada');
      }
      
      // Verificar si el monto pagado no excede el saldo pendiente
      const pagosAnterioresResult = await query(
        'SELECT COALESCE(SUM(monto_pagado), 0) as total_pagado FROM Pago WHERE cuota_idcuota = $1',
        [cuota_idcuota]
      );
      
      const totalPagado = parseInt(pagosAnterioresResult.rows[0].total_pagado);
      const montoFinalCuota = cuotaResult.rows[0].monto_final;
      
      if (totalPagado + monto_pagado > montoFinalCuota) {
        throw new Error(`El monto pagado excede el saldo pendiente de la cuota. Saldo pendiente: ${montoFinalCuota - totalPagado}`);
      }
      
      // Comenzar transacción
      await query('BEGIN');
      
      try {
        // Insertar el pago
        const pagoResult = await query(`
          INSERT INTO Pago (
            cuota_idcuota,
            tutor_idtutor,
            fech_pago,
            monto_pagado,
            forma_pago,
            comprobante_nro,
            estado_pago,
            comprobante_impreso
          )
          VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5, 'completado', false)
          RETURNING *
        `, [
          cuota_idcuota,
          tutor_idtutor,
          monto_pagado,
          forma_pago,
          comprobante_nro
        ]);
        
        // Actualizar estado de la cuota si se pagó completamente
        const nuevoTotalPagado = totalPagado + monto_pagado;
        
        if (nuevoTotalPagado >= montoFinalCuota) {
          await query(
            'UPDATE Cuota SET estado_cuota = $1 WHERE idcuota = $2',
            ['pagado', cuota_idcuota]
          );
        } else if (nuevoTotalPagado > 0) {
          await query(
            'UPDATE Cuota SET estado_cuota = $1 WHERE idcuota = $2',
            ['parcial', cuota_idcuota]
          );
        }
        
        // Confirmar transacción
        await query('COMMIT');
        
        return pagoResult.rows[0];
      } catch (error) {
        // Revertir transacción en caso de error
        await query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      throw new Error(`Error al registrar pago: ${error.message}`);
    }
  }
  
  /**
   * Genera un comprobante de pago
   * @param {number} pagoId - ID del pago
   * @returns {Promise<Object>} Datos del comprobante
   */
  static async generarComprobante(pagoId) {
    try {
      // Verificar si el pago existe
      const pagoResult = await query(
        'SELECT * FROM Pago WHERE idpago = $1',
        [pagoId]
      );
      
      if (pagoResult.rows.length === 0) {
        throw new Error('Pago no encontrado');
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
        INNER JOIN Cuota c ON p.cuota_idcuota = c.idcuota
        INNER JOIN Estudiante e ON c.estudiante_idestudiante = e.idEstudiante
        LEFT JOIN Tutor t ON p.tutor_idtutor = t.idTutor
        WHERE p.idpago = $1
      `, [pagoId]);
      
      if (datosComprobanteResult.rows.length === 0) {
        throw new Error('No se encontraron datos para el comprobante');
      }
      
      // Marcar como impreso
      await query(
        'UPDATE Pago SET comprobante_impreso = true, fecha_impresion = CURRENT_TIMESTAMP WHERE idpago = $1',
        [pagoId]
      );
      
      return {
        ...datosComprobanteResult.rows[0],
        fecha_impresion: new Date()
      };
    } catch (error) {
      throw new Error(`Error al generar comprobante: ${error.message}`);
    }
  }
  
  /**
   * Crea una nueva cuota para un estudiante
   * @param {Object} cuota - Datos de la cuota
   * @returns {Promise<Object>} Cuota creada
   */
  static async crearCuota(cuota) {
    try {
      const { 
        estudiante_idestudiante,
        monto_base,
        descuento,
        fech_vecimiento,
        periodo
      } = cuota;
      
      // Verificar si el estudiante existe
      const estudianteResult = await query(
        'SELECT * FROM Estudiante WHERE idEstudiante = $1',
        [estudiante_idestudiante]
      );
      
      if (estudianteResult.rows.length === 0) {
        throw new Error('Estudiante no encontrado');
      }
      
      // Verificar si ya existe una cuota para ese periodo
      const cuotaExistenteResult = await query(
        'SELECT * FROM Cuota WHERE estudiante_idestudiante = $1 AND periodo = $2',
        [estudiante_idestudiante, periodo]
      );
      
      if (cuotaExistenteResult.rows.length > 0) {
        throw new Error('Ya existe una cuota para este periodo');
      }
      
      // Calcular monto final
      const montoFinal = monto_base - descuento;
      
      // Insertar la cuota
      const cuotaResult = await query(`
        INSERT INTO Cuota (
          estudiante_idestudiante,
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
        estudiante_idestudiante,
        monto_base,
        descuento,
        montoFinal,
        fech_vecimiento,
        'pendiente',
        periodo
      ]);
      
      return cuotaResult.rows[0];
    } catch (error) {
      throw new Error(`Error al crear cuota: ${error.message}`);
    }
  }
  
  /**
   * Obtiene todas las cuotas de un estudiante
   * @param {number} estudianteId - ID del estudiante
   * @returns {Promise<Array>} Lista de cuotas
   */
  static async getCuotasByEstudiante(estudianteId) {
    try {
      const result = await query(`
        SELECT c.*, 
          COALESCE(SUM(p.monto_pagado), 0) as total_pagado,
          c.monto_final - COALESCE(SUM(p.monto_pagado), 0) as saldo_pendiente
        FROM Cuota c
        LEFT JOIN Pago p ON p.cuota_idcuota = c.idcuota
        WHERE c.estudiante_idestudiante = $1
        GROUP BY c.idcuota
        ORDER BY c.fech_vecimiento
      `, [estudianteId]);
      
      return result.rows;
    } catch (error) {
      throw new Error(`Error al obtener cuotas: ${error.message}`);
    }
  }
  
  /**
   * Obtiene los pagos de una cuota
   * @param {number} cuotaId - ID de la cuota
   * @returns {Promise<Array>} Lista de pagos
   */
  static async getPagosByCuota(cuotaId) {
    try {
      const result = await query(`
        SELECT p.*, t.nomb_tut, t.ape_tut
        FROM Pago p
        LEFT JOIN Tutor t ON p.tutor_idtutor = t.idTutor
        WHERE p.cuota_idcuota = $1
        ORDER BY p.fech_pago DESC
      `, [cuotaId]);
      
      return result.rows;
    } catch (error) {
      throw new Error(`Error al obtener pagos: ${error.message}`);
    }
  }
  
  /**
   * Crea una nueva beca para un estudiante
   * @param {Object} beca - Datos de la beca
   * @returns {Promise<Object>} Beca creada
   */
  static async crearBeca(beca) {
    try {
      const {
        estudiante_idestudiante,
        tipo_beca,
        porcentaje,
        fech_inicio,
        fech_fin,
        motivo
      } = beca;
      
      // Verificar si el estudiante existe
      const estudianteResult = await query(
        'SELECT * FROM Estudiante WHERE idEstudiante = $1',
        [estudiante_idestudiante]
      );
      
      if (estudianteResult.rows.length === 0) {
        throw new Error('Estudiante no encontrado');
      }
      
      // Insertar la beca
      const becaResult = await query(`
        INSERT INTO Beca (
          estudiante_idestudiante,
          tipo_beca,
          porcentaje,
          fech_inicio,
          fech_fin,
          motivo,
          estado
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        estudiante_idestudiante,
        tipo_beca,
        porcentaje,
        fech_inicio,
        fech_fin,
        motivo,
        'activo'
      ]);
      
      return becaResult.rows[0];
    } catch (error) {
      throw new Error(`Error al crear beca: ${error.message}`);
    }
  }
  
  /**
   * Obtiene las becas de un estudiante
   * @param {number} estudianteId - ID del estudiante
   * @returns {Promise<Array>} Lista de becas
   */
  static async getBecasByEstudiante(estudianteId) {
    try {
      const result = await query(`
        SELECT *
        FROM Beca
        WHERE estudiante_idestudiante = $1
        ORDER BY fech_inicio DESC
      `, [estudianteId]);
      
      return result.rows;
    } catch (error) {
      throw new Error(`Error al obtener becas: ${error.message}`);
    }
  }
}

module.exports = FinancieroModel;