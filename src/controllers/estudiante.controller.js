const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const EstudianteModel = require('../models/estudiante.model');
const UsuarioModel = require('../models/user.model');
//const InfoMedicoModel = require('../models/infoMedico.model');
const DocumentacionModel = require('../models/documentacion.model');

/**
 * Controlador para gestionar los estudiantes
 */
class EstudianteController {
  /**
   * Obtiene todos los estudiantes
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async getAllEstudiantes(req, res) {
    try {
      const estudiantes = await EstudianteModel.getAll();
      
      return res.status(200).json({
        message: 'Lista de estudiantes obtenida correctamente',
        estudiantes
      });
    } catch (error) {
      console.error('Error al obtener estudiantes:', error);
      return res.status(500).json({ 
        message: 'Error al obtener estudiantes',
        error: error.message 
      });
    }
  }
  
  /**
   * Obtiene un estudiante por su ID
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async getEstudianteById(req, res) {
    try {
      const { id } = req.params;
      
      const estudiante = await EstudianteModel.getById(id);
      
      if (!estudiante) {
        return res.status(404).json({ message: 'Estudiante no encontrado' });
      }
      
      return res.status(200).json({
        message: 'Estudiante obtenido correctamente',
        estudiante
      });
    } catch (error) {
      console.error('Error al obtener estudiante:', error);
      return res.status(500).json({ 
        message: 'Error al obtener estudiante',
        error: error.message 
      });
    }
  }
  
  /**
   * Crea un nuevo estudiante con su usuario asociado
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async createEstudiante(req, res) {
    try {
      // Validar inputs
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { 
        nomb_est, ape_est, ci_est, fech_nac_est, direccion_est, 
        telef1_est, telef2_est, email_est, genero_est,
        nacionalidad_est, necesidad_especial, obs_est,
        Curso_idCurso, nomb_user, password,
        // Datos médicos (opcionales)
        tipo_sangre, alergias, medicamentos, condiciones_especiales,
        // Matrícula
        matricula_est
      } = req.body;
      
      // Comenzar transacción
      await UsuarioModel.beginTransaction();
      
      try {
        // 1. Crear usuario
        const hashedPassword = await bcrypt.hash(password || '123456', 10); // Password por defecto si no se proporciona
        
        const usuario = await UsuarioModel.create({
          nomb_user: nomb_user || `est_${ci_est}`,
          contraseña_user: hashedPassword,
          tipo_user: 'estudiante'
        });
        
        // 2. Crear estudiante
        const estudianteData = {
          Curso_idCurso,
          nomb_est,
          ape_est,
          ci_est,
          fech_nac_est,
          direccion_est,
          telef1_est,
          telef2_est,
          email_est,
          genero_est,
          nacionalidad_est,
          necesidad_especial,
          obs_est,
          matricula_est
        };
        
        const estudiante = await EstudianteModel.create(estudianteData, usuario.idUsuario);
        
        // 3. Crear información médica si se proporcionó
        if (tipo_sangre || alergias || medicamentos || condiciones_especiales) {
          await InfoMedicoModel.create({
            Estudiante_idEstudiante: estudiante.idEstudiante,
            tipo_sangre,
            alergias,
            medicamentos,
            condiciones_especiales
          });
        }
        
        // Confirmar transacción
        await UsuarioModel.commitTransaction();
        
        return res.status(201).json({
          message: 'Estudiante creado correctamente',
          estudiante: {
            idEstudiante: estudiante.idEstudiante,
            nomb_est: estudiante.nomb_est,
            ape_est: estudiante.ape_est,
            ci_est: estudiante.ci_est,
            Usuario_idUsuario: estudiante.Usuario_idUsuario
          }
        });
        
      } catch (error) {
        // Revertir transacción en caso de error
        await UsuarioModel.rollbackTransaction();
        throw error;
      }
      
    } catch (error) {
      console.error('Error al crear estudiante:', error);
      return res.status(500).json({ 
        message: 'Error al crear estudiante',
        error: error.message 
      });
    }
  }
  
  /**
   * Actualiza un estudiante existente
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async updateEstudiante(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { id } = req.params;
      const { 
        nomb_est, ape_est, ci_est, fech_nac_est, direccion_est, 
        telef1_est, telef2_est, email_est, genero_est,
        nacionalidad_est, necesidad_especial, obs_est,
        Curso_idCurso, estado_est, matricula_est
      } = req.body;
      
      // Verificar si el estudiante existe
      const existingEstudiante = await EstudianteModel.getById(id);
      if (!existingEstudiante) {
        return res.status(404).json({ message: 'Estudiante no encontrado' });
      }
      
      // Actualizar estudiante
      const estudiante = await EstudianteModel.update(id, {
        nomb_est, 
        ape_est, 
        ci_est, 
        fech_nac_est, 
        direccion_est, 
        telef1_est, 
        telef2_est, 
        email_est, 
        genero_est,
        nacionalidad_est, 
        necesidad_especial, 
        obs_est,
        Curso_idCurso, 
        estado_est,
        matricula_est
      });
      
      return res.status(200).json({
        message: 'Estudiante actualizado correctamente',
        estudiante
      });
    } catch (error) {
      console.error('Error al actualizar estudiante:', error);
      return res.status(500).json({ 
        message: 'Error al actualizar estudiante',
        error: error.message 
      });
    }
  }
  
  /**
   * Elimina un estudiante y todos sus registros relacionados
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async deleteEstudiante(req, res) {
    try {
      const { id } = req.params;
      
      // Verificar si el estudiante existe
      const existingEstudiante = await EstudianteModel.getById(id);
      if (!existingEstudiante) {
        return res.status(404).json({ message: 'Estudiante no encontrado' });
      }
      
      // Eliminar estudiante y todos sus registros relacionados
      const deleted = await EstudianteModel.delete(id);
      
      if (!deleted) {
        return res.status(500).json({ message: 'No se pudo eliminar el estudiante' });
      }
      
      return res.status(200).json({ 
        message: 'Estudiante eliminado correctamente' 
      });
    } catch (error) {
      console.error('Error al eliminar estudiante:', error);
      return res.status(500).json({ 
        message: 'Error al eliminar estudiante',
        error: error.message 
      });
    }
  }
  
  /**
   * Busca estudiantes por nombre, apellido o CI
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async searchEstudiantes(req, res) {
    try {
      const { q } = req.query;
      
      if (!q || q.trim() === '') {
        return res.status(400).json({ 
          message: 'Se debe proporcionar un término de búsqueda' 
        });
      }
      
      const estudiantes = await EstudianteModel.search(q);
      
      return res.status(200).json({
        message: 'Búsqueda realizada correctamente',
        estudiantes
      });
    } catch (error) {
      console.error('Error al buscar estudiantes:', error);
      return res.status(500).json({ 
        message: 'Error al buscar estudiantes',
        error: error.message 
      });
    }
  }
  
  /**
   * Obtiene los estudiantes por curso
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async getEstudiantesByCurso(req, res) {
    try {
      const { cursoId } = req.params;
      
      const estudiantes = await EstudianteModel.getByCurso(cursoId);
      
      return res.status(200).json({
        message: 'Estudiantes obtenidos correctamente',
        estudiantes
      });
    } catch (error) {
      console.error('Error al obtener estudiantes por curso:', error);
      return res.status(500).json({ 
        message: 'Error al obtener estudiantes por curso',
        error: error.message 
      });
    }
  }
  
  /**
   * Añade un tutor a un estudiante
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async addTutor(req, res) {
    try {
      const { estudianteId, tutorId } = req.params;
      
      // Verificar si el estudiante existe
      const existingEstudiante = await EstudianteModel.getById(estudianteId);
      if (!existingEstudiante) {
        return res.status(404).json({ message: 'Estudiante no encontrado' });
      }
      
      // Verificar si el tutor existe (se deberá importar TutorModel)
      // const existingTutor = await TutorModel.getById(tutorId);
      // if (!existingTutor) {
      //   return res.status(404).json({ message: 'Tutor no encontrado' });
      // }
      
      // Verificar que no exista ya la relación
      const EstudianteTutorModel = require('../models/estudianteTutor.model');
      const existsRelation = await EstudianteTutorModel.isTutorOfEstudiante(estudianteId, tutorId);
      
      if (existsRelation) {
        return res.status(400).json({ 
          message: 'El tutor ya está asignado a este estudiante' 
        });
      }
      
      const added = await EstudianteTutorModel.addTutorToEstudiante(estudianteId, tutorId);
      
      if (!added) {
        return res.status(500).json({ message: 'No se pudo agregar el tutor al estudiante' });
      }
      
      return res.status(200).json({
        message: 'Tutor agregado correctamente al estudiante'
      });
    } catch (error) {
      console.error('Error al agregar tutor al estudiante:', error);
      return res.status(500).json({ 
        message: 'Error al agregar tutor al estudiante',
        error: error.message 
      });
    }
  }
  
  /**
   * Elimina un tutor de un estudiante
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async removeTutor(req, res) {
    try {
      const { estudianteId, tutorId } = req.params;
      
      const EstudianteTutorModel = require('../models/estudianteTutor.model');
      const removed = await EstudianteTutorModel.removeTutorFromEstudiante(estudianteId, tutorId);
      
      if (!removed) {
        return res.status(404).json({ 
          message: 'No se encontró la relación estudiante-tutor' 
        });
      }
      
      return res.status(200).json({
        message: 'Tutor eliminado correctamente del estudiante'
      });
    } catch (error) {
      console.error('Error al eliminar tutor del estudiante:', error);
      return res.status(500).json({ 
        message: 'Error al eliminar tutor del estudiante',
        error: error.message 
      });
    }
  }
  
  /**
   * Sube un documento para un estudiante
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async uploadDocumento(req, res) {
    try {
      const { id } = req.params;
      const { tipo_doc } = req.body;
      const archivo = req.file;
      
      if (!archivo) {
        return res.status(400).json({ message: 'No se ha proporcionado ningún archivo' });
      }
      
      // Verificar si el estudiante existe
      const existingEstudiante = await EstudianteModel.getById(id);
      if (!existingEstudiante) {
        return res.status(404).json({ message: 'Estudiante no encontrado' });
      }
      
      // Crear documento (asumiendo que hay un model para ello)
      const documento = await DocumentacionModel.create({
        Estudiante_idEstudiante: id,
        tipo_doc,
        nomb_arch: archivo.originalname,
        url_arch: archivo.path,
        estado_doc: 'activo'
      });
      
      return res.status(201).json({
        message: 'Documento subido correctamente',
        documento
      });
    } catch (error) {
      console.error('Error al subir documento:', error);
      return res.status(500).json({ 
        message: 'Error al subir documento',
        error: error.message 
      });
    }
  }
}

module.exports = EstudianteController;