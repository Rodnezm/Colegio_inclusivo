// src/controllers/calificacion.controller.js
const { validationResult } = require('express-validator');
const CalificacionModel = require('../models/calificacion.model');
const ProfesorModel = require('../models/profesor.model');

/**
 * Controlador para gestionar las calificaciones
 */
class CalificacionController {
  /**
   * Obtiene las calificaciones de un estudiante específico
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async getCalificacionesByEstudiante(req, res) {
    try {
      const { id } = req.params; // ID del estudiante
      
      const calificaciones = await CalificacionModel.getByEstudiante(id);
      
      // Agrupar por materia para mejor visualización
      const calificacionesPorMateria = {};
      
      calificaciones.forEach(calificacion => {
        if (!calificacionesPorMateria[calificacion.materia_idmateria]) {
          calificacionesPorMateria[calificacion.materia_idmateria] = {
            idMateria: calificacion.materia_idmateria,
            nombre: calificacion.nomb_materia,
            profesor: `${calificacion.nomb_prof || ''} ${calificacion.ape_prof || ''}`.trim(),
            calificaciones: []
          };
        }
        
        calificacionesPorMateria[calificacion.materia_idmateria].calificaciones.push({
          idCalificacion: calificacion.idcalificacion,
          valor: calificacion.valor_calif,
          tipo: calificacion.tipo_calif,
          fecha: calificacion.fecha_calif
        });
      });
      
      // Calcular promedios para cada materia
      for (const materiaId in calificacionesPorMateria) {
        const califs = calificacionesPorMateria[materiaId].calificaciones;
        const sum = califs.reduce((acc, c) => acc + parseFloat(c.valor), 0);
        calificacionesPorMateria[materiaId].promedio = califs.length ? 
          Math.round((sum / califs.length) * 100) / 100 : 0;
      }
      
      return res.status(200).json({
        message: 'Calificaciones obtenidas correctamente',
        calificacionesPorMateria: Object.values(calificacionesPorMateria)
      });
    } catch (error) {
      console.error('Error al obtener calificaciones:', error);
      return res.status(500).json({ 
        message: 'Error al obtener calificaciones',
        error: error.message 
      });
    }
  }

  /**
   * Obtiene las calificaciones por materia
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async getCalificacionesByMateria(req, res) {
    try {
      const { id } = req.params; // ID de la materia
      
      // Verificar si el profesor está asignado a esta materia (si es profesor)
      if (req.user.tipo_user === 'profesor') {
        const profesor = await ProfesorModel.getByUsuarioId(req.user.id);
        if (!profesor) {
          return res.status(403).json({ message: 'No tienes permisos para ver estas calificaciones' });
        }
        
        const isAsignado = await CalificacionModel.isProfesorAsignado(profesor.idprofesor, id);
        if (!isAsignado) {
          return res.status(403).json({ message: 'No estás asignado a esta materia' });
        }
      }
      
      const calificaciones = await CalificacionModel.getByMateria(id);
      
      // Agrupar por estudiante para mejor visualización
      const calificacionesPorEstudiante = {};
      
      calificaciones.forEach(calificacion => {
        if (!calificacionesPorEstudiante[calificacion.estudiante_idestudiante]) {
          calificacionesPorEstudiante[calificacion.estudiante_idestudiante] = {
            idEstudiante: calificacion.estudiante_idestudiante,
            nombre: `${calificacion.nomb_est} ${calificacion.ape_est}`,
            ci: calificacion.ci_est,
            calificaciones: []
          };
        }
        
        calificacionesPorEstudiante[calificacion.estudiante_idestudiante].calificaciones.push({
          idCalificacion: calificacion.idcalificacion,
          valor: calificacion.valor_calif,
          tipo: calificacion.tipo_calif,
          fecha: calificacion.fecha_calif
        });
      });
      
      // Calcular promedios para cada estudiante
      for (const estudianteId in calificacionesPorEstudiante) {
        const califs = calificacionesPorEstudiante[estudianteId].calificaciones;
        const sum = califs.reduce((acc, c) => acc + parseFloat(c.valor), 0);
        calificacionesPorEstudiante[estudianteId].promedio = califs.length ? 
          Math.round((sum / califs.length) * 100) / 100 : 0;
      }
      
      return res.status(200).json({
        message: 'Calificaciones obtenidas correctamente',
        calificacionesPorEstudiante: Object.values(calificacionesPorEstudiante)
      });
    } catch (error) {
      console.error('Error al obtener calificaciones por materia:', error);
      return res.status(500).json({ 
        message: 'Error al obtener calificaciones por materia',
        error: error.message 
      });
    }
  }

  /**
   * Registra una nueva calificación
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async createCalificacion(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { 
        materia_idmateria,
        estudiante_idestudiante,
        valor_calif,
        tipo_calif
      } = req.body;
      
      // Verificar si el profesor está asignado a esta materia (si es profesor)
      if (req.user.tipo_user === 'profesor') {
        const profesor = await ProfesorModel.getByUsuarioId(req.user.id);
        if (!profesor) {
          return res.status(403).json({ message: 'No tienes permisos para registrar calificaciones' });
        }
        
        const isAsignado = await CalificacionModel.isProfesorAsignado(profesor.idprofesor, materia_idmateria);
        if (!isAsignado) {
          return res.status(403).json({ message: 'No estás asignado a esta materia' });
        }
      }
      
      const calificacion = await CalificacionModel.create({
        materia_idmateria,
        estudiante_idestudiante,
        valor_calif,
        tipo_calif
      });
      
      return res.status(201).json({
        message: 'Calificación registrada correctamente',
        calificacion
      });
    } catch (error) {
      console.error('Error al registrar calificación:', error);
      return res.status(500).json({ 
        message: 'Error al registrar calificación',
        error: error.message 
      });
    }
  }

  /**
   * Actualiza una calificación existente
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async updateCalificacion(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { id } = req.params;
      const { valor_calif, tipo_calif } = req.body;
      
      // Verificar si la calificación existe
      const calificacionExistente = await CalificacionModel.getById(id);
      if (!calificacionExistente) {
        return res.status(404).json({ message: 'Calificación no encontrada' });
      }
      
      // Verificar si el profesor está asignado a esta materia (si es profesor)
      if (req.user.tipo_user === 'profesor') {
        const profesor = await ProfesorModel.getByUsuarioId(req.user.id);
        if (!profesor) {
          return res.status(403).json({ message: 'No tienes permisos para actualizar calificaciones' });
        }
        
        const isAsignado = await CalificacionModel.isProfesorAsignado(
          profesor.idprofesor, 
          calificacionExistente.materia_idmateria
        );
        
        if (!isAsignado) {
          return res.status(403).json({ message: 'No estás asignado a esta materia' });
        }
      }
      
      const calificacion = await CalificacionModel.update(id, {
        valor_calif,
        tipo_calif
      });
      
      return res.status(200).json({
        message: 'Calificación actualizada correctamente',
        calificacion
      });
    } catch (error) {
      console.error('Error al actualizar calificación:', error);
      return res.status(500).json({ 
        message: 'Error al actualizar calificación',
        error: error.message 
      });
    }
  }

  /**
   * Elimina una calificación
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async deleteCalificacion(req, res) {
    try {
      const { id } = req.params;
      
      // Verificar si la calificación existe
      const calificacionExistente = await CalificacionModel.getById(id);
      if (!calificacionExistente) {
        return res.status(404).json({ message: 'Calificación no encontrada' });
      }
      
      const resultado = await CalificacionModel.delete(id);
      
      if (!resultado) {
        return res.status(500).json({ message: 'No se pudo eliminar la calificación' });
      }
      
      return res.status(200).json({
        message: 'Calificación eliminada correctamente'
      });
    } catch (error) {
      console.error('Error al eliminar calificación:', error);
      return res.status(500).json({ 
        message: 'Error al eliminar calificación',
        error: error.message 
      });
    }
  }

  /**
   * Obtiene un reporte completo de calificaciones por materia
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async getReportePorMateria(req, res) {
    try {
      const { id } = req.params; // ID de la materia
      
      // Verificar si el profesor está asignado a esta materia (si es profesor)
      if (req.user.tipo_user === 'profesor') {
        const profesor = await ProfesorModel.getByUsuarioId(req.user.id);
        if (!profesor) {
          return res.status(403).json({ message: 'No tienes permisos para ver estos reportes' });
        }
        
        const isAsignado = await CalificacionModel.isProfesorAsignado(profesor.idprofesor, id);
        if (!isAsignado) {
          return res.status(403).json({ message: 'No estás asignado a esta materia' });
        }
      }
      
      const reporte = await CalificacionModel.getReporteMateria(id);
      
      return res.status(200).json({
        message: 'Reporte obtenido correctamente',
        reporte
      });
    } catch (error) {
      console.error('Error al obtener reporte de calificaciones:', error);
      return res.status(500).json({ 
        message: 'Error al obtener reporte de calificaciones',
        error: error.message 
      });
    }
  }

  /**
   * Obtiene el promedio de calificaciones de un estudiante en una materia
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async getPromedio(req, res) {
    try {
      const { estudianteId, materiaId } = req.params;
      
      const promedio = await CalificacionModel.getPromedio(estudianteId, materiaId);
      
      return res.status(200).json({
        message: 'Promedio obtenido correctamente',
        promedio
      });
    } catch (error) {
      console.error('Error al obtener promedio:', error);
      return res.status(500).json({ 
        message: 'Error al obtener promedio',
        error: error.message 
      });
    }
  }
}

module.exports = CalificacionController;