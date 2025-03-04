const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const UsuarioModel = require('../models/user.model');
const ProfesorModel = require('../models/profesor.model');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

/**
 * Controlador para gestionar los profesores
 */
class ProfesorController {
  /**
   * Obtiene todos los profesores
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async getAllProfesor(req, res) {
    try {
      const profesores = await ProfesorModel.getAll();
      
      return res.status(200).json({
        message: 'Lista de profesores obtenida correctamente',
        profesores
      });
    } catch (error) {
      console.error('Error al obtener profesores:', error);
      return res.status(500).json({
        message: 'Error al obtener profesores',
        error: error.message
      });
    }
  }
  
  /**
   * Obtiene un profesor por su ID
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async getProfesorById(req, res) {
    try {
      const { id } = req.params;
      
      const profesor = await ProfesorModel.getById(id);
      
      if (!profesor) {
        return res.status(404).json({ message: 'Profesor no encontrado' });
      }
      
      return res.status(200).json({
        message: 'Profesor obtenido correctamente',
        profesor
      });
    } catch (error) {
      console.error('Error al obtener profesor:', error);
      return res.status(500).json({
        message: 'Error al obtener profesor',
        error: error.message
      });
    }
  }
  
  /**
   * Crea un nuevo profesor con su usuario asociado
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async createProfesor(req, res) {
    try {
      // Validar inputs
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { 
        nomb_user, password, tipo_user = 'profesor',
        nomb_prof, ape_prof, ci_prof, direccion_prof, fecha_nac_prof,
        especialidad, email, telef1_prof, telef2_prof
      } = req.body;
      
      // Iniciar transacción
      await query('BEGIN');
      
      try {
        // Verificar si el nombre de usuario ya existe
        const userExists = await UsuarioModel.findByUsername(nomb_user);
        if (userExists) {
          await query('ROLLBACK');
          return res.status(400).json({ message: 'El nombre de usuario ya está registrado' });
        }
        
        // Crear usuario
        const hashedPassword = await bcrypt.hash(password || '123456', 10); // Password por defecto si no se proporciona
        
        const usuario = await UsuarioModel.create({
          nomb_user,
          contraseña_user: hashedPassword,
          tipo_user
        });
        
        // Crear profesor
        const profesor = await ProfesorModel.create({
          nomb_prof, 
          ape_prof, 
          ci_prof, 
          direccion_prof, 
          fecha_nac_prof,
          especialidad, 
          email, 
          telef1_prof, 
          telef2_prof
        }, usuario.idUsuario);
        
        // Crear configuración de accesibilidad por defecto
        await query(
          `INSERT INTO Conf_accesibilidad (
            Usuario_idUsuario,
            subtitulos_activados,
            alto_contraste,
            tamaño_letra,
            velocidad_reproduccion
          ) VALUES ($1, $2, $3, $4, $5)`,
          [
            usuario.idUsuario,
            false,
            false,
            16,
            1.0
          ]
        );
        
        // Confirmar transacción
        await query('COMMIT');
        
        // Generar token JWT si es necesario
        const token = jwt.sign(
          { id: usuario.idUsuario, nomb_user: usuario.nomb_user, tipo_user: usuario.tipo_user },
          process.env.JWT_SECRET,
          { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );
        
        return res.status(201).json({
          message: 'Profesor creado correctamente',
          profesor,
          usuario: {
            id: usuario.idUsuario,
            nomb_user: usuario.nomb_user,
            tipo_user: usuario.tipo_user
          },
          token
        });
      } catch (error) {
        // Revertir transacción en caso de error
        await query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Error al crear profesor:', error);
      return res.status(500).json({
        message: 'Error al crear profesor',
        error: error.message
      });
    }
  }
  
  /**
   * Actualiza un profesor existente
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async updateProfesor(req, res) {
    try {
      const { id } = req.params;
      const { 
        nomb_prof, ape_prof, ci_prof, direccion_prof, fecha_nac_prof,
        especialidad, email, telef1_prof, telef2_prof
      } = req.body;
      
      // Verificar si el profesor existe
      const profesorExistente = await ProfesorModel.getById(id);
      if (!profesorExistente) {
        return res.status(404).json({ message: 'Profesor no encontrado' });
      }
      
      // Datos a actualizar
      const datosActualizados = {
        nomb_prof,
        ape_prof,
        ci_prof,
        direccion_prof,
        fecha_nac_prof,
        especialidad,
        email,
        telef1_prof,
        telef2_prof
      };
      
      // Eliminar propiedades undefined
      Object.keys(datosActualizados).forEach(key => {
        if (datosActualizados[key] === undefined) {
          delete datosActualizados[key];
        }
      });
      
      // Actualizar profesor
      const profesorActualizado = await ProfesorModel.update(id, datosActualizados);
      
      return res.status(200).json({
        message: 'Profesor actualizado correctamente',
        profesor: profesorActualizado
      });
    } catch (error) {
      console.error('Error al actualizar profesor:', error);
      return res.status(500).json({
        message: 'Error al actualizar profesor',
        error: error.message
      });
    }
  }
  
  /**
   * Elimina un profesor existente
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async deleteProfesor(req, res) {
    try {
      const { id } = req.params;
      
      // Verificar si el profesor existe
      const profesorExistente = await ProfesorModel.getById(id);
      if (!profesorExistente) {
        return res.status(404).json({ message: 'Profesor no encontrado' });
      }
      
      // Eliminar profesor
      const resultado = await ProfesorModel.delete(id);
      
      if (!resultado) {
        return res.status(500).json({ message: 'Error al eliminar profesor' });
      }
      
      return res.status(200).json({
        message: 'Profesor eliminado correctamente'
      });
    } catch (error) {
      console.error('Error al eliminar profesor:', error);
      return res.status(500).json({
        message: 'Error al eliminar profesor',
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
      const { id } = req.params;
      
      // Verificar si el profesor existe
      const profesorExistente = await ProfesorModel.getById(id);
      if (!profesorExistente) {
        return res.status(404).json({ message: 'Profesor no encontrado' });
      }
      
      // Obtener materias
      const materias = await ProfesorModel.getMaterias(id);
      
      return res.status(200).json({
        message: 'Materias obtenidas correctamente',
        materias
      });
    } catch (error) {
      console.error('Error al obtener materias del profesor:', error);
      return res.status(500).json({
        message: 'Error al obtener materias del profesor',
        error: error.message
      });
    }
  }
  
  /**
   * Asigna materias a un profesor
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async asignarMaterias(req, res) {
    try {
      const { id } = req.params;
      const { materias } = req.body;
      
      // Validar entrada
      if (!materias || !Array.isArray(materias) || materias.length === 0) {
        return res.status(400).json({ message: 'Debe proporcionar un array de IDs de materias' });
      }
      
      // Verificar si el profesor existe
      const profesorExistente = await ProfesorModel.getById(id);
      if (!profesorExistente) {
        return res.status(404).json({ message: 'Profesor no encontrado' });
      }
      
      // Asignar materias
      const resultado = await ProfesorModel.asignarMaterias(id, materias);
      
      if (!resultado) {
        return res.status(500).json({ message: 'Error al asignar materias' });
      }
      
      return res.status(200).json({
        message: 'Materias asignadas correctamente'
      });
    } catch (error) {
      console.error('Error al asignar materias:', error);
      return res.status(500).json({
        message: 'Error al asignar materias',
        error: error.message
      });
    }
  }
  
  /**
   * Desasigna materias de un profesor
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async desasignarMaterias(req, res) {
    try {
      const { id } = req.params;
      const { materias } = req.body;
      
      // Validar entrada
      if (!materias || !Array.isArray(materias) || materias.length === 0) {
        return res.status(400).json({ message: 'Debe proporcionar un array de IDs de materias' });
      }
      
      // Verificar si el profesor existe
      const profesorExistente = await ProfesorModel.getById(id);
      if (!profesorExistente) {
        return res.status(404).json({ message: 'Profesor no encontrado' });
      }
      
      // Desasignar materias
      const resultado = await ProfesorModel.desasignarMaterias(id, materias);
      
      if (!resultado) {
        return res.status(500).json({ message: 'Error al desasignar materias' });
      }
      
      return res.status(200).json({
        message: 'Materias desasignadas correctamente'
      });
    } catch (error) {
      console.error('Error al desasignar materias:', error);
      return res.status(500).json({
        message: 'Error al desasignar materias',
        error: error.message
      });
    }
  }
  
  /**
   * Obtiene los estudiantes asignados a un profesor
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async getEstudiantesByProfesor(req, res) {
    try {
      const { id } = req.params;
      
      // Verificar si el profesor existe
      const profesorExistente = await ProfesorModel.getById(id);
      if (!profesorExistente) {
        return res.status(404).json({ message: 'Profesor no encontrado' });
      }
      
      // Obtener estudiantes
      const estudiantes = await ProfesorModel.getEstudiantes(id);
      
      return res.status(200).json({
        message: 'Estudiantes obtenidos correctamente',
        estudiantes
      });
    } catch (error) {
      console.error('Error al obtener estudiantes del profesor:', error);
      return res.status(500).json({
        message: 'Error al obtener estudiantes del profesor',
        error: error.message
      });
    }
  }
  
  /**
   * Busca profesores por término (nombre, apellido, especialidad)
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async buscarProfesores(req, res) {
    try {
      const { termino } = req.query;
      
      if (!termino) {
        return res.status(400).json({ message: 'Debe proporcionar un término de búsqueda' });
      }
      
      const profesores = await ProfesorModel.buscar(termino);
      
      return res.status(200).json({
        message: 'Búsqueda realizada correctamente',
        profesores
      });
    } catch (error) {
      console.error('Error al buscar profesores:', error);
      return res.status(500).json({
        message: 'Error al buscar profesores',
        error: error.message
      });
    }
  }
  
  /**
   * Obtiene profesores por especialidad
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async getProfesoresPorEspecialidad(req, res) {
    try {
      const { especialidad } = req.params;
      
      const profesores = await ProfesorModel.getPorEspecialidad(especialidad);
      
      return res.status(200).json({
        message: 'Profesores por especialidad obtenidos correctamente',
        profesores
      });
    } catch (error) {
      console.error('Error al obtener profesores por especialidad:', error);
      return res.status(500).json({
        message: 'Error al obtener profesores por especialidad',
        error: error.message
      });
    }
  }
  
  /**
   * Obtiene estadísticas de un profesor
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async getEstadisticasProfesor(req, res) {
    try {
      const { id } = req.params;
      
      // Verificar si el profesor existe
      const profesorExistente = await ProfesorModel.getById(id);
      if (!profesorExistente) {
        return res.status(404).json({ message: 'Profesor no encontrado' });
      }
      
      // Obtener estadísticas
      const estadisticas = await ProfesorModel.getEstadisticas(id);
      
      return res.status(200).json({
        message: 'Estadísticas obtenidas correctamente',
        estadisticas
      });
    } catch (error) {
      console.error('Error al obtener estadísticas del profesor:', error);
      return res.status(500).json({
        message: 'Error al obtener estadísticas del profesor',
        error: error.message
      });
    }
  }
}

module.exports = ProfesorController;