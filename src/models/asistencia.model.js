// src/models/asistencia.model.js
const { query } = require('../config/database');

/**
 * Modelo para gestionar las asistencias
 */
class AsistenciaModel {
  /**
   * Obtiene todas las asistencias de un estudiante
   * @param {number} estudianteId - ID del estudiante
   * @returns {Promise<Array>} Lista de asistencias
   */
  static async getByEstudiante(estudianteId) {
    try {
      const result = await query(`
        SELECT 
          m.idMateria,
          m.nomb_materia,
          COUNT(*) as total_clases,
          SUM(CASE WHEN a.estado_asist = 'presente' THEN 1 ELSE 0 END) as presentes,
          SUM(CASE WHEN a.estado_asist = 'ausente' THEN 1 ELSE 0 END) as ausentes,
          SUM(CASE WHEN a.estado_asist = 'justificado' THEN 1 ELSE 0 END) as justificados,
          ROUND((SUM(CASE WHEN a.estado_asist = 'presente' OR a.estado_asist = 'justificado' THEN 1 ELSE 0 END)::numeric / COUNT(*)::numeric) * 100, 2) as porcentaje_asistencia,
          json_agg(
            json_build_object(
              'idAsistencia', a.idasistencia,
              'fecha_asist', a.fecha_asist,
              'estado_asist', a.estado_asist,
              'justificacion_asist', a.justificacion_asist
            ) ORDER BY a.fecha_asist DESC
          ) as detalle
        FROM Asistencia a
        INNER JOIN Materia m ON a.materia_idmateria = m.idMateria
        WHERE a.estudiante_idestudiante = $1
        GROUP BY m.idMateria, m.nomb_materia
        ORDER BY m.nomb_materia
      `, [estudianteId]);
      
      return result.rows;
    } catch (error) {
      throw new Error(`Error al obtener asistencias: ${error.message}`);
    }
  }
  
