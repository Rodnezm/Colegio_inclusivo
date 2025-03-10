// src/controllers/materia.controller.js
const { query } = require('../config/database');
const { validationResult } = require('express-validator');

class MateriaController {
  /**
   * Obtiene todas las materias
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async getAllMaterias(req, res) {
    try {
      const result = await query(`
        SELECT m.*, c.nomb_curso, p.nomb_prof, p.ape_prof 
        FROM Materia m
        INNER JOIN Curso c ON m.curso_idcurso = c.idCurso
        LEFT JOIN Profesor p ON m.profesor_idprofesor = p.idProfesor
        ORDER BY c.nomb_curso, m.nomb_materia
      `);
      
      return res.status(200).json({
        message: 'Materias obtenidas correctamente',
        materias: result.rows
      });
    } catch (error) {
      console.error('Error al obtener materias:', error);
      return res.status(500).json({ 
        message: 'Error al obtener materias',
        error: error.message 
      });
    }
  }

  /**
   * Obtiene una materia por su ID
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async getMateriaById(req, res) {
    try {
      const { id } = req.params;
      
      const result = await query(`
        SELECT m.*, c.nomb_curso, p.nomb_prof, p.ape_prof 
        FROM Materia m
        INNER JOIN Curso c ON m.curso_idcurso = c.idCurso
        LEFT JOIN Profesor p ON m.profesor_idprofesor = p.idProfesor
        WHERE m.idMateria = $1
      `, [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Materia no encontrada' });
      }
      
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
      
      return res.status(200).json({
        message: 'Materia obtenida correctamente',
        materia: result.rows[0],
        recursos: recursosResult.rows,
        tareas: tareasResult.rows
      });
    } catch (error) {
      console.error('Error al obtener materia:', error);
      return res.status(500).json({ 
        message: 'Error al obtener materia',
        error: error.message 
      });
    }
  }

  /**
   * Crea una nueva materia
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async createMateria(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { 
        curso_idcurso,
        profesor_idprofesor,
        nomb_materia,
        descripcion_materia
      } = req.body;
      
      // Verificar si el curso existe
      const cursoResult = await query(
        'SELECT * FROM Curso WHERE idCurso = $1',
        [curso_idcurso]
      );
      
      if (cursoResult.rows.length === 0) {
        return res.status(404).json({ message: 'Curso no encontrado' });
      }
      
      // Verificar si el profesor existe (si se proporciona)
      if (profesor_idprofesor) {
        const profesorResult = await query(
          'SELECT * FROM Profesor WHERE idProfesor = $1',
          [profesor_idprofesor]
        );
        
        if (profesorResult.rows.length === 0) {
          return res.status(404).json({ message: 'Profesor no encontrado' });
        }
      }
      
      // Crear la materia
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
      
      return res.status(201).json({
        message: 'Materia creada correctamente',
        materia: result.rows[0]
      });
    } catch (error) {
      console.error('Error al crear materia:', error);
      return res.status(500).json({ 
        message: 'Error al crear materia',
        error: error.message 
      });
    }
  }

  /**
   * Actualiza una materia existente
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async updateMateria(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { id } = req.params;
      const { 
        curso_idcurso,
        profesor_idprofesor,
        nomb_materia,
        descripcion_materia
      } = req.body;
      
      // Verificar si la materia existe
      const materiaResult = await query(
        'SELECT * FROM Materia WHERE idMateria = $1',
        [id]
      );
      
      if (materiaResult.rows.length === 0) {
        return res.status(404).json({ message: 'Materia no encontrada' });
      }
      
      // Verificar si el curso existe (si se proporciona)
      if (curso_idcurso) {
        const cursoResult = await query(
          'SELECT * FROM Curso WHERE idCurso = $1',
          [curso_idcurso]
        );
        
        if (cursoResult.rows.length === 0) {
          return res.status(404).json({ message: 'Curso no encontrado' });
        }
      }
      
      // Verificar si el profesor existe (si se proporciona)
      if (profesor_idprofesor) {
        const profesorResult = await query(
          'SELECT * FROM Profesor WHERE idProfesor = $1',
          [profesor_idprofesor]
        );
        
        if (profesorResult.rows.length === 0) {
          return res.status(404).json({ message: 'Profesor no encontrado' });
        }
      }
      
      // Actualizar la materia
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
      
      return res.status(200).json({
        message: 'Materia actualizada correctamente',
        materia: result.rows[0]
      });
    } catch (error) {
      console.error('Error al actualizar materia:', error);
      return res.status(500).json({ 
        message: 'Error al actualizar materia',
        error: error.message 
      });
    }
  }

  /**
   * Elimina una materia
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async deleteMateria(req, res) {
    try {
      const { id } = req.params;
      
      // Verificar si la materia existe
      const materiaResult = await query(
        'SELECT * FROM Materia WHERE idMateria = $1',
        [id]
      );
      
      if (materiaResult.rows.length === 0) {
        return res.status(404).json({ message: 'Materia no encontrada' });
      }
      
      // Verificar si hay recursos, tareas, calificaciones o asistencias relacionadas
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
        return res.status(400).json({ 
          message: 'No se puede eliminar la materia porque tiene registros relacionados',
          dependencias
        });
      }
      
      // Eliminar la materia
      await query('DELETE FROM Materia WHERE idMateria = $1', [id]);
      
      return res.status(200).json({
        message: 'Materia eliminada correctamente'
      });
    } catch (error) {
      console.error('Error al eliminar materia:', error);
      return res.status(500).json({ 
        message: 'Error al eliminar materia',
        error: error.message 
      });
    }
  }

  /**
   * Obtiene las materias de un curso
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async getMateriasByCurso(req, res) {
    try {
      const { cursoId } = req.params;
      
      // Verificar si el curso existe
      const cursoResult = await query(
        'SELECT * FROM Curso WHERE idCurso = $1',
        [cursoId]
      );
      
      if (cursoResult.rows.length === 0) {
        return res.status(404).json({ message: 'Curso no encontrado' });
      }
      
      // Obtener materias del curso
      const materiasResult = await query(`
        SELECT m.*, p.nomb_prof, p.ape_prof 
        FROM Materia m
        LEFT JOIN Profesor p ON m.profesor_idprofesor = p.idProfesor
        WHERE m.curso_idcurso = $1
        ORDER BY m.nomb_materia
      `, [cursoId]);
      
      return res.status(200).json({
        message: 'Materias obtenidas correctamente',
        curso: cursoResult.rows[0],
        materias: materiasResult.rows
      });
    } catch (error) {
      console.error('Error al obtener materias por curso:', error);
      return res.status(500).json({ 
        message: 'Error al obtener materias por curso',
        error: error.message 
      });
    }
  }

  /**
   * Obtiene las materias asignadas a un profesor
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async getMateriasByProfesor(req, res) {
    try {
      const { profesorId } = req.params;
      
      // Verificar si el profesor existe
      const profesorResult = await query(
        'SELECT * FROM Profesor WHERE idProfesor = $1',
        [profesorId]
      );
      
      if (profesorResult.rows.length === 0) {
        return res.status(404).json({ message: 'Profesor no encontrado' });
      }
      
      // Obtener materias asignadas al profesor
      const materiasResult = await query(`
        SELECT m.*, c.nomb_curso 
        FROM Materia m
        INNER JOIN Curso c ON m.curso_idcurso = c.idCurso
        WHERE m.profesor_idprofesor = $1
        ORDER BY c.nomb_curso, m.nomb_materia
      `, [profesorId]);
      
      return res.status(200).json({
        message: 'Materias obtenidas correctamente',
        profesor: profesorResult.rows[0],
        materias: materiasResult.rows
      });
    } catch (error) {
      console.error('Error al obtener materias por profesor:', error);
      return res.status(500).json({ 
        message: 'Error al obtener materias por profesor',
        error: error.message 
      });
    }
  }

  /**
   * Asigna un profesor a una materia
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async asignarProfesor(req, res) {
    try {
      const { materiaId, profesorId } = req.params;
      
      // Verificar si la materia existe
      const materiaResult = await query(
        'SELECT * FROM Materia WHERE idMateria = $1',
        [materiaId]
      );
      
      if (materiaResult.rows.length === 0) {
        return res.status(404).json({ message: 'Materia no encontrada' });
      }
      
      // Verificar si el profesor existe
      const profesorResult = await query(
        'SELECT * FROM Profesor WHERE idProfesor = $1',
        [profesorId]
      );
      
      if (profesorResult.rows.length === 0) {
        return res.status(404).json({ message: 'Profesor no encontrado' });
      }
      
      // Asignar profesor a la materia
      const result = await query(`
        UPDATE Materia 
        SET profesor_idprofesor = $1
        WHERE idMateria = $2
        RETURNING *
      `, [profesorId, materiaId]);
      
      return res.status(200).json({
        message: 'Profesor asignado correctamente',
        materia: result.rows[0]
      });
    } catch (error) {
      console.error('Error al asignar profesor:', error);
      return res.status(500).json({ 
        message: 'Error al asignar profesor',
        error: error.message 
      });
    }
  }

  /**
   * Desasigna el profesor de una materia
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async desasignarProfesor(req, res) {
    try {
      const { id } = req.params;
      
      // Verificar si la materia existe
      const materiaResult = await query(
        'SELECT * FROM Materia WHERE idMateria = $1',
        [id]
      );
      
      if (materiaResult.rows.length === 0) {
        return res.status(404).json({ message: 'Materia no encontrada' });
      }
      
      // Desasignar profesor de la materia
      const result = await query(`
        UPDATE Materia 
        SET profesor_idprofesor = NULL
        WHERE idMateria = $1
        RETURNING *
      `, [id]);
      
      return res.status(200).json({
        message: 'Profesor desasignado correctamente',
        materia: result.rows[0]
      });
    } catch (error) {
      console.error('Error al desasignar profesor:', error);
      return res.status(500).json({ 
        message: 'Error al desasignar profesor',
        error: error.message 
      });
    }
  }

  /**
   * Busca materias por nombre o descripción
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async searchMaterias(req, res) {
    try {
      const { q } = req.query;
      
      if (!q) {
        return res.status(400).json({ message: 'Debe proporcionar un término de búsqueda' });
      }
      
      const result = await query(`
        SELECT m.*, c.nomb_curso, p.nomb_prof, p.ape_prof 
        FROM Materia m
        INNER JOIN Curso c ON m.curso_idcurso = c.idCurso
        LEFT JOIN Profesor p ON m.profesor_idprofesor = p.idProfesor
        WHERE 
          m.nomb_materia ILIKE $1 OR 
          m.descripcion_materia ILIKE $1
        ORDER BY c.nomb_curso, m.nomb_materia
      `, [`%${q}%`]);
      
      return res.status(200).json({
        message: 'Búsqueda realizada correctamente',
        materias: result.rows
      });
    } catch (error) {
      console.error('Error al buscar materias:', error);
      return res.status(500).json({ 
        message: 'Error al buscar materias',
        error: error.message 
      });
    }
  }
}

module.exports = MateriaController;