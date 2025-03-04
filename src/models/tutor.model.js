const { query } = require('../config/database');

/**
 * Modelo para gestionar los tutores
 */
class TutorModel {
  /**
   * Obtiene todos los tutores
   * @returns {Promise<Array>} Lista de tutores
   */
  static async getAll() {
    try {
      const result = await query(`
        SELECT t.*, u.nomb_user 
        FROM Tutor t
        LEFT JOIN Usuario u ON t.Usuario_idUsuario = u.idUsuario
        ORDER BY t.ape_tut, t.nomb_tut
      `);
      
      return result.rows;
    } catch (error) {
      throw new Error(`Error al obtener tutores: ${error.message}`);
    }
  }
  
  /**
   * Obtiene un tutor por su ID
   * @param {number} id - ID del tutor
   * @returns {Promise<Object>} Datos del tutor
   */
  static async getById(id) {
    try {
      const result = await query(`
        SELECT t.*, u.nomb_user, u.tipo_user 
        FROM Tutor t
        LEFT JOIN Usuario u ON t.Usuario_idUsuario = u.idUsuario
        WHERE t.idTutor = $1
      `, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      // Obtener estudiantes a cargo
      const estudiantesResult = await query(`
        SELECT e.idEstudiante, e.nomb_est, e.ape_est, c.nomb_curso 
        FROM Estudiante e
        INNER JOIN Curso c ON e.Curso_idCurso = c.idCurso
        INNER JOIN Estudiante_has_Tutor et ON e.idEstudiante = et.Estudiante_idEstudiante
        WHERE et.Tutor_idTutor = $1
        ORDER BY e.ape_est, e.nomb_est
      `, [id]);
      
      const tutor = {
        ...result.rows[0],
        estudiantes: estudiantesResult.rows
      };
      
      return tutor;
    } catch (error) {
      throw new Error(`Error al obtener tutor: ${error.message}`);
    }
  }
  
  /**
   * Obtiene un tutor por su ID de usuario (si tiene)
   * @param {number} usuarioId - ID del usuario
   * @returns {Promise<Object>} Datos del tutor
   */
  static async getByUsuarioId(usuarioId) {
    try {
      const result = await query(`
        SELECT t.*
        FROM Tutor t
        WHERE t.Usuario_idUsuario = $1
      `, [usuarioId]);
      
      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Error al obtener tutor por ID de usuario: ${error.message}`);
    }
  }
  
  /**
   * Crea un nuevo tutor
   * @param {Object} tutor - Datos del tutor
   * @param {number|null} usuarioId - ID del usuario (opcional)
   * @returns {Promise<Object>} Tutor creado
   */
  static async create(tutor, usuarioId = null) {
    try {
      const {
        nomb_tut, ape_tut, ci_tu, direc_tut, fech_nac, 
        telef, telef2_tut, email_tut, ocupacion_tut,
        es_contacto_emergencia, parentesco, es_resp_financiero, vive_c_estudiante
      } = tutor;
      
      const result = await query(
        `INSERT INTO Tutor (
          Usuario_idUsuario, nomb_tut, ape_tut, ci_tu, direc_tut, 
          fech_nac, telef, telef2_tut, email_tut, ocupacion_tut,
          es_contacto_emergencia, parentesco, es_resp_financiero, vive_c_estudiante
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *`,
        [
          usuarioId, nomb_tut, ape_tut, ci_tu, direc_tut || null,
          fech_nac || null, telef || null, telef2_tut || null, email_tut || null, ocupacion_tut || null,
          es_contacto_emergencia || false, parentesco || null, es_resp_financiero || false, vive_c_estudiante || false
        ]
      );
      
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error al crear tutor: ${error.message}`);
    }
  }
  
  /**
   * Actualiza un tutor existente
   * @param {number} id - ID del tutor
   * @param {Object} data - Datos a actualizar
   * @returns {Promise<Object>} Tutor actualizado
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
        `UPDATE Tutor SET ${fieldsToUpdate} WHERE idTutor = $1 RETURNING *`,
        [id, ...values]
      );
      
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error al actualizar tutor: ${error.message}`);
    }
  }
  
  /**
   * Elimina un tutor
   * @param {number} id - ID del tutor
   * @returns {Promise<boolean>} True si se eliminó correctamente
   */
  static async delete(id) {
    try {
      // Verificar si tiene usuario asociado
      const tutorResult = await query('SELECT Usuario_idUsuario FROM Tutor WHERE idTutor = $1', [id]);
      
      if (tutorResult.rows.length === 0) {
        return false;
      }
      
      const usuarioId = tutorResult.rows[0].Usuario_idUsuario;
      
      // Comenzar transacción
      await query('BEGIN');
      
      try {
        // Eliminar relaciones con estudiantes
        await query('DELETE FROM Estudiante_has_Tutor WHERE Tutor_idTutor = $1', [id]);
        
        // Actualizar pagos para que no tengan referencia a este tutor
        await query('UPDATE Pago SET Tutor_idTutor = NULL WHERE Tutor_idTutor = $1', [id]);
        
        // Eliminar tutor
        await query('DELETE FROM Tutor WHERE idTutor = $1', [id]);
        
        // Si tiene usuario asociado, eliminar configuración de accesibilidad y usuario
        if (usuarioId) {
          await query('DELETE FROM Conf_accesibilidad WHERE Usuario_idUsuario = $1', [usuarioId]);
          await query('DELETE FROM Usuario WHERE idUsuario = $1', [usuarioId]);
        }
        
        // Confirmar transacción
        await query('COMMIT');
        return true;
      } catch (error) {
        // Revertir transacción en caso de error
        await query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      throw new Error(`Error al eliminar tutor: ${error.message}`);
    }
  }
  
  /**
   * Busca tutores por nombre, apellido o número de documento
   * @param {string} searchTerm - Término de búsqueda
   * @returns {Promise<Array>} Lista de tutores que coinciden con la búsqueda
   */
  static async search(searchTerm) {
    try {
      const result = await query(`
        SELECT t.*, u.nomb_user 
        FROM Tutor t
        LEFT JOIN Usuario u ON t.Usuario_idUsuario = u.idUsuario
        WHERE 
          t.nomb_tut ILIKE $1 OR 
          t.ape_tut ILIKE $1 OR 
          t.ci_tu ILIKE $1
        ORDER BY t.ape_tut, t.nomb_tut
      `, [`%${searchTerm}%`]);
      
      return result.rows;
    } catch (error) {
      throw new Error(`Error al buscar tutores: ${error.message}`);
    }
  }
}

module.exports = TutorModel;