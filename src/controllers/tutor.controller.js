const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const TutorModel = require('../models/tutor.model');
const UsuarioModel = require('../models/user.model');

/**
 * Controlador para gestionar los tutores
 */
class TutorController {
  /**
   * Obtiene todos los tutores
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async getAllTutores(req, res) {
    try {
      const tutores = await TutorModel.getAll();
      
      return res.status(200).json({
        message: 'Lista de tutores obtenida correctamente',
        tutores
      });
    } catch (error) {
      console.error('Error al obtener tutores:', error);
      return res.status(500).json({
        message: 'Error al obtener tutores',
        error: error.message
      });
    }
  }
  
  /**
   * Obtiene un tutor por su ID
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async getTutorById(req, res) {
    try {
      const { id } = req.params;
      
      const tutor = await TutorModel.getById(id);
      
      if (!tutor) {
        return res.status(404).json({ message: 'Tutor no encontrado' });
      }
      
      return res.status(200).json({
        message: 'Tutor obtenido correctamente',
        tutor
      });
    } catch (error) {
      console.error('Error al obtener tutor:', error);
      return res.status(500).json({
        message: 'Error al obtener tutor',
        error: error.message
      });
    }
  }
  
  /**
   * Crea un nuevo tutor sin usuario asociado
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async createTutor(req, res) {
    try {
      // Validar inputs
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { 
        nomb_tut, ape_tut, ci_tu, direc_tut, fech_nac, 
        telef, telef2_tut, email_tut, ocupacion_tut,
        es_contacto_emergencia, parentesco, es_resp_financiero, vive_c_estudiante
      } = req.body;
      
      // Crear tutor
      const tutor = await TutorModel.create({
        nomb_tut, ape_tut, ci_tu, direc_tut, fech_nac, 
        telef, telef2_tut, email_tut, ocupacion_tut,
        es_contacto_emergencia, parentesco, es_resp_financiero, vive_c_estudiante
      });
      
      return res.status(201).json({
        message: 'Tutor creado correctamente',
        tutor
      });
    } catch (error) {
      console.error('Error al crear tutor:', error);
      return res.status(500).json({
        message: 'Error al crear tutor',
        error: error.message
      });
    }
  }
  
  /**
   * Crea un nuevo tutor con usuario asociado
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async createTutorWithUser(req, res) {
    try {
      // Validar inputs
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { 
        nomb_user, password, 
        nomb_tut, ape_tut, ci_tu, direc_tut, fech_nac, 
        telef, telef2_tut, email_tut, ocupacion_tut,
        es_contacto_emergencia, parentesco, es_resp_financiero, vive_c_estudiante,
        estudiantes_ids
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
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const usuario = await UsuarioModel.create({
          nomb_user,
          contraseña_user: hashedPassword,
          tipo_user: 'tutor'
        });
        
        // Crear tutor
        const tutor = await TutorModel.create({
          nomb_tut, ape_tut, ci_tu, direc_tut, fech_nac, 
          telef, telef2_tut, email_tut, ocupacion_tut,
          es_contacto_emergencia, parentesco, es_resp_financiero, vive_c_estudiante
        }, usuario.idUsuario);
        
        // Asociar estudiantes si se proporcionan IDs
        if (estudiantes_ids && Array.isArray(estudiantes_ids) && estudiantes_ids.length > 0) {
          for (const estudianteId of estudiantes_ids) {
            await query(
              'INSERT INTO Estudiante_has_Tutor (Estudiante_idEstudiante, Tutor_idTutor) VALUES ($1, $2)',
              [estudianteId, tutor.idTutor]
            );
          }
        }
        
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
          message: 'Tutor con usuario creado correctamente',
          tutor,
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
      console.error('Error al crear tutor con usuario:', error);
      return res.status(500).json({
        message: 'Error al crear tutor con usuario',
        error: error.message
      });
    }
  }
  
  /**
   * Actualiza un tutor existente
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async updateTutor(req, res) {
    try {
      const { id } = req.params;
      const { 
        nomb_tut, ape_tut, ci_tu, direc_tut, fech_nac, 
        telef, telef2_tut, email_tut, ocupacion_tut,
        es_contacto_emergencia, parentesco, es_resp_financiero, vive_c_estudiante
      } = req.body;
      
      // Verificar si el tutor existe
      const tutorExistente = await TutorModel.getById(id);
      if (!tutorExistente) {
        return res.status(404).json({ message: 'Tutor no encontrado' });
      }
      
      // Datos a actualizar
      const datosActualizados = {
        nomb_tut, ape_tut, ci_tu, direc_tut, fech_nac, 
        telef, telef2_tut, email_tut, ocupacion_tut,
        es_contacto_emergencia, parentesco, es_resp_financiero, vive_c_estudiante
      };
      
      // Eliminar propiedades undefined
      Object.keys(datosActualizados).forEach(key => {
        if (datosActualizados[key] === undefined) {
          delete datosActualizados[key];
        }
      });
      
      // Actualizar tutor
      const tutorActualizado = await TutorModel.update(id, datosActualizados);
      
      return res.status(200).json({
        message: 'Tutor actualizado correctamente',
        tutor: tutorActualizado
      });
    } catch (error) {
      console.error('Error al actualizar tutor:', error);
      return res.status(500).json({
        message: 'Error al actualizar tutor',
        error: error.message
      });
    }
  }
  
  /**
   * Elimina un tutor existente
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async deleteTutor(req, res) {
    try {
      const { id } = req.params;
      
      // Verificar si el tutor existe
      const tutorExistente = await TutorModel.getById(id);
      if (!tutorExistente) {
        return res.status(404).json({ message: 'Tutor no encontrado' });
      }
      
      // Eliminar tutor
      const resultado = await TutorModel.delete(id);
      
      if (!resultado) {
        return res.status(500).json({ message: 'Error al eliminar tutor' });
      }
      
      return res.status(200).json({
        message: 'Tutor eliminado correctamente'
      });
    } catch (error) {
      console.error('Error al eliminar tutor:', error);
      return res.status(500).json({
        message: 'Error al eliminar tutor',
        error: error.message
      });
    }
  }
  
  /**
   * Asocia un tutor con un estudiante
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async associateTutorWithEstudiante(req, res) {
    try {
      const { tutorId, estudianteId } = req.params;
      const { parentesco } = req.body;
      
      // Verificar si el tutor existe
      const tutorExistente = await TutorModel.getById(tutorId);
      if (!tutorExistente) {
        return res.status(404).json({ message: 'Tutor no encontrado' });
      }
      
      // Verificar si el estudiante existe
      const estudianteResult = await query(
        'SELECT * FROM Estudiante WHERE idEstudiante = $1',
        [estudianteId]
      );
      
      if (estudianteResult.rows.length === 0) {
        return res.status(404).json({ message: 'Estudiante no encontrado' });
      }
      
      // Verificar si ya existe la relación
      const relacionResult = await query(
        'SELECT * FROM Estudiante_has_Tutor WHERE Estudiante_idEstudiante = $1 AND Tutor_idTutor = $2',
        [estudianteId, tutorId]
      );
      
      if (relacionResult.rows.length > 0) {
        return res.status(400).json({ message: 'El tutor ya está asociado a este estudiante' });
      }
      
      // Crear la relación
      await query(
        'INSERT INTO Estudiante_has_Tutor (Estudiante_idEstudiante, Tutor_idTutor) VALUES ($1, $2)',
        [estudianteId, tutorId]
      );
      
      // Actualizar parentesco si se proporciona
      if (parentesco) {
        await TutorModel.update(tutorId, { parentesco });
      }
      
      return res.status(201).json({
        message: 'Tutor asociado al estudiante correctamente'
      });
    } catch (error) {
      console.error('Error al asociar tutor con estudiante:', error);
      return res.status(500).json({
        message: 'Error al asociar tutor con estudiante',
        error: error.message
      });
    }
  }
  
  /**
   * Desasocia un tutor de un estudiante
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async dissociateTutorFromEstudiante(req, res) {
    try {
      const { tutorId, estudianteId } = req.params;
      
      // Verificar si existe la relación
      const relacionResult = await query(
        'SELECT * FROM Estudiante_has_Tutor WHERE Estudiante_idEstudiante = $1 AND Tutor_idTutor = $2',
        [estudianteId, tutorId]
      );
      
      if (relacionResult.rows.length === 0) {
        return res.status(404).json({ message: 'No existe relación entre el tutor y el estudiante' });
      }
      
      // Eliminar la relación
      await query(
        'DELETE FROM Estudiante_has_Tutor WHERE Estudiante_idEstudiante = $1 AND Tutor_idTutor = $2',
        [estudianteId, tutorId]
      );
      
      return res.status(200).json({
        message: 'Tutor desasociado del estudiante correctamente'
      });
    } catch (error) {
      console.error('Error al desasociar tutor de estudiante:', error);
      return res.status(500).json({
        message: 'Error al desasociar tutor de estudiante',
        error: error.message
      });
    }
  }
  
  /**
   * Busca tutores por término
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async searchTutores(req, res) {
    try {
      const { termino } = req.query;
      
      if (!termino) {
        return res.status(400).json({ message: 'Debe proporcionar un término de búsqueda' });
      }
      
      const tutores = await TutorModel.search(termino);
      
      return res.status(200).json({
        message: 'Búsqueda realizada correctamente',
        tutores
      });
    } catch (error) {
      console.error('Error al buscar tutores:', error);
      return res.status(500).json({
        message: 'Error al buscar tutores',
        error: error.message
      });
    }
  }
  
  /**
   * Obtiene los estudiantes asociados a un tutor
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async getEstudiantesByTutor(req, res) {
    try {
      const { id } = req.params;
      
      // Verificar si el tutor existe
      const tutorExistente = await TutorModel.getById(id);
      if (!tutorExistente) {
        return res.status(404).json({ message: 'Tutor no encontrado' });
      }
      
      // Los estudiantes ya vienen incluidos en el método getById
      const estudiantes = tutorExistente.estudiantes || [];
      
      return res.status(200).json({
        message: 'Estudiantes obtenidos correctamente',
        estudiantes
      });
    } catch (error) {
      console.error('Error al obtener estudiantes del tutor:', error);
      return res.status(500).json({
        message: 'Error al obtener estudiantes del tutor',
        error: error.message
      });
    }
  }
}

module.exports = TutorController;