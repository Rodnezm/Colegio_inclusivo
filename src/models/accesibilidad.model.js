// src/models/accesibilidad.model.js
const { query } = require('../config/database');

/**
 * Modelo para gestionar la configuración de accesibilidad
 */
class AccesibilidadModel {
  /**
   * Obtiene la configuración de accesibilidad de un usuario
   * @param {number} userId - ID del usuario
   * @returns {Promise<Object>} Configuración de accesibilidad
   */
  static async getByUserId(userId) {
    try {
      const result = await query(
        'SELECT * FROM Conf_accesibilidad WHERE usuario_idusuario = $1',
        [userId]
      );
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error al obtener configuración de accesibilidad: ${error.message}`);
    }
  }
  
  /**
   * Crea una configuración de accesibilidad por defecto
   * @param {number} userId - ID del usuario
   * @returns {Promise<Object>} Configuración creada
   */
  static async createDefault(userId) {
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
   * Actualiza la configuración de accesibilidad
   * @param {number} userId - ID del usuario
   * @param {Object} config - Datos de configuración a actualizar
   * @returns {Promise<Object>} Configuración actualizada
   */
  static async update(userId, config) {
    try {
      // Verificar si ya existe una configuración
      const existingConfig = await this.getByUserId(userId);
      
      let result;
      
      if (!existingConfig) {
        // Si no existe, crear una nueva configuración
        const fields = ['usuario_idusuario', ...Object.keys(config)].join(', ');
        const placeholders = Array.from({ length: Object.keys(config).length + 1 }, (_, i) => `$${i + 1}`).join(', ');
        const values = [userId, ...Object.values(config)];
        
        result = await query(
          `INSERT INTO Conf_accesibilidad (${fields}) VALUES (${placeholders}) RETURNING *`,
          values
        );
      } else {
        // Si existe, actualizar la configuración existente
        const sets = Object.keys(config).map((key, i) => `${key} = $${i + 2}`).join(', ');
        const values = [userId, ...Object.values(config)];
        
        result = await query(
          `UPDATE Conf_accesibilidad SET ${sets} WHERE usuario_idusuario = $1 RETURNING *`,
          values
        );
      }
      
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error al actualizar configuración de accesibilidad: ${error.message}`);
    }
  }
  
  /**
   * Aplica un perfil predefinido de accesibilidad
   * @param {number} userId - ID del usuario
   * @param {string} perfilId - ID del perfil
   * @returns {Promise<Object>} Configuración actualizada
   */
  static async aplicarPerfil(userId, perfilId) {
    try {
      let configuracion = {};
      
      // Configurar según el perfil seleccionado
      switch (perfilId) {
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
            modo_daltonismo: 'protanopia',
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
          throw new Error('Perfil no reconocido');
      }
      
      return await this.update(userId, configuracion);
    } catch (error) {
      throw new Error(`Error al aplicar perfil de accesibilidad: ${error.message}`);
    }
  }
  
  /**
   * Obtiene los perfiles de accesibilidad disponibles
   * @returns {Promise<Array>} Lista de perfiles
   */
  static async getPerfilesDisponibles() {
    try {
      return [
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
    } catch (error) {
      throw new Error(`Error al obtener perfiles de accesibilidad: ${error.message}`);
    }
  }
}

module.exports = AccesibilidadModel;