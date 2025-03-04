const { query } = require('../config/database');

/**
 * Modelo para gestionar los estudiantes
 */
class EstudianteModel {
  /**
   * Obtiene todos los estudiantes con información de curso y usuario
   * @returns {Promise<Array>} Lista de estudiantes
   */
  static async getAll() {
    try {
      const result = await query(`
        SELECT e.*, c.nomb_curso, u.nomb_user 
        FROM Estudiante e
        INNER JOIN Curso c ON e.Curso_idCurso = c.idCurso
        INNER JOIN Usuario u ON e.Usuario_idUsuario = u.idUsuario
        ORDER BY e.ape_est, e.nomb_est
      `);
      
      return result.rows;
    } catch (error) {
      throw new Error(`Error al obtener estudiantes: ${error.message}`);
    }
  }
  
  /**
   * Obtiene un estudiante por su ID con toda la información relacionada
   * @param {number} id - ID del estudiante
   * @returns {Promise<Object>} Datos del estudiante
   */
  static async getById(id) {
    try {
      const result = await query(`
        SELECT e.*, c.nomb_curso, u.nomb_user, u.tipo_user 
        FROM Estudiante e
        INNER JOIN Curso c ON e.Curso_idCurso = c.idCurso
        INNER JOIN Usuario u ON e.Usuario_idUsuario = u.idUsuario
        WHERE e.idEstudiante = $1
      `, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      // Obtener información médica si existe
      const infoMedico = await query(
        'SELECT * FROM Info_medico WHERE Estudiante_idEstudiante = $1', 
        [id]
      );
      
      // Obtener tutores asociados
      const tutores = await query(`
        SELECT t.* 
        FROM Tutor t
        INNER JOIN Estudiante_has_Tutor et ON t.idTutor = et.Tutor_idTutor
        WHERE et.Estudiante_idEstudiante = $1
      `, [id]);
      
      // Obtener documentación
      const documentacion = await query(
        'SELECT * FROM Documentacion_estudiante WHERE Estudiante_idEstudiante = $1', 
        [id]
      );
      
      // Obtener configuración de accesibilidad
      const accessibilityResult = await query(`
        SELECT ca.* 
        FROM Conf_accesibilidad ca
        INNER JOIN Usuario u ON ca.Usuario_idUsuario = u.idUsuario
        INNER JOIN Estudiante e ON e.Usuario_idUsuario = u.idUsuario
        WHERE e.idEstudiante = $1
      `, [id]);
      
      const estudiante = {
        ...result.rows[0],
        infoMedica: infoMedico.rows.length > 0 ? infoMedico.rows[0] : null,
        tutores: tutores.rows,
        documentacion: documentacion.rows,
        configuracionAccesibilidad: accessibilityResult.rows.length > 0 ? accessibilityResult.rows[0] : null
      };
      
      return estudiante;
    } catch (error) {
      throw new Error(`Error al obtener estudiante: ${error.message}`);
    }
  }
  
  /**
   * Obtiene un estudiante por su ID de usuario
   * @param {number} usuarioId - ID del usuario
   * @returns {Promise<Object>} Datos del estudiante
   */
  static async getByUsuarioId(usuarioId) {
    try {
      const result = await query(`
        SELECT e.*, c.nomb_curso
        FROM Estudiante e
        INNER JOIN Curso c ON e.Curso_idCurso = c.idCurso
        WHERE e.Usuario_idUsuario = $1
      `, [usuarioId]);
      
      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Error al obtener estudiante por ID de usuario: ${error.message}`);
    }
  }
  
  /**
   * Crea un nuevo estudiante
   * @param {Object} estudiante - Datos del estudiante
   * @param {number} usuarioId - ID del usuario asociado
   * @returns {Promise<Object>} Estudiante creado
   */
  static async create(estudiante, usuarioId) {
    try {
      const {
        Curso_idCurso, nomb_est, ape_est, ci_est, fech_nac_est, direccion_est,
        telef1_est, telef2_est, email_est, genero_est, nacionalidad_est,
        necesidad_especial, obs_est, matricula_est
      } = estudiante;
      
      const result = await query(
        `INSERT INTO Estudiante (
          Usuario_idUsuario, Curso_idCurso, nomb_est, ape_est, ci_est,
          fech_nac_est, direccion_est, telef1_est, telef2_est,
          email_est, genero_est, nacionalidad_est,
          necesidad_especial, obs_est, fech_ingreso_est, estado_est, matricula_est
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_DATE, 'activo', $15
        )
        RETURNING *`,
        [
          usuarioId, Curso_idCurso, nomb_est, ape_est, ci_est,
          fech_nac_est || null, direccion_est || null, telef1_est || null, telef2_est || null,
          email_est || null, genero_est || null, nacionalidad_est || null,
          necesidad_especial || null, obs_est || null, matricula_est || null
        ]
      );
      
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error al crear estudiante: ${error.message}`);
    }
  }
  
