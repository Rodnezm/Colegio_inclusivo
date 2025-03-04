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
        SELECT c.*, 
          (SELECT COUNT(*) FROM Estudiante e WHERE e.Curso_idCurso = c.idCurso) as cantidad_estudiantes
        FROM Curso c
        ORDER BY c.año DESC, c.nomb_curso
      `);
      
      return result.rows;
    } catch (error) {
      throw new Error(`Error al obtener cursos: ${error.message}`);
    }
  }
  
  /**
   * Obtiene un curso por su ID
   * @param {number} id - ID del curso
   * @returns {Promise<Object>} Datos del curso
   */
  static async getById(id) {
    try {
      const result = await query('SELECT * FROM materia WHERE idmateria = $1', [id]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error al obtener curso: ${error.message}`);
    }
  }
}