  /**
   * Obtiene un registro de asistencia específico
   * @param {number} id - ID de la asistencia
   * @returns {Promise<Object>} Datos de la asistencia
   */
  static async getById(id) {
    try {
      const result = await query(`
        SELECT a.*, m.nomb_materia, e.nomb_est, e.ape_est
        FROM Asistencia a
        INNER JOIN Materia m ON a.materia_idmateria = m.idMateria
        INNER JOIN Estudiante e ON a.estudiante_idestudiante = e.idEstudiante
        WHERE a.idasistencia = $1
      `, [id]);
      
      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Error al obtener asistencia: ${error.message}`);
    }
  }
  
  /**
   * Obtiene lista de asistencia para una materia y fecha específica
   * @param {number} materiaId - ID de la materia
   * @param {string} fecha - Fecha en formato 'YYYY-MM-DD'
   * @returns {Promise<Object>} Datos de la lista de asistencia
   */
  static async getByMateriaAndFecha(materiaId, fecha) {
    try {
      // Obtener información de la materia
      const materiaResult = await query(`
        SELECT m.*, c.nomb_curso, p.nomb_prof, p.ape_prof 
        FROM Materia m
        LEFT JOIN Curso c ON m.curso_idcurso = c.idCurso
        LEFT JOIN Profesor p ON m.profesor_idprofesor = p.idProfesor
        WHERE m.idMateria = $1
      `, [materiaId]);
      
      if (materiaResult.rows.length === 0) {
        throw new Error('Materia no encontrada');
      }
      
      const materia = materiaResult.rows[0];
      
      // Obtener estudiantes del curso
      const estudiantesResult = await query(`
        SELECT e.idEstudiante, e.nomb_est, e.ape_est, e.ci_est
        FROM Estudiante e
        WHERE e.curso_idcurso = $1 AND e.estado_est = 'activo'
        ORDER BY e.ape_est, e.nomb_est
      `, [materia.curso_idcurso]);
      
      // Obtener asistencias registradas para esa fecha y materia
      const asistenciasResult = await query(`
        SELECT a.*
        FROM Asistencia a
        WHERE a.materia_idmateria = $1 AND a.fecha_asist = $2
      `, [materiaId, fecha]);
      
      // Crear lista combinada
      const listaAsistencia = estudiantesResult.rows.map(estudiante => {
        const asistenciaRegistrada = asistenciasResult.rows.find(
          a => a.estudiante_idestudiante === estudiante.idestudiante
        );
        
        return {
          estudiante,
          asistencia: asistenciaRegistrada || {
            estado_asist: null,
            justificacion_asist: null
          }
        };
      });
      
      return {
        materia,
        fecha,
        tieneRegistros: asistenciasResult.rows.length > 0,
        listaAsistencia
      };
    } catch (error) {
      throw new Error(`Error al obtener lista de asistencia: ${error.message}`);
    }
  }
  
  /**
   * Registra o actualiza asistencias para una materia en una fecha
   * @param {number} materiaId - ID de la materia
   * @param {string} fecha - Fecha en formato 'YYYY-MM-DD'
   * @param {Array} asistencias - Array de objetos con datos de asistencia
   * @returns {Promise<number>} Número de registros insertados
   */
  static async registrarAsistencia(materiaId, fecha, asistencias) {
    try {
      // Comenzar transacción
      await query('BEGIN');
      
      try {
        // Eliminar registros existentes para esta fecha y materia
        await query(
          'DELETE FROM Asistencia WHERE materia_idmateria = $1 AND fecha_asist = $2',
          [materiaId, fecha]
        );
        
        // Insertar cada registro de asistencia
        for (const asistencia of asistencias) {
          await query(`
            INSERT INTO Asistencia (
              materia_idmateria,
              estudiante_idestudiante,
              fecha_asist,
              estado_asist,
              justificacion_asist
            )
            VALUES ($1, $2, $3, $4, $5)
          `, [
            materiaId,
            asistencia.estudiante_idestudiante,
            fecha,
            asistencia.estado_asist,
            asistencia.justificacion_asist || null
          ]);
        }
        
        // Confirmar transacción
        await query('COMMIT');
        
        return asistencias.length;
      } catch (error) {
        // Revertir transacción en caso de error
        await query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      throw new Error(`Error al registrar asistencia: ${error.message}`);
    }
  }
  
  /**
   * Justifica una ausencia
   * @param {number} id - ID de la asistencia
   * @param {string} justificacion - Texto de justificación
   * @returns {Promise<boolean>} True si se actualizó correctamente
   */
  static async justificarAusencia(id, justificacion) {
    try {
      const result = await query(`
        UPDATE Asistencia
        SET estado_asist = 'justificado', 
            justificacion_asist = $1
        WHERE idasistencia = $2
        RETURNING *
      `, [justificacion, id]);
      
      return result.rows.length > 0;
    } catch (error) {
      throw new Error(`Error al justificar ausencia: ${error.message}`);
    }
  }
  
  /**
   * Obtiene un reporte de asistencia por materia para todos los estudiantes
   * @param {number} materiaId - ID de la materia
   * @returns {Promise<Object>} Reporte de asistencia
   */
  static async getReportePorMateria(materiaId) {
    try {
      // Obtener información de la materia
      const materiaResult = await query(`
        SELECT m.*, c.nomb_curso 
        FROM Materia m
        INNER JOIN Curso c ON m.curso_idcurso = c.idCurso
        WHERE m.idMateria = $1
      `, [materiaId]);
      
      if (materiaResult.rows.length === 0) {
        throw new Error('Materia no encontrada');
      }
      
      const materia = materiaResult.rows[0];
      
      // Obtener fechas de asistencia para esta materia
      const fechasResult = await query(`
        SELECT DISTINCT fecha_asist
        FROM Asistencia
        WHERE materia_idmateria = $1
        ORDER BY fecha_asist
      `, [materiaId]);
      
      const fechas = fechasResult.rows.map(f => f.fecha_asist);
      
      // Obtener estudiantes del curso
      const estudiantesResult = await query(`
        SELECT e.idEstudiante, e.nomb_est, e.ape_est
        FROM Estudiante e
        WHERE e.curso_idcurso = $1 AND e.estado_est = 'activo'
        ORDER BY e.ape_est, e.nomb_est
      `, [materia.curso_idcurso]);
      
      // Para cada estudiante, obtener su registro de asistencia
      const reporteEstudiantes = [];
      
      for (const estudiante of estudiantesResult.rows) {
        const asistenciasResult = await query(`
          SELECT 
            a.fecha_asist,
            a.estado_asist
          FROM Asistencia a
          WHERE a.materia_idmateria = $1 AND a.estudiante_idestudiante = $2
          ORDER BY a.fecha_asist
        `, [materiaId, estudiante.idestudiante]);
        
        // Calcular estadísticas
        const totalClases = fechas.length;
        const presentes = asistenciasResult.rows.filter(a => a.estado_asist === 'presente').length;
        const ausentes = asistenciasResult.rows.filter(a => a.estado_asist === 'ausente').length;
        const justificados = asistenciasResult.rows.filter(a => a.estado_asist === 'justificado').length;
        const porcentaje = totalClases > 0 
          ? ((presentes + justificados) / totalClases) * 100 
          : 0;
        
        reporteEstudiantes.push({
          estudiante,
          asistencias: asistenciasResult.rows,
          estadisticas: {
            presentes,
            ausentes,
            justificados,
            totalClases,
            porcentajeAsistencia: Math.round(porcentaje * 100) / 100
          }
        });
      }
      
      return {
        materia,
        fechas,
        estudiantes: reporteEstudiantes
      };
    } catch (error) {
      throw new Error(`Error al obtener reporte de asistencia: ${error.message}`);
    }
  }
  
  /**
   * Verifica si un profesor está asignado a una materia
   * @param {number} profesorId - ID del profesor
   * @param {number} materiaId - ID de la materia
   * @returns {Promise<boolean>} True si está asignado
   */
  static async isProfesorAsignado(profesorId, materiaId) {
    try {
      const result = await query(`
        SELECT 1
        FROM Materia
        WHERE idMateria = $1 AND profesor_idprofesor = $2
      `, [materiaId, profesorId]);
      
      return result.rows.length > 0;
    } catch (error) {
      throw new Error(`Error al verificar asignación de profesor: ${error.message}`);
    }
  }
}

module.exports = AsistenciaModel;