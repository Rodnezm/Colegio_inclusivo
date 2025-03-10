// src/models/materia.model.js
const { query } = require('../config/database');

/**
 * Modelo para gestionar las materias
 */
class MateriaModel {
  /**
   * Obtiene todas las materias
   * @returns {Promise<Array>} Lista de materias
   */
  static async getAll() {
    try {
      const result = await query(`
        SELECT m.*, c.nomb_curso, p.nomb_prof, p.ape_prof 
        FROM Materia m
        INNER JOIN Curso c ON m.curso_idcurso = c.idCurso
        LEFT JOIN Profesor p ON m.profesor_idprofesor = p.idProfesor
        ORDER BY c.nomb_curso, m.nomb_materia
      `);
      
      return result.rows;
    } catch (error) {
      throw new Error(`Error al obtener materias: ${error.message}`);
    }
  }
  
  /**
   * Obtiene una materia por su ID
   * @param {number} id - ID de la materia
   * @returns {Promise<Object>} Datos de la materia
   */
  static async getById(id) {
    try {
      const result = await query(`
        SELECT m.*, c.nomb_curso, p.nomb_prof, p.ape_prof 
        FROM Materia m
        INNER JOIN Curso c ON m.curso_idcurso = c.idCurso
        LEFT JOIN Profesor p ON m.profesor_idprofesor = p.idProfesor
        WHERE m.idMateria = $1
      `, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const materia = result.rows[0];
      
      // Obtener recursos educativos relacionados con esta materia
      const recursosResult = await query(`
        SELECT * FROM Recurso_educativo
        WHERE materia_idmateria = $1
        ORDER BY fecha_publicacion DESC
      `, [id]);
      
      // Obtener tareas asignadas para esta materia
      const tareasResult = await query(`
        SELECT * FROM Tarea
        WHERE materia_idmateria = $1
        ORDER BY fecha_asignacion DESC
      `, [id]);
      
      return {
        ...materia,
        recursos: recursosResult.rows,
        tareas: tareasResult.rows
      };
    } catch (error) {
      throw new Error(`Error al obtener materia: ${error.message}`);
    }
  }
  
  /**
   * Crea una nueva materia
   * @param {Object} materia - Datos de la materia
   * @returns {Promise<Object>} Materia creada
   */
  static async create(materia) {
    try {
      const { 
        curso_idcurso,
        profesor_idprofesor,
        nomb_materia,
        descripcion_materia
      } = materia;
      
      const result = await query(`
        INSERT INTO Materia (
          curso_idcurso,
          profesor_idprofesor,
          nomb_materia,
          descripcion_materia
        )
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [
        curso_idcurso,
        profesor_idprofesor || null,
        nomb_materia,
        descripcion_materia || null
      ]);
      
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error al crear materia: ${error.message}`);
    }
  }
  
  /**
   * Actualiza una materia existente
   * @param {number} id - ID de la materia
   * @param {Object} data - Datos a actualizar
   * @returns {Promise<Object>} Materia actualizada
   */
  static async update(id, data) {
    try {
      const { 
        curso_idcurso,
        profesor_idprofesor,
        nomb_materia,
        descripcion_materia
      } = data;
      
      const result = await query(`
        UPDATE Materia SET
          curso_idcurso = COALESCE($1, curso_idcurso),
          profesor_idprofesor = $2,
          nomb_materia = COALESCE($3, nomb_materia),
          descripcion_materia = COALESCE($4, descripcion_materia)
        WHERE idMateria = $5
        RETURNING *
      `, [
        curso_idcurso,
        profesor_idprofesor, // Puede ser null para desasignar profesor
        nomb_materia,
        descripcion_materia,
        id
      ]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error al actualizar materia: ${error.message}`);
    }
  }
  
  /**
   * Elimina una materia
   * @param {number} id - ID de la materia
   * @returns {Promise<boolean>} True si se eliminó correctamente
   */
  static async delete(id) {
    try {
      // Verificar dependencias
      const dependenciasResult = await query(`
        SELECT 
          (SELECT COUNT(*) FROM Calificacion WHERE materia_idmateria = $1) as calificaciones,
          (SELECT COUNT(*) FROM Asistencia WHERE materia_idmateria = $1) as asistencias,
          (SELECT COUNT(*) FROM Tarea WHERE materia_idmateria = $1) as tareas,
          (SELECT COUNT(*) FROM Recurso_educativo WHERE materia_idmateria = $1) as recursos
      `, [id]);
      
      const dependencias = dependenciasResult.rows[0];
      
      if (dependencias.calificaciones > 0 || dependencias.asistencias > 0 || 
          dependencias.tareas > 0 || dependencias.recursos > 0) {
        throw new Error('No se puede eliminar la materia porque tiene registros relacionados');
      }
      
      const result = await query('DELETE FROM Materia WHERE idMateria = $1', [id]);
      return result.rowCount > 0;
    } catch (error) {
      throw new Error(`Error al eliminar materia: ${error.message}`);
    }
  }
  
  /**
   * Obtiene las materias de un curso
   * @param {number} cursoId - ID del curso
   * @returns {Promise<Array>} Lista de materias del curso
   */
  static async getByCurso(cursoId) {
    try {
      const result = await query(`
        SELECT m.*, p.nomb_prof, p.ape_prof 
        FROM Materia m
        LEFT JOIN Profesor p ON m.profesor_idprofesor = p.idProfesor
        WHERE m.curso_idcurso = $1
        ORDER BY m.nomb_materia
      `, [cursoId]);
      
      return result.rows;
    } catch (error) {
      throw new Error(`Error al obtener materias por curso: ${error.message}`);
    }
  }
  
  /**
   * Obtiene las materias asignadas a un profesor
   * @param {number} profesorId - ID del profesor
   * @returns {Promise<Array>} Lista de materias asignadas
   */
  static async getByProfesor(profesorId) {
    try {
      const result = await query(`
        SELECT m.*, c.nomb_curso 
        FROM Materia m
        INNER JOIN Curso c ON m.curso_idcurso = c.idCurso
        WHERE m.profesor_idprofesor = $1
        ORDER BY c.nomb_curso, m.nomb_materia
      `, [profesorId]);
      
      return result.rows;
    } catch (error) {
      throw new Error(`Error al obtener materias por profesor: ${error.message}`);
    }
  }
  
  /**
   * Asigna un profesor a una materia
   * @param {number} materiaId - ID de la materia
   * @param {number} profesorId - ID del profesor
   * @returns {Promise<Object>} Materia actualizada
   */
  static async asignarProfesor(materiaId, profesorId) {
    try {
      const result = await query(`
        UPDATE Materia 
        SET profesor_idprofesor = $1
        WHERE idMateria = $2
        RETURNING *
      `, [profesorId, materiaId]);
      
      if (result.rows.length === 0) {
        throw new Error('Materia no encontrada');
      }
      
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error al asignar profesor: ${error.message}`);
    }
  }
  
  /**
   * Desasigna el profesor de una materia
   * @param {number} materiaId - ID de la materia
   * @returns {Promise<Object>} Materia actualizada
   */
  static async desasignarProfesor(materiaId) {
    try {
      const result = await query(`
        UPDATE Materia 
        SET profesor_idprofesor = NULL
        WHERE idMateria = $1
        RETURNING *
      `, [materiaId]);
      
      if (result.rows.length === 0) {
        throw new Error('Materia no encontrada');
      }
      
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error al desasignar profesor: ${error.message}`);
    }
  }
  
  /**
   * Busca materias por nombre o descripción
   * @param {string} term - Término de búsqueda
   * @returns {Promise<Array>} Lista de materias que coinciden
   */
  static async search(term) {
    try {
      const result = await query(`
        SELECT m.*, c.nomb_curso, p.nomb_prof, p.ape_prof 
        FROM Materia m
        INNER JOIN Curso c ON m.curso_idcurso = c.idCurso
        LEFT JOIN Profesor p ON m.profesor_idprofesor = p.idProfesor
        WHERE 
          m.nomb_materia ILIKE $1 OR 
          m.descripcion_materia ILIKE $1
        ORDER BY c.nomb_curso, m.nomb_materia
      `, [`%${term}%`]);
      
      return result.rows;
    } catch (error) {
      throw new Error(`Error al buscar materias: ${error.message}`);
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

module.exports = MateriaModel;