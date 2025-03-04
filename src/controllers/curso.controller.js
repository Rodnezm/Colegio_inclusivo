// controllers/curso.controller.js
const { validationResult } = require('express-validator');
const CursoModel = require('../models/curso.model');

/**
 * Controlador para gestionar los cursos
 */
class CursoController {
  /**
   * Obtiene todos los cursos
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async getAllCursos(req, res) {
    try {
      const cursos = await CursoModel.getAll();
      
      return res.status(200).json({
        message: 'Lista de cursos obtenida correctamente',
        cursos
      });
    } catch (error) {
      console.error('Error al obtener cursos:', error);
      return res.status(500).json({
        message: 'Error al obtener cursos',
        error: error.message
      });
    }
  }
  
  /**
   * Obtiene un curso por su ID
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async getCursoById(req, res) {
    try {
      const { id } = req.params;
      
      const curso = await CursoModel.getByIdWithRelations(id);
      
      if (!curso) {
        return res.status(404).json({ message: 'Curso no encontrado' });
      }
      
      return res.status(200).json({
        message: 'Curso obtenido correctamente',
        curso
      });
    } catch (error) {
      console.error('Error al obtener curso:', error);
      return res.status(500).json({
        message: 'Error al obtener curso',
        error: error.message
      });
    }
  }
  
  /**
   * Crea un nuevo curso
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async createCurso(req, res) {
    try {
      // Validar inputs
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { nomb_curso, año, capacidad } = req.body;
      
      // Crear curso
      const curso = await CursoModel.create({
        nomb_curso,
        año,
        capacidad
      });
      
      return res.status(201).json({
        message: 'Curso creado correctamente',
        curso
      });
    } catch (error) {
      console.error('Error al crear curso:', error);
      return res.status(500).json({
        message: 'Error al crear curso',
        error: error.message
      });
    }
  }
  
  /**
   * Actualiza un curso existente
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async updateCurso(req, res) {
    try {
      const { id } = req.params;
      const { nomb_curso, año, capacidad } = req.body;
      
      // Verificar si el curso existe
      const cursoExistente = await CursoModel.getById(id);
      if (!cursoExistente) {
        return res.status(404).json({ message: 'Curso no encontrado' });
      }
      
      // Datos a actualizar
      const datosActualizados = {
        nomb_curso,
        año,
        capacidad
      };
      
      // Eliminar propiedades undefined
      Object.keys(datosActualizados).forEach(key => {
        if (datosActualizados[key] === undefined) {
          delete datosActualizados[key];
        }
      });
      
      // Actualizar curso
      const cursoActualizado = await CursoModel.update(id, datosActualizados);
      
      return res.status(200).json({
        message: 'Curso actualizado correctamente',
        curso: cursoActualizado
      });
    } catch (error) {
      console.error('Error al actualizar curso:', error);
      return res.status(500).json({
        message: 'Error al actualizar curso',
        error: error.message
      });
    }
  }
  
  /**
   * Elimina un curso existente
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async deleteCurso(req, res) {
    try {
      const { id } = req.params;
      
      // Verificar si el curso existe
      const cursoExistente = await CursoModel.getById(id);
      if (!cursoExistente) {
        return res.status(404).json({ message: 'Curso no encontrado' });
      }
      
      try {
        // Eliminar curso
        await CursoModel.delete(id);
        
        return res.status(200).json({
          message: 'Curso eliminado correctamente'
        });
      } catch (error) {
        // Capturar errores específicos del modelo
        return res.status(400).json({ message: error.message });
      }
    } catch (error) {
      console.error('Error al eliminar curso:', error);
      return res.status(500).json({
        message: 'Error al eliminar curso',
        error: error.message
      });
    }
  }
  
  /**
   * Asigna estudiantes a un curso
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async assignStudentsToCourse(req, res) {
    try {
      const { id } = req.params;
      const { estudiantes } = req.body; // Array de IDs de estudiantes
      
      // Validar inputs
      if (!estudiantes || !Array.isArray(estudiantes) || estudiantes.length === 0) {
        return res.status(400).json({ message: 'Debe proporcionar un array de IDs de estudiantes' });
      }
      
      // Verificar si el curso existe
      const cursoExistente = await CursoModel.getById(id);
      if (!cursoExistente) {
        return res.status(404).json({ message: 'Curso no encontrado' });
      }
      
      // Verificar capacidad
      const capacidadInfo = await CursoModel.checkCapacity(id);
      if (capacidadInfo.estaLleno || capacidadInfo.disponible < estudiantes.length) {
        return res.status(400).json({ 
          message: 'El curso no tiene capacidad suficiente para los estudiantes seleccionados',
          capacidad: capacidadInfo
        });
      }
      
      // Asignar estudiantes
      await CursoModel.assignStudents(id, estudiantes);
      
      return res.status(200).json({ 
        message: `${estudiantes.length} estudiantes asignados al curso correctamente` 
      });
    } catch (error) {
      console.error('Error al asignar estudiantes al curso:', error);
      return res.status(500).json({
        message: 'Error al asignar estudiantes al curso',
        error: error.message
      });
    }
  }
  
  /**
   * Obtiene estudiantes de un curso
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async getStudentsByCourse(req, res) {
    try {
      const { id } = req.params;
      
      // Verificar si el curso existe
      const cursoExistente = await CursoModel.getById(id);
      if (!cursoExistente) {
        return res.status(404).json({ message: 'Curso no encontrado' });
      }
      
      // Obtener estudiantes
      const estudiantes = await CursoModel.getStudents(id);
      
      return res.status(200).json({
        message: 'Estudiantes obtenidos correctamente',
        estudiantes
      });
    } catch (error) {
      console.error('Error al obtener estudiantes del curso:', error);
      return res.status(500).json({
        message: 'Error al obtener estudiantes del curso',
        error: error.message
      });
    }
  }
  
  /**
   * Obtiene materias de un curso
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async getMateriasByCourse(req, res) {
    try {
      const { id } = req.params;
      
      // Verificar si el curso existe
      const cursoExistente = await CursoModel.getById(id);
      if (!cursoExistente) {
        return res.status(404).json({ message: 'Curso no encontrado' });
      }
      
      // Obtener materias
      const materias = await CursoModel.getMaterias(id);
      
      return res.status(200).json({
        message: 'Materias obtenidas correctamente',
        materias
      });
    } catch (error) {
      console.error('Error al obtener materias del curso:', error);
      return res.status(500).json({
        message: 'Error al obtener materias del curso',
        error: error.message
      });
    }
  }
  
  /**
   * Busca cursos por término
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async searchCursos(req, res) {
    try {
      const { termino } = req.query;
      
      if (!termino) {
        return res.status(400).json({ message: 'Debe proporcionar un término de búsqueda' });
      }
      
      const cursos = await CursoModel.search(termino);
      
      return res.status(200).json({
        message: 'Búsqueda realizada correctamente',
        cursos
      });
    } catch (error) {
      console.error('Error al buscar cursos:', error);
      return res.status(500).json({
        message: 'Error al buscar cursos',
        error: error.message
      });
    }
  }
  
  /**
   * Obtiene cursos por año
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async getCursosByYear(req, res) {
    try {
      const { año } = req.params;
      
      const cursos = await CursoModel.getByYear(año);
      
      return res.status(200).json({
        message: 'Cursos por año obtenidos correctamente',
        cursos
      });
    } catch (error) {
      console.error('Error al obtener cursos por año:', error);
      return res.status(500).json({
        message: 'Error al obtener cursos por año',
        error: error.message
      });
    }
  }
  
  /**
   * Verifica capacidad de un curso
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async checkCourseCapacity(req, res) {
    try {
      const { id } = req.params;
      
      // Verificar si el curso existe
      const cursoExistente = await CursoModel.getById(id);
      if (!cursoExistente) {
        return res.status(404).json({ message: 'Curso no encontrado' });
      }
      
      // Verificar capacidad
      const capacidadInfo = await CursoModel.checkCapacity(id);
      
      return res.status(200).json({
        message: 'Información de capacidad obtenida correctamente',
        capacidad: capacidadInfo
      });
    } catch (error) {
      console.error('Error al verificar capacidad del curso:', error);
      return res.status(500).json({
        message: 'Error al verificar capacidad del curso',
        error: error.message
      });
    }
  }
}

module.exports = CursoController;