// src/controllers/accesibilidad.controller.js
const { query } = require('../config/database');
const { validationResult } = require('express-validator');

class AccesibilidadController {
  /**
   * Obtiene la configuración de accesibilidad de un usuario
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async getConfiguracion(req, res) {
    try {
      const userId = req.user.id;
      
      const result = await query(
        'SELECT * FROM Conf_accesibilidad WHERE usuario_idusuario = $1',
        [userId]
      );
      
      if (result.rows.length === 0) {
        // Si no existe, crear una configuración por defecto
        const defaultConfig = await AccesibilidadController.crearConfiguracionPorDefecto(userId);
        
        return res.status(200).json({
          message: 'Configuración de accesibilidad creada por defecto',
          configuracion: defaultConfig
        });
      }
      
      return res.status(200).json({
        message: 'Configuración de accesibilidad obtenida correctamente',
        configuracion: result.rows[0]
      });
    } catch (error) {
      console.error('Error al obtener configuración de accesibilidad:', error);
      return res.status(500).json({ 
        message: 'Error al obtener configuración de accesibilidad',
        error: error.message 
      });
    }
  }

  /**
   * Crea una configuración de accesibilidad por defecto para un usuario
   * @param {number} userId - ID del usuario
   * @returns {Promise<Object>} Configuración creada
   */
  static async crearConfiguracionPorDefecto(userId) {
    try {
      const result = await query(`
        INSERT INTO Conf_accesibilidad (
          usuario_idusuario,
          tipo_discapacidad,
          subtitulos_activados,
          lenguajes_señas,
          alto_contraste,
          tamaño_letra,
          velocidad_reproduccion,
          transcripcion_automatica,
          notif_visuales,
          notif_sonoras,
          modo_daltonismo,
          atajos_teclado,
          naveg_voz,
          modo_lect_facil,
          time_extra_actividad,
          modo_tdah,
          navegacion_por_teclado,
          lector_pantalla,
          problema_vision_parcial,
          problema_vision_total
        ) VALUES (
          $1, NULL, false, false, false, 16, 1.0, false, false, false,
          NULL, NULL, false, false, 0, false, false, false, false, false
        ) RETURNING *
      `, [userId]);
      
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error al crear configuración por defecto: ${error.message}`);
    }
  }

  /**
   * Actualiza la configuración de accesibilidad de un usuario
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async updateConfiguracion(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const userId = req.user.id;
      const {
        tipo_discapacidad,
        subtitulos_activados,
        lenguajes_señas,
        alto_contraste,
        tamaño_letra,
        velocidad_reproduccion,
        transcripcion_automatica,
        notif_visuales,
        notif_sonoras,
        modo_daltonismo,
        atajos_teclado,
        naveg_voz,
        modo_lect_facil,
        time_extra_actividad,
        modo_tdah,
        navegacion_por_teclado,
        lector_pantalla,
        problema_vision_parcial,
        problema_vision_total
      } = req.body;
      
      // Verificar si ya existe una configuración
      const configResult = await query(
        'SELECT * FROM Conf_accesibilidad WHERE usuario_idusuario = $1',
        [userId]
      );
      
      let result;
      
      if (configResult.rows.length === 0) {
        // Si no existe, crear una nueva
        result = await query(`
          INSERT INTO Conf_accesibilidad (
            usuario_idusuario,
            tipo_discapacidad,
            subtitulos_activados,
            lenguajes_señas,
            alto_contraste,
            tamaño_letra,
            velocidad_reproduccion,
            transcripcion_automatica,
            notif_visuales,
            notif_sonoras,
            modo_daltonismo,
            atajos_teclado,
            naveg_voz,
            modo_lect_facil,
            time_extra_actividad,
            modo_tdah,
            navegacion_por_teclado,
            lector_pantalla,
            problema_vision_parcial,
            problema_vision_total
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
          ) RETURNING *
        `, [
          userId,
          tipo_discapacidad,
          subtitulos_activados || false,
          lenguajes_señas || false,
          alto_contraste || false,
          tamaño_letra || 16,
          velocidad_reproduccion || 1.0,
          transcripcion_automatica || false,
          notif_visuales || false,
          notif_sonoras || false,
          modo_daltonismo,
          atajos_teclado,
          naveg_voz || false,
          modo_lect_facil || false,
          time_extra_actividad || 0,
          modo_tdah || false,
          navegacion_por_teclado || false,
          lector_pantalla || false,
          problema_vision_parcial || false,
          problema_vision_total || false
        ]);
      } else {
        // Si existe, actualizarla
        result = await query(`
          UPDATE Conf_accesibilidad SET
            tipo_discapacidad = $1,
            subtitulos_activados = $2,
            lenguajes_señas = $3,
            alto_contraste = $4,
            tamaño_letra = $5,
            velocidad_reproduccion = $6,
            transcripcion_automatica = $7,
            notif_visuales = $8,
            notif_sonoras = $9,
            modo_daltonismo = $10,
            atajos_teclado = $11,
            naveg_voz = $12,
            modo_lect_facil = $13,
            time_extra_actividad = $14,
            modo_tdah = $15,
            navegacion_por_teclado = $16,
            lector_pantalla = $17,
            problema_vision_parcial = $18,
            problema_vision_total = $19
          WHERE usuario_idusuario = $20
          RETURNING *
        `, [
          tipo_discapacidad,
          subtitulos_activados !== undefined ? subtitulos_activados : configResult.rows[0].subtitulos_activados,
          lenguajes_señas !== undefined ? lenguajes_señas : configResult.rows[0].lenguajes_señas,
          alto_contraste !== undefined ? alto_contraste : configResult.rows[0].alto_contraste,
          tamaño_letra || configResult.rows[0].tamaño_letra,
          velocidad_reproduccion || configResult.rows[0].velocidad_reproduccion,
          transcripcion_automatica !== undefined ? transcripcion_automatica : configResult.rows[0].transcripcion_automatica,
          notif_visuales !== undefined ? notif_visuales : configResult.rows[0].notif_visuales,
          notif_sonoras !== undefined ? notif_sonoras : configResult.rows[0].notif_sonoras,
          modo_daltonismo !== undefined ? modo_daltonismo : configResult.rows[0].modo_daltonismo,
          atajos_teclado !== undefined ? atajos_teclado : configResult.rows[0].atajos_teclado,
          naveg_voz !== undefined ? naveg_voz : configResult.rows[0].naveg_voz,
          modo_lect_facil !== undefined ? modo_lect_facil : configResult.rows[0].modo_lect_facil,
          time_extra_actividad !== undefined ? time_extra_actividad : configResult.rows[0].time_extra_actividad,
          modo_tdah !== undefined ? modo_tdah : configResult.rows[0].modo_tdah,
          navegacion_por_teclado !== undefined ? navegacion_por_teclado : configResult.rows[0].navegacion_por_teclado,
          lector_pantalla !== undefined ? lector_pantalla : configResult.rows[0].lector_pantalla,
          problema_vision_parcial !== undefined ? problema_vision_parcial : configResult.rows[0].problema_vision_parcial,
          problema_vision_total !== undefined ? problema_vision_total : configResult.rows[0].problema_vision_total,
          userId
        ]);
      }
      
      return res.status(200).json({
        message: 'Configuración de accesibilidad actualizada correctamente',
        configuracion: result.rows[0]
      });
    } catch (error) {
      console.error('Error al actualizar configuración de accesibilidad:', error);
      return res.status(500).json({ 
        message: 'Error al actualizar configuración de accesibilidad',
        error: error.message 
      });
    }
  }

  /**
   * Aplica un perfil predefinido de accesibilidad
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async aplicarPerfil(req, res) {
    try {
      const { perfil } = req.params;
      const userId = req.user.id;
      
      let configuracion = {};
      
      // Configurar según el perfil seleccionado
      switch (perfil) {
        case 'tdah':
          configuracion = {
            modo_tdah: true,
            modo_lect_facil: true,
            notif_visuales: true,
            tamaño_letra: 18
          };
          break;
          
        case 'navegacion-teclado':
          configuracion = {
            navegacion_por_teclado: true,
            atajos_teclado: 'navegacion:tab,seleccion:enter,volver:escape'
          };
          break;
          
        case 'ceguera':
          configuracion = {
            lector_pantalla: true,
            problema_vision_total: true,
            naveg_voz: true,
            transcripcion_automatica: true
          };
          break;
          
        case 'baja-vision':
          configuracion = {
            problema_vision_parcial: true,
            alto_contraste: true,
            tamaño_letra: 24,
            notif_sonoras: true
          };
          break;
          
        case 'daltonismo':
          configuracion = {
            modo_daltonismo: 'protanopia', // Opciones: protanopia, deuteranopia, tritanopia
            alto_contraste: true
          };
          break;

        case 'discapacidad-auditiva':
          configuracion = {
            subtitulos_activados: true,
            lenguajes_señas: true,
            notif_visuales: true,
            transcripcion_automatica: true
          };
          break;
          
        case 'defecto':
          // Restablecer a configuración por defecto
          configuracion = {
            tipo_discapacidad: null,
            subtitulos_activados: false,
            lenguajes_señas: false,
            alto_contraste: false,
            tamaño_letra: 16,
            velocidad_reproduccion: 1.0,
            transcripcion_automatica: false,
            notif_visuales: false,
            notif_sonoras: false,
            modo_daltonismo: null,
            atajos_teclado: null,
            naveg_voz: false,
            modo_lect_facil: false,
            time_extra_actividad: 0,
            modo_tdah: false,
            navegacion_por_teclado: false,
            lector_pantalla: false,
            problema_vision_parcial: false,
            problema_vision_total: false
          };
          break;
          
        default:
          return res.status(400).json({ message: 'Perfil no reconocido' });
      }
      
      // Obtener configuración actual
      const configResult = await query(
        'SELECT * FROM Conf_accesibilidad WHERE usuario_idusuario = $1',
        [userId]
      );
      
      let result;
      
      if (configResult.rows.length === 0) {
        // Si no existe, crear una nueva con el perfil seleccionado
        const defaultConfig = {
          usuario_idusuario: userId,
          tipo_discapacidad: null,
          subtitulos_activados: false,
          lenguajes_señas: false,
          alto_contraste: false,
          tamaño_letra: 16,
          velocidad_reproduccion: 1.0,
          transcripcion_automatica: false,
          notif_visuales: false,
          notif_sonoras: false,
          modo_daltonismo: null,
          atajos_teclado: null,
          naveg_voz: false,
          modo_lect_facil: false,
          time_extra_actividad: 0,
          modo_tdah: false,
          navegacion_por_teclado: false,
          lector_pantalla: false,
          problema_vision_parcial: false,
          problema_vision_total: false,
          ...configuracion
        };
        
        // Preparar los valores y la consulta SQL de inserción
        const fields = Object.keys(defaultConfig).join(', ');
        const placeholders = Object.keys(defaultConfig).map((_, index) => `$${index + 1}`).join(', ');
        const values = Object.values(defaultConfig);
        
        result = await query(
          `INSERT INTO Conf_accesibilidad (${fields}) VALUES (${placeholders}) RETURNING *`,
          values
        );
      } else {
        // Si existe, actualizarla con el perfil seleccionado
        const currentConfig = configResult.rows[0];
        const updatedConfig = { ...currentConfig, ...configuracion };
        
        // Construir la consulta SQL para actualizar
        const setClause = Object.keys(configuracion)
          .map((key, index) => `${key} = $${index + 1}`)
          .join(', ');
        
        const values = [...Object.values(configuracion), userId];
        
        result = await query(
          `UPDATE Conf_accesibilidad SET ${setClause} WHERE usuario_idusuario = $${values.length} RETURNING *`,
          values
        );
      }
      
      return res.status(200).json({
        message: `Perfil de accesibilidad '${perfil}' aplicado correctamente`,
        configuracion: result.rows[0]
      });
    } catch (error) {
      console.error('Error al aplicar perfil de accesibilidad:', error);
      return res.status(500).json({ 
        message: 'Error al aplicar perfil de accesibilidad',
        error: error.message 
      });
    }
  }

  /**
   * Obtiene los perfiles de accesibilidad disponibles
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async getPerfilesDisponibles(req, res) {
    try {
      const perfiles = [
        {
          id: 'tdah',
          nombre: 'Perfil TDAH',
          descripcion: 'Reduce distracciones y simplifica la interfaz para mejorar la concentración',
          configuraciones: {
            modo_tdah: true,
            modo_lect_facil: true,
            notif_visuales: true
          }
        },
        {
          id: 'navegacion-teclado',
          nombre: 'Navegación por teclado',
          descripcion: 'Optimizado para personas que navegan usando principalmente el teclado',
          configuraciones: {
            navegacion_por_teclado: true,
            atajos_teclado: 'navegacion:tab,seleccion:enter,volver:escape'
          }
        },
        {
          id: 'ceguera',
          nombre: 'Usuario ciego (lector de pantalla)',
          descripcion: 'Optimizado para usuarios ciegos que utilizan lectores de pantalla',
          configuraciones: {
            lector_pantalla: true,
            problema_vision_total: true,
            naveg_voz: true
          }
        },
        {
          id: 'baja-vision',
          nombre: 'Baja visión',
          descripcion: 'Aumenta contraste, tamaño de texto y mejora la visibilidad',
          configuraciones: {
            problema_vision_parcial: true,
            alto_contraste: true,
            tamaño_letra: 24
          }
        },
        {
          id: 'daltonismo',
          nombre: 'Daltonismo',
          descripcion: 'Ajusta los colores para personas con diferentes tipos de daltonismo',
          configuraciones: {
            modo_daltonismo: 'protanopia',
            alto_contraste: true
          }
        },
        {
          id: 'discapacidad-auditiva',
          nombre: 'Discapacidad auditiva',
          descripcion: 'Habilita subtítulos y notificaciones visuales',
          configuraciones: {
            subtitulos_activados: true,
            lenguajes_señas: true,
            notif_visuales: true
          }
        },
        {
          id: 'defecto',
          nombre: 'Configuración predeterminada',
          descripcion: 'Restablece todas las configuraciones de accesibilidad a valores predeterminados',
          configuraciones: {}
        }
      ];
      
      return res.status(200).json({
        message: 'Perfiles de accesibilidad obtenidos correctamente',
        perfiles
      });
    } catch (error) {
      console.error('Error al obtener perfiles de accesibilidad:', error);
      return res.status(500).json({ 
        message: 'Error al obtener perfiles de accesibilidad',
        error: error.message 
      });
    }
  }
}

module.exports = AccesibilidadController;