const { query } = require('../config/database');

/**
 * Modelo para gestionar los cursos
 */
class CursoModel {
  /**
   * Obtiene todos los cursos con cantidad de estudiantes
   * @returns {Promise<Array>} Lista de cursos 
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
      const result = await query('SELECT * FROM Curso WHERE idCurso = $1', [id]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error al obtener curso: ${error.message}`);
    }
  }
  
  /**
   * Obtiene un curso con sus estudiantes y materias
   * @param {number} id - ID del curso
   * @returns {Promise<Object>} Curso con relaciones
   */
  static async getByIdWithRelations(id) {
    try {
      const curso = await this.getById(id);
      
      if (!curso) {
        return null;
      }
      
      // Obtener estudiantes del curso
      const estudiantes = await query(`
        SELECT e.idEstudiante, e.nomb_est, e.ape_est, e.ci_est, e.estado_est
        FROM Estudiante e
        WHERE e.Curso_idCurso = $1
        ORDER BY e.ape_est, e.nomb_est
      `, [id]);
      
      // Obtener materias del curso
      const materias = await query(`
        SELECT m.idMateria, m.nomb_materia, m.descripcion_materia,
          p.idProfesor, p.nomb_prof, p.ape_prof
        FROM Materia m
        LEFT JOIN Profesor p ON m.Profesor_idProfesor = p.idProfesor
        WHERE m.Curso_idCurso = $1
        ORDER BY m.nomb_materia
      `, [id]);
      
      return {
        ...curso,
        estudiantes: estudiantes.rows,
        materias: materias.rows
      };
    } catch (error) {
      throw new Error(`Error al obtener curso con relaciones: ${error.message}`);
    }
  }
  
