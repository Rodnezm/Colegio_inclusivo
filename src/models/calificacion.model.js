// src/models/calificacion.model.js
const { query } = require('../config/database');

/**
 * Modelo para gestionar las calificaciones
 */
class CalificacionModel {
  /**
   * Obtiene todas las calificaciones de un estudiante
   * @param {number} estudianteId - ID del estudiante
   * @returns {Promise<Array>} Lista de calificaciones
   */
  static async getByEstudiante(estudianteId) {
    try {
      const result = await query(`
        SELECT c.*, m.nomb_materia, m.descripcion_materia, p.nomb_prof, p.ape_prof  
        FROM Calificacion c
        INNER JOIN Materia m ON c.materia_idmateria = m.idMateria
        LEFT JOIN Profesor p ON m.profesor_idprofesor = p.idProfesor
        WHERE c.estudiante_idestudiante = $1
        ORDER BY c.fecha_calif DESC
      `, [estudianteId]);
      
      return result.rows;
    } catch (error) {
      throw new Error(`Error al obtener calificaciones: ${error.message}`);
    }
  }
  
  /**
   * Obtiene todas las calificaciones de una materia
   * @param {number} materiaId - ID de la materia
   * @returns {Promise<Array>} Lista de calificaciones
   */
  static async getByMateria(materiaId) {
    try {
      const result = await query(`
        SELECT c.*, e.nomb_est, e.ape_est, e.ci_est
        FROM Calificacion c
        INNER JOIN Estudiante e ON c.estudiante_idestudiante = e.idEstudiante
        WHERE c.materia_idmateria = $1
        ORDER BY e.ape_est, e.nomb_est, c.fecha_calif DESC
      `, [materiaId]);
      
      return result.rows;
    } catch (error) {
      throw new Error(`Error al obtener calificaciones por materia: ${error.message}`);
    }
  }
  
  /**
   * Obtiene una calificación por su ID
   * @param {number} id - ID de la calificación
   * @returns {Promise<Object>} Datos de la calificación
   */
  static async getById(id) {
    try {
      const result = await query(`
        SELECT c.*, m.nomb_materia, e.nomb_est, e.ape_est
        FROM Calificacion c
        INNER JOIN Materia m ON c.materia_idmateria = m.idMateria
        INNER JOIN Estudiante e ON c.estudiante_idestudiante = e.idEstudiante
        WHERE c.idCalificacion = $1
      `, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error al obtener calificación: ${error.message}`);
    }
  }
  
  /**
   * Crea una nueva calificación
   * @param {Object} calificacion - Datos de la calificación
   * @returns {Promise<Object>} Calificación creada
   */
  static async create(calificacion) {
    try {
      const { 
        materia_idmateria, 
        estudiante_idestudiante, 
        valor_calif, 
        tipo_calif 
      } = calificacion;
      
      const result = await query(`
        INSERT INTO Calificacion (
          materia_idmateria, 
          estudiante_idestudiante, 
          valor_calif, 
          fecha_calif, 
          tipo_calif
        )
        VALUES ($1, $2, $3, CURRENT_DATE, $4)
        RETURNING *
      `, [
        materia_idmateria,
        estudiante_idestudiante,
        valor_calif,
        tipo_calif
      ]);
      
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error al crear calificación: ${error.message}`);
    }
  }
  
