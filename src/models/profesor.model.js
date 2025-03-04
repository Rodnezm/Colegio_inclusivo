const { query } = require('../config/database');

/**
 * Modelo para gestionar los profesores
 */
class ProfesorModel {
  /**
   * Obtiene todos los profesores con información de curso y usuario
   * @returns {Promise<Array>} Lista de profesores 
   */
  static async getAll() {
    try {
      const result = await query(`
        SELECT p.*, u.nomb_user, u.tipo_user
        FROM Profesor p
        INNER JOIN Usuario u ON p.Usuario_idUsuario = u.idUsuario
        ORDER BY p.ape_prof, p.nomb_prof
      `);
      
      return result.rows;
    } catch (error) {
      throw new Error(`Error al obtener profesores: ${error.message}`);
    }
  }
  
  /**
   * Obtiene un profesor por su ID con toda la información relacionada
   * @param {number} id - ID del profesor
   * @returns {Promise<Object>} Datos del profesor
   */
  static async getById(id) {
    try {
      const result = await query(`
        SELECT p.*, u.nomb_user, u.tipo_user 
        FROM Profesor p
        INNER JOIN Usuario u ON p.Usuario_idUsuario = u.idUsuario
        WHERE p.idProfesor = $1
      `, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      // Obtener materias del profesor
      const materiasResult = await query(`
        SELECT m.*, c.nomb_curso, c.año
        FROM Materia m
        INNER JOIN Curso c ON m.Curso_idCurso = c.idCurso
        WHERE m.Profesor_idProfesor = $1
        ORDER BY c.año DESC, c.nomb_curso, m.nomb_materia
      `, [id]);
      
      // Obtener estudiantes asignados a través de materias
      const estudiantesResult = await query(`
        SELECT DISTINCT 
          e.idEstudiante, 
          e.nomb_est, 
          e.ape_est,
          c.nomb_curso,
          c.año,
          m.nomb_materia
        FROM Profesor p
        INNER JOIN Materia m ON m.Profesor_idProfesor = p.idProfesor
        INNER JOIN Curso c ON m.Curso_idCurso = c.idCurso
        INNER JOIN Estudiante e ON e.Curso_idCurso = c.idCurso
        WHERE p.idProfesor = $1 AND e.estado_est = 'activo'
        ORDER BY c.nomb_curso, e.ape_est, e.nomb_est
      `, [id]);
      
      // Obtener configuración de accesibilidad
      const accessibilityResult = await query(`
        SELECT ca.* 
        FROM Conf_accesibilidad ca
        INNER JOIN Usuario u ON ca.Usuario_idUsuario = u.idUsuario
        INNER JOIN Profesor p ON p.Usuario_idUsuario = u.idUsuario
        WHERE p.idProfesor = $1
      `, [id]);
      
      // Construir objeto completo
      const profesor = {
        ...result.rows[0],
        materias: materiasResult.rows,
        estudiantes: estudiantesResult.rows,
        configuracionAccesibilidad: accessibilityResult.rows.length > 0 ? accessibilityResult.rows[0] : null
      };
      
      return profesor;
    } catch (error) {
      throw new Error(`Error al obtener profesor: ${error.message}`);
    }
  }

  /**
   * Crea un nuevo profesor
   * @param {Object} profesor - Datos del profesor
   * @param {number} usuarioId - ID del usuario asociado
   * @returns {Promise<Object>} Profesor creado
   */
  static async create(profesor, usuarioId) {
    try {
      const {
        nomb_prof, ape_prof, ci_prof, direccion_prof, fecha_nac_prof,
        especialidad, email, telef1_prof, telef2_prof
      } = profesor;
      
      const result = await query(
        `INSERT INTO Profesor (
          Usuario_idUsuario, nomb_prof, ape_prof, ci_prof,
          direccion_prof, fecha_nac_prof, especialidad,
          email, telef1_prof, telef2_prof
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
        )
        RETURNING *`,
        [
          usuarioId, nomb_prof, ape_prof, ci_prof,
          direccion_prof || null, fecha_nac_prof || null, especialidad || null,
          email || null, telef1_prof || null, telef2_prof || null
        ]
      );
      
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error al crear profesor: ${error.message}`);
    }
  }
  
  /**
   * Actualiza un profesor existente
   * @param {number} id - ID del profesor
   * @param {Object} data - Datos a actualizar
   * @returns {Promise<Object>} Profesor actualizado
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
        `UPDATE Profesor SET ${fieldsToUpdate} WHERE idProfesor = $1 RETURNING *`,
        [id, ...values]
      );
      
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error al actualizar profesor: ${error.message}`);
    }
  }
  