  /**
   * Actualiza un estudiante existente
   * @param {number} id - ID del estudiante
   * @param {Object} data - Datos a actualizar
   * @returns {Promise<Object>} Estudiante actualizado
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
        `UPDATE Estudiante SET ${fieldsToUpdate} WHERE idEstudiante = $1 RETURNING *`,
        [id, ...values]
      );
      
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error al actualizar estudiante: ${error.message}`);
    }
  }
  
  /**
   * Elimina un estudiante y todos sus registros relacionados
   * @param {number} id - ID del estudiante
   * @returns {Promise<boolean>} True si se eliminó correctamente
   */
  static async delete(id) {
    try {
      // Obtener el ID de usuario asociado
      const studentResult = await query(
        'SELECT Usuario_idUsuario FROM Estudiante WHERE idEstudiante = $1',
        [id]
      );
      
      if (studentResult.rows.length === 0) {
        return false;
      }
      
      const usuarioId = studentResult.rows[0].Usuario_idUsuario;
      
      // Comenzar transacción
      await query('BEGIN');
      
      try {
        // Eliminar registros relacionados
        await query('DELETE FROM Asistencia WHERE Estudiante_idEstudiante = $1', [id]);
        await query('DELETE FROM Calificacion WHERE Estudiante_idEstudiante = $1', [id]);
        await query('DELETE FROM Beca WHERE Estudiante_idEstudiante = $1', [id]);
        await query('DELETE FROM Registro_conduct WHERE Estudiante_idEstudiante = $1', [id]);
        await query('DELETE FROM Info_medico WHERE Estudiante_idEstudiante = $1', [id]);
        await query('DELETE FROM Documentacion_estudiante WHERE Estudiante_idEstudiante = $1', [id]);
        await query('DELETE FROM Estudiante_has_Tutor WHERE Estudiante_idEstudiante = $1', [id]);
        
        // Eliminar cuotas y pagos asociados
        const cuotasResult = await query('SELECT idCuota FROM Cuota WHERE Estudiante_idEstudiante = $1', [id]);
        for (const cuota of cuotasResult.rows) {
          await query('DELETE FROM Pago WHERE Cuota_idCuota = $1', [cuota.idCuota]);
        }
        await query('DELETE FROM Cuota WHERE Estudiante_idEstudiante = $1', [id]);
        
        // Eliminar estudiante
        await query('DELETE FROM Estudiante WHERE idEstudiante = $1', [id]);
        
        // Eliminar configuración de accesibilidad
        await query('DELETE FROM Conf_accesibilidad WHERE Usuario_idUsuario = $1', [usuarioId]);
        
        // Eliminar usuario
        await query('DELETE FROM Usuario WHERE idUsuario = $1', [usuarioId]);
        
        // Confirmar transacción
        await query('COMMIT');
        return true;
      } catch (error) {
        // Revertir transacción en caso de error
        await query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      throw new Error(`Error al eliminar estudiante: ${error.message}`);
    }
  }
  
  /**
   * Busca estudiantes por nombre, apellido o número de documento
   * @param {string} searchTerm - Término de búsqueda
   * @returns {Promise<Array>} Lista de estudiantes que coinciden con la búsqueda
   */
  static async search(searchTerm) {
    try {
      const result = await query(`
        SELECT e.*, c.nomb_curso, u.nomb_user 
        FROM Estudiante e
        INNER JOIN Curso c ON e.Curso_idCurso = c.idCurso
        INNER JOIN Usuario u ON e.Usuario_idUsuario = u.idUsuario
        WHERE 
          e.nomb_est ILIKE $1 OR 
          e.ape_est ILIKE $1 OR 
          e.ci_est ILIKE $1
        ORDER BY e.ape_est, e.nomb_est
      `, [`%${searchTerm}%`]);
      
      return result.rows;
    } catch (error) {
      throw new Error(`Error al buscar estudiantes: ${error.message}`);
    }
  }
  
  /**
   * Obtiene los estudiantes por curso
   * @param {number} cursoId - ID del curso
   * @returns {Promise<Array>} Lista de estudiantes del curso
   */
  static async getByCurso(cursoId) {
    try {
      const result = await query(`
        SELECT e.*, u.nomb_user 
        FROM Estudiante e
        INNER JOIN Usuario u ON e.Usuario_idUsuario = u.idUsuario
        WHERE e.Curso_idCurso = $1
        ORDER BY e.ape_est, e.nomb_est
      `, [cursoId]);
      
      return result.rows;
    } catch (error) {
      throw new Error(`Error al obtener estudiantes por curso: ${error.message}`);
    }
  }
  
 
}

module.exports = EstudianteModel;