  /**
   * Actualiza una calificación existente
   * @param {number} id - ID de la calificación
   * @param {Object} data - Datos a actualizar
   * @returns {Promise<Object>} Calificación actualizada
   */
  static async update(id, data) {
    try {
      const fieldsToUpdate = Object.keys(data)
        .filter(key => data[key] !== undefined)
        .map((key, index) => `${key} = $${index + 2}`)
        .join(', ');
      
      const values = Object.keys(data)
        .filter(key => data[key] !== undefined)
        .map(key => data[key]);
      
      if (values.length === 0) {
        return null;
      }
      
      const result = await query(
        `UPDATE Calificacion SET ${fieldsToUpdate} WHERE idCalificacion = $1 RETURNING *`,
        [id, ...values]
      );
      
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error al actualizar calificación: ${error.message}`);
    }
  }
  
  /**
   * Elimina una calificación
   * @param {number} id - ID de la calificación
   * @returns {Promise<boolean>} True si se eliminó correctamente
   */
  static async delete(id) {
    try {
      const result = await query('DELETE FROM Calificacion WHERE idCalificacion = $1', [id]);
      return result.rowCount > 0;
    } catch (error) {
      throw new Error(`Error al eliminar calificación: ${error.message}`);
    }
  }
  
  /**
   * Obtiene el promedio de calificaciones por estudiante y materia
   * @param {number} estudianteId - ID del estudiante
   * @param {number} materiaId - ID de la materia
   * @returns {Promise<Object>} Promedio de calificaciones
   */
  static async getPromedio(estudianteId, materiaId) {
    try {
      const result = await query(`
        SELECT 
          ROUND(AVG(valor_calif)::numeric, 2) as promedio,
          COUNT(*) as total_calificaciones,
          MIN(valor_calif) as minima,
          MAX(valor_calif) as maxima
        FROM Calificacion
        WHERE estudiante_idestudiante = $1 AND materia_idmateria = $2
      `, [estudianteId, materiaId]);
      
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error al obtener promedio de calificaciones: ${error.message}`);
    }
  }
  
  /**
   * Obtiene un reporte completo de calificaciones por materia
   * @param {number} materiaId - ID de la materia
   * @returns {Promise<Object>} Reporte de calificaciones
   */
  static async getReporteMateria(materiaId) {
    try {
      // Obtener información sobre la materia
      const materiaResult = await query(`
        SELECT m.*, c.nomb_curso, p.nomb_prof, p.ape_prof
        FROM Materia m
        INNER JOIN Curso c ON m.curso_idcurso = c.idCurso
        LEFT JOIN Profesor p ON m.profesor_idprofesor = p.idProfesor
        WHERE m.idMateria = $1
      `, [materiaId]);
      
      if (materiaResult.rows.length === 0) {
        throw new Error('Materia no encontrada');
      }
      
      // Obtener todos los estudiantes del curso
      const estudiantesResult = await query(`
        SELECT e.*
        FROM Estudiante e
        WHERE e.curso_idcurso = $1 AND e.estado_est = 'activo'
        ORDER BY e.ape_est, e.nomb_est
      `, [materiaResult.rows[0].curso_idcurso]);
      
      // Para cada estudiante, obtener sus calificaciones en esta materia
      const estudiantesCalificaciones = await Promise.all(estudiantesResult.rows.map(async (estudiante) => {
        const calificacionesResult = await query(`
          SELECT *
          FROM Calificacion
          WHERE estudiante_idestudiante = $1 AND materia_idmateria = $2
          ORDER BY fecha_calif, tipo_calif
        `, [estudiante.idestudiante, materiaId]);
        
        // Calcular promedio
        const promedioResult = await query(`
          SELECT ROUND(AVG(valor_calif)::numeric, 2) as promedio
          FROM Calificacion
          WHERE estudiante_idestudiante = $1 AND materia_idmateria = $2
        `, [estudiante.idestudiante, materiaId]);
        
        return {
          estudiante,
          calificaciones: calificacionesResult.rows,
          promedio: promedioResult.rows[0]?.promedio || 0
        };
      }));
      
      // Calcular estadísticas generales
      const estadisticasResult = await query(`
        SELECT 
          ROUND(AVG(valor_calif)::numeric, 2) as promedio_general,
          MIN(valor_calif) as minima,
          MAX(valor_calif) as maxima,
          COUNT(*) as total_calificaciones
        FROM Calificacion
        WHERE materia_idmateria = $1
      `, [materiaId]);
      
      return {
        materia: materiaResult.rows[0],
        estudiantes: estudiantesCalificaciones,
        estadisticas: estadisticasResult.rows[0]
      };
    } catch (error) {
      throw new Error(`Error al obtener reporte de calificaciones: ${error.message}`);
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
        FROM Materia m
        INNER JOIN Profesor p ON m.profesor_idprofesor = p.idProfesor
        WHERE m.idMateria = $1 AND p.idProfesor = $2
      `, [materiaId, profesorId]);
      
      return result.rows.length > 0;
    } catch (error) {
      throw new Error(`Error al verificar asignación de profesor: ${error.message}`);
    }
  }
}

module.exports = CalificacionModel;