  /**
   * Elimina un profesor y todos sus registros relacionados
   * @param {number} id - ID del profesor
   * @returns {Promise<boolean>} True si se eliminó correctamente
   */
  static async delete(id) {
    try {
      // Obtener el ID de usuario asociado
      const profesorResult = await query(
        'SELECT Usuario_idUsuario FROM Profesor WHERE idProfesor = $1',
        [id]
      );
      
      if (profesorResult.rows.length === 0) {
        return false;
      }
      
      const usuarioId = profesorResult.rows[0].Usuario_idUsuario;
      
      // Comenzar transacción
      await query('BEGIN');
      
      try {
        // Actualizar materias asignadas a este profesor (desasignar)
        await query('UPDATE Materia SET Profesor_idProfesor = NULL WHERE Profesor_idProfesor = $1', [id]);
        
        // Eliminar registros de conducta creados por este profesor
        await query('DELETE FROM Registro_conduct WHERE Profesor_idProfesor = $1', [id]);
        
        // Eliminar profesor
        await query('DELETE FROM Profesor WHERE idProfesor = $1', [id]);
        
        // Eliminar configuración de accesibilidad
        await query('DELETE FROM Conf_accesibilidad WHERE Usuario_idUsuario = $1', [usuarioId]);
        
        // Eliminar usuario
        await query('DELETE FROM Usuario WHERE idUsuario = $1', [usuarioId]);
        
        // Confirmar transacción
        await query('COMMIT');
        
        return true;
      } catch (error) {
        // Revertir en caso de error
        await query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      throw new Error(`Error al eliminar profesor: ${error.message}`);
    }
  }
  
  /**
   * Obtiene las materias asignadas a un profesor
   * @param {number} id - ID del profesor
   * @returns {Promise<Array>} Lista de materias
   */
  static async getMaterias(id) {
    try {
      const result = await query(`
        SELECT m.*, c.nomb_curso, c.año
        FROM Materia m
        INNER JOIN Curso c ON m.Curso_idCurso = c.idCurso
        WHERE m.Profesor_idProfesor = $1
        ORDER BY c.año DESC, c.nomb_curso, m.nomb_materia
      `, [id]);
      
      return result.rows;
    } catch (error) {
      throw new Error(`Error al obtener materias del profesor: ${error.message}`);
    }
  }
  
  /**
   * Asigna materias a un profesor
   * @param {number} id - ID del profesor
   * @param {Array} materiaIds - IDs de las materias a asignar
   * @returns {Promise<boolean>} True si se asignaron correctamente
   */
  static async asignarMaterias(id, materiaIds) {
    try {
      // Comenzar transacción
      await query('BEGIN');
      
      try {
        // Para cada materia
        for (const materiaId of materiaIds) {
          await query(
            'UPDATE Materia SET Profesor_idProfesor = $1 WHERE idMateria = $2',
            [id, materiaId]
          );
        }
        
        // Confirmar transacción
        await query('COMMIT');
        
        return true;
      } catch (error) {
        // Revertir en caso de error
        await query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      throw new Error(`Error al asignar materias: ${error.message}`);
    }
  }
  
  /**
   * Desasigna materias de un profesor
   * @param {number} id - ID del profesor
   * @param {Array} materiaIds - IDs de las materias a desasignar
   * @returns {Promise<boolean>} True si se desasignaron correctamente
   */
  static async desasignarMaterias(id, materiaIds) {
    try {
      // Comenzar transacción
      await query('BEGIN');
      
      try {
        // Para cada materia
        for (const materiaId of materiaIds) {
          await query(
            'UPDATE Materia SET Profesor_idProfesor = NULL WHERE idMateria = $2 AND Profesor_idProfesor = $1',
            [id, materiaId]
          );
        }
        
        // Confirmar transacción
        await query('COMMIT');
        
        return true;
      } catch (error) {
        // Revertir en caso de error
        await query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      throw new Error(`Error al desasignar materias: ${error.message}`);
    }
  }
  
  /**
   * Obtiene los estudiantes asignados a las materias de un profesor
   * @param {number} id - ID del profesor
   * @returns {Promise<Array>} Lista de estudiantes agrupados por curso y materia
   */
  static async getEstudiantes(id) {
    try {
      const result = await query(`
        SELECT 
          c.idCurso,
          c.nomb_curso,
          m.idMateria,
          m.nomb_materia,
          json_agg(
            json_build_object(
              'idEstudiante', e.idEstudiante,
              'nomb_est', e.nomb_est,
              'ape_est', e.ape_est,
              'ci_est', e.ci_est,
              'estado_est', e.estado_est
            )
          ) as estudiantes
        FROM Profesor p
        INNER JOIN Materia m ON m.Profesor_idProfesor = p.idProfesor
        INNER JOIN Curso c ON m.Curso_idCurso = c.idCurso
        INNER JOIN Estudiante e ON e.Curso_idCurso = c.idCurso
        WHERE p.idProfesor = $1 AND e.estado_est = 'activo'
        GROUP BY c.idCurso, c.nomb_curso, m.idMateria, m.nomb_materia
        ORDER BY c.nomb_curso, m.nomb_materia
      `, [id]);
      
      return result.rows;
    } catch (error) {
      throw new Error(`Error al obtener estudiantes del profesor: ${error.message}`);
    }
  }
  
  /**
   * Busca profesores por nombre, apellido o especialidad
   * @param {string} termino - Término de búsqueda
   * @returns {Promise<Array>} Lista de profesores encontrados
   */
  static async buscar(termino) {
    try {
      const result = await query(`
        SELECT p.*, u.nomb_user
        FROM Profesor p
        INNER JOIN Usuario u ON p.Usuario_idUsuario = u.idUsuario
        WHERE 
          p.nomb_prof ILIKE $1 OR
          p.ape_prof ILIKE $1 OR
          p.especialidad ILIKE $1 OR
          p.ci_prof ILIKE $1
        ORDER BY p.ape_prof, p.nomb_prof
      `, [`%${termino}%`]);
      
      return result.rows;
    } catch (error) {
      throw new Error(`Error al buscar profesores: ${error.message}`);
    }
  }
  
  /**
   * Obtiene profesores por especialidad
   * @param {string} especialidad - Especialidad a buscar
   * @returns {Promise<Array>} Lista de profesores encontrados
   */
  static async getPorEspecialidad(especialidad) {
    try {
      const result = await query(`
        SELECT p.*, u.nomb_user
        FROM Profesor p
        INNER JOIN Usuario u ON p.Usuario_idUsuario = u.idUsuario
        WHERE p.especialidad = $1
        ORDER BY p.ape_prof, p.nomb_prof
      `, [especialidad]);
      
      return result.rows;
    } catch (error) {
      throw new Error(`Error al obtener profesores por especialidad: ${error.message}`);
    }
  }
  
  /**
   * Obtiene estadísticas del profesor (materias, estudiantes, cursos)
   * @param {number} id - ID del profesor
   * @returns {Promise<Object>} Estadísticas del profesor
   */
  static async getEstadisticas(id) {
    try {
      // Contar materias asignadas
      const materiasResult = await query(`
        SELECT COUNT(*) as total_materias
        FROM Materia
        WHERE Profesor_idProfesor = $1
      `, [id]);
      
      // Contar cursos donde enseña
      const cursosResult = await query(`
        SELECT COUNT(DISTINCT Curso_idCurso) as total_cursos
        FROM Materia
        WHERE Profesor_idProfesor = $1
      `, [id]);
      
      // Contar estudiantes a los que enseña
      const estudiantesResult = await query(`
        SELECT COUNT(DISTINCT e.idEstudiante) as total_estudiantes
        FROM Estudiante e
        INNER JOIN Curso c ON e.Curso_idCurso = c.idCurso
        INNER JOIN Materia m ON m.Curso_idCurso = c.idCurso
        WHERE m.Profesor_idProfesor = $1 AND e.estado_est = 'activo'
      `, [id]);
      
      return {
        total_materias: parseInt(materiasResult.rows[0].total_materias),
        total_cursos: parseInt(cursosResult.rows[0].total_cursos),
        total_estudiantes: parseInt(estudiantesResult.rows[0].total_estudiantes)
      };
    } catch (error) {
      throw new Error(`Error al obtener estadísticas del profesor: ${error.message}`);
    }
  }
  
  /**
   * Obtiene el horario de clases de un profesor
   * @param {number} id - ID del profesor
   * @returns {Promise<Array>} Horario del profesor
   */
  static async getHorario(id) {
    try {
      // Esta consulta es un ejemplo - necesitarías adaptar según tu esquema
      // si tienes una tabla de horarios
      const result = await query(`
        SELECT h.*, m.nomb_materia, c.nomb_curso
        FROM Horario h
        INNER JOIN Materia m ON h.Materia_idMateria = m.idMateria
        INNER JOIN Curso c ON m.Curso_idCurso = c.idCurso
        WHERE m.Profesor_idProfesor = $1
        ORDER BY h.dia_semana, h.hora_inicio
      `, [id]);
      
      return result.rows;
    } catch (error) {
      throw new Error(`Error al obtener horario del profesor: ${error.message}`);
    }
  }
  
  /**
   * Obtiene un profesor por su usuario asociado
   * @param {number} usuarioId - ID del usuario
   * @returns {Promise<Object>} Profesor encontrado
   */
  static async getByUsuarioId(usuarioId) {
    try {
      const result = await query(`
        SELECT p.*
        FROM Profesor p
        WHERE p.Usuario_idUsuario = $1
      `, [usuarioId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error al obtener profesor por usuario: ${error.message}`);
    }
  }
}

module.exports = ProfesorModel;