  /**
   * Crea un nuevo curso
   * @param {Object} curso - Datos del curso
   * @returns {Promise<Object>} Curso creado
   */
  static async create(curso) {
    try {
      const { nomb_curso, año, capacidad } = curso;
      
      const result = await query(
        'INSERT INTO Curso (nomb_curso, año, capacidad) VALUES ($1, $2, $3) RETURNING *',
        [nomb_curso, año, capacidad]
      );
      
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error al crear curso: ${error.message}`);
    }
  }
  
  /**
   * Actualiza un curso existente
   * @param {number} id - ID del curso
   * @param {Object} data - Datos a actualizar
   * @returns {Promise<Object>} Curso actualizado
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
        `UPDATE Curso SET ${fieldsToUpdate} WHERE idCurso = $1 RETURNING *`,
        [id, ...values]
      );
      
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error al actualizar curso: ${error.message}`);
    }
  }
  
  /**
   * Elimina un curso
   * @param {number} id - ID del curso
   * @returns {Promise<boolean>} True si se eliminó correctamente
   */
  static async delete(id) {
    try {
      // Verificar si existen estudiantes asociados
      const estudiantesResult = await query(
        'SELECT COUNT(*) FROM Estudiante WHERE Curso_idCurso = $1',
        [id]
      );
      
      if (parseInt(estudiantesResult.rows[0].count) > 0) {
        throw new Error('No se puede eliminar el curso porque tiene estudiantes asignados');
      }
      
      // Verificar si existen materias asociadas
      const materiasResult = await query(
        'SELECT COUNT(*) FROM Materia WHERE Curso_idCurso = $1',
        [id]
      );
      
      if (parseInt(materiasResult.rows[0].count) > 0) {
        throw new Error('No se puede eliminar el curso porque tiene materias asignadas');
      }
      
      // Eliminar curso
      const result = await query('DELETE FROM Curso WHERE idCurso = $1', [id]);
      
      return result.rowCount > 0;
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Asigna estudiantes a un curso
   * @param {number} cursoId - ID del curso
   * @param {Array} estudianteIds - Array de IDs de estudiantes
   * @returns {Promise<boolean>} True si se asignaron correctamente
   */
  static async assignStudents(cursoId, estudianteIds) {
    try {
      // Iniciar transacción
      await query('BEGIN');
      
      try {
        // Actualizar cada estudiante
        for (const estudianteId of estudianteIds) {
          await query(
            'UPDATE Estudiante SET Curso_idCurso = $1 WHERE idEstudiante = $2',
            [cursoId, estudianteId]
          );
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
      throw new Error(`Error al asignar estudiantes: ${error.message}`);
    }
  }
  
  /**
   * Obtiene estudiantes de un curso
   * @param {number} cursoId - ID del curso
   * @returns {Promise<Array>} Lista de estudiantes
   */
  static async getStudents(cursoId) {
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
      throw new Error(`Error al obtener estudiantes del curso: ${error.message}`);
    }
  }
  
  /**
   * Obtiene materias de un curso
   * @param {number} cursoId - ID del curso
   * @returns {Promise<Array>} Lista de materias
   */
  static async getMaterias(cursoId) {
    try {
      const result = await query(`
        SELECT m.*, p.nomb_prof, p.ape_prof
        FROM Materia m
        LEFT JOIN Profesor p ON m.Profesor_idProfesor = p.idProfesor
        WHERE m.Curso_idCurso = $1
        ORDER BY m.nomb_materia
      `, [cursoId]);
      
      return result.rows;
    } catch (error) {
      throw new Error(`Error al obtener materias del curso: ${error.message}`);
    }
  }
  
  /**
   * Busca cursos por nombre o año
   * @param {string} termino - Término de búsqueda
   * @returns {Promise<Array>} Lista de cursos encontrados
   */
  static async search(termino) {
    try {
      const result = await query(`
        SELECT c.*, 
          (SELECT COUNT(*) FROM Estudiante e WHERE e.Curso_idCurso = c.idCurso) as cantidad_estudiantes
        FROM Curso c
        WHERE 
          c.nomb_curso ILIKE $1 OR 
          CAST(c.año AS TEXT) LIKE $1
        ORDER BY c.año DESC, c.nomb_curso
      `, [`%${termino}%`]);
      
      return result.rows;
    } catch (error) {
      throw new Error(`Error al buscar cursos: ${error.message}`);
    }
  }
  
  /**
   * Obtiene cursos por año
   * @param {number} año - Año a filtrar
   * @returns {Promise<Array>} Lista de cursos del año especificado
   */
  static async getByYear(año) {
    try {
      const result = await query(`
        SELECT c.*, 
          (SELECT COUNT(*) FROM Estudiante e WHERE e.Curso_idCurso = c.idCurso) as cantidad_estudiantes
        FROM Curso c
        WHERE c.año = $1
        ORDER BY c.nomb_curso
      `, [año]);
      
      return result.rows;
    } catch (error) {
      throw new Error(`Error al obtener cursos por año: ${error.message}`);
    }
  }
  
  /**
   * Verifica si un curso tiene capacidad disponible
   * @param {number} cursoId - ID del curso
   * @returns {Promise<Object>} Objeto con información de capacidad
   */
  static async checkCapacity(cursoId) {
    try {
      const cursoResult = await query('SELECT capacidad FROM Curso WHERE idCurso = $1', [cursoId]);
      
      if (cursoResult.rows.length === 0) {
        throw new Error('Curso no encontrado');
      }
      
      const capacidadTotal = cursoResult.rows[0].capacidad;
      
      const estudiantesResult = await query(
        'SELECT COUNT(*) as count FROM Estudiante WHERE Curso_idCurso = $1',
        [cursoId]
      );
      
      const cantidadEstudiantes = parseInt(estudiantesResult.rows[0].count);
      
      return {
        capacidadTotal,
        cantidadEstudiantes,
        disponible: capacidadTotal - cantidadEstudiantes,
        estaLleno: cantidadEstudiantes >= capacidadTotal
      };
    } catch (error) {
      throw new Error(`Error al verificar capacidad: ${error.message}`);
    }
  }
}

module.exports = CursoModel;