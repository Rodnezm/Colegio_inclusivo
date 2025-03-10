// src/controllers/asistencia.controller.js
const { query } = require('../config/database');
const { validationResult } = require('express-validator');

class AsistenciaController {
  /**
   * Obtiene el registro de asistencia de un estudiante específico
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async getAsistenciasByEstudiante(req, res) {
    try {
      const { id } = req.params; // ID del estudiante
      
      // Verificar si el estudiante existe
      const estudianteResult = await query(
        'SELECT * FROM Estudiante WHERE idEstudiante = $1',
        [id]
      );
      
      if (estudianteResult.rows.length === 0) {
        return res.status(404).json({ message: 'Estudiante no encontrado' });
      }
      
      // Obtener asistencias agrupadas por materia
      const asistenciasResult = await query(`
        SELECT 
          m.idMateria,
          m.nomb_materia,
          COUNT(*) as total_clases,
          SUM(CASE WHEN a.estado_asist = 'presente' THEN 1 ELSE 0 END) as presentes,
          SUM(CASE WHEN a.estado_asist = 'ausente' THEN 1 ELSE 0 END) as ausentes,
          SUM(CASE WHEN a.estado_asist = 'justificado' THEN 1 ELSE 0 END) as justificados,
          ROUND((SUM(CASE WHEN a.estado_asist = 'presente' OR a.estado_asist = 'justificado' THEN 1 ELSE 0 END)::numeric / COUNT(*)::numeric) * 100, 2) as porcentaje_asistencia,
          json_agg(
            json_build_object(
              'idAsistencia', a.idAsistencia,
              'fecha_asist', a.fecha_asist,
              'estado_asist', a.estado_asist,
              'justificacion_asist', a.justificacion_asist
            ) ORDER BY a.fecha_asist DESC
          ) as detalle
        FROM Asistencia a
        INNER JOIN Materia m ON a.materia_idmateria = m.idMateria
        WHERE a.estudiante_idestudiante = $1
        GROUP BY m.idMateria, m.nomb_materia
        ORDER BY m.nomb_materia
      `, [id]);
      
      // Calcular resumen general
      let totalClases = 0;
      let totalPresentes = 0;
      let totalAusentes = 0;
      let totalJustificados = 0;
      
      asistenciasResult.rows.forEach(a => {
        totalClases += parseInt(a.total_clases);
        totalPresentes += parseInt(a.presentes);
        totalAusentes += parseInt(a.ausentes);
        totalJustificados += parseInt(a.justificados);
      });
      
      const porcentajeGeneral = totalClases > 0 
        ? ((totalPresentes + totalJustificados) / totalClases) * 100 
        : 0;
      
      return res.status(200).json({
        message: 'Registro de asistencia obtenido correctamente',
        estudiante: estudianteResult.rows[0],
        asistencias: asistenciasResult.rows,
        resumen: {
          totalClases,
          totalPresentes,
          totalAusentes,
          totalJustificados,
          porcentajeGeneral: Math.round(porcentajeGeneral * 100) / 100
        }
      });
    } catch (error) {
      console.error('Error al obtener registro de asistencia:', error);
      return res.status(500).json({ 
        message: 'Error al obtener registro de asistencia',
        error: error.message 
      });
    }
  }

  /**
   * Obtiene la lista de asistencia para una materia en una fecha específica
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async getAsistenciaByMateriaAndFecha(req, res) {
    try {
      const { materiaId, fecha } = req.params;
      
      // Verificar si la materia existe
      const materiaResult = await query(
        'SELECT m.*, c.nomb_curso, p.nomb_prof, p.ape_prof FROM Materia m ' +
        'LEFT JOIN Curso c ON m.curso_idcurso = c.idCurso ' +
        'LEFT JOIN Profesor p ON m.profesor_idprofesor = p.idProfesor ' +
        'WHERE m.idMateria = $1',
        [materiaId]
      );
      
      if (materiaResult.rows.length === 0) {
        return res.status(404).json({ message: 'Materia no encontrada' });
      }

      // Obtener los estudiantes del curso de la materia
      const estudiantesResult = await query(`
        SELECT e.idEstudiante, e.nomb_est, e.ape_est, e.ci_est
        FROM Estudiante e
        WHERE e.curso_idcurso = $1 AND e.estado_est = 'activo'
        ORDER BY e.ape_est, e.nomb_est
      `, [materiaResult.rows[0].curso_idcurso]);
      
      // Obtener asistencias registradas para esa fecha y materia
      const asistenciasResult = await query(`
        SELECT a.*
        FROM Asistencia a
        WHERE a.materia_idmateria = $1 AND a.fecha_asist = $2
      `, [materiaId, fecha]);
      
      // Crear lista de asistencias combinando estudiantes y registros
      const listaAsistencia = estudiantesResult.rows.map(estudiante => {
        const asistenciaRegistrada = asistenciasResult.rows.find(
          a => a.estudiante_idestudiante === estudiante.idestudiante
        );
        
        return {
          estudiante,
          asistencia: asistenciaRegistrada || {
            estado_asist: null,
            justificacion_asist: null
          }
        };
      });
      
      return res.status(200).json({
        message: 'Lista de asistencia obtenida correctamente',
        materia: materiaResult.rows[0],
        fecha,
        tieneRegistros: asistenciasResult.rows.length > 0,
        listaAsistencia
      });
    } catch (error) {
      console.error('Error al obtener lista de asistencia:', error);
      return res.status(500).json({ 
        message: 'Error al obtener lista de asistencia',
        error: error.message 
      });
    }
  }

  /**
   * Registra asistencia para una materia en una fecha específica
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async registrarAsistencia(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { 
        materia_idmateria,
        fecha_asist,
        asistencias
      } = req.body;
      
      // Verificar si la materia existe
      const materiaResult = await query(
        'SELECT * FROM Materia WHERE idMateria = $1',
        [materia_idmateria]
      );
      
      if (materiaResult.rows.length === 0) {
        return res.status(404).json({ message: 'Materia no encontrada' });
      }
      
      // Verificar si ya existe registro para esta fecha y materia
      const asistenciaExistenteResult = await query(
        'SELECT * FROM Asistencia WHERE materia_idmateria = $1 AND fecha_asist = $2 LIMIT 1',
        [materia_idmateria, fecha_asist]
      );
      
      if (asistenciaExistenteResult.rows.length > 0) {
        // Eliminar registros existentes para actualizarlos
        await query(
          'DELETE FROM Asistencia WHERE materia_idmateria = $1 AND fecha_asist = $2',
          [materia_idmateria, fecha_asist]
        );
      }
      
      // Verificar que el formato de asistencias sea correcto
      if (!Array.isArray(asistencias) || asistencias.length === 0) {
        return res.status(400).json({ 
          message: 'Formato de asistencias incorrecto. Debe proporcionar un array de objetos con estudiante_idestudiante y estado_asist'
        });
      }
      
      // Iniciar transacción
      await query('BEGIN');
      
      try {
        // Insertar cada registro de asistencia
        for (const asistencia of asistencias) {
          await query(`
            INSERT INTO Asistencia (
              materia_idmateria,
              estudiante_idestudiante,
              fecha_asist,
              estado_asist,
              justificacion_asist
            )
            VALUES ($1, $2, $3, $4, $5)
          `, [
            materia_idmateria,
            asistencia.estudiante_idestudiante,
            fecha_asist,
            asistencia.estado_asist,
            asistencia.justificacion_asist || null
          ]);
        }
        
        // Confirmar transacción
        await query('COMMIT');
        
        return res.status(201).json({
          message: 'Asistencia registrada correctamente',
          fecha: fecha_asist,
          totalRegistros: asistencias.length
        });
      } catch (error) {
        // Revertir transacción en caso de error
        await query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Error al registrar asistencia:', error);
      return res.status(500).json({ 
        message: 'Error al registrar asistencia',
        error: error.message 
      });
    }
  }

  /**
   * Justifica una ausencia específica
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async justificarAusencia(req, res) {
    try {
      const { id } = req.params; // ID de la asistencia
      const { justificacion_asist } = req.body;
      
      if (!justificacion_asist) {
        return res.status(400).json({ message: 'Debe proporcionar una justificación' });
      }
      
      // Verificar si la asistencia existe
      const asistenciaResult = await query(
        'SELECT * FROM Asistencia WHERE idAsistencia = $1',
        [id]
      );
      
      if (asistenciaResult.rows.length === 0) {
        return res.status(404).json({ message: 'Registro de asistencia no encontrado' });
      }
      
      // Actualizar estado y justificación
      await query(`
        UPDATE Asistencia
        SET estado_asist = 'justificado', 
            justificacion_asist = $1
        WHERE idAsistencia = $2
      `, [justificacion_asist, id]);
      
      return res.status(200).json({
        message: 'Ausencia justificada correctamente',
        id
      });
    } catch (error) {
      console.error('Error al justificar ausencia:', error);
      return res.status(500).json({ 
        message: 'Error al justificar ausencia',
        error: error.message 
      });
    }
  }

  /**
   * Obtiene un reporte de asistencia por materia para todos los estudiantes
   * @param {Request} req - Objeto de solicitud Express
   * @param {Response} res - Objeto de respuesta Express
   */
  static async getReporteAsistenciaPorMateria(req, res) {
    try {
      const { materiaId } = req.params;
      
      // Verificar si la materia existe
      const materiaResult = await query(
        'SELECT m.*, c.nomb_curso FROM Materia m ' +
        'INNER JOIN Curso c ON m.curso_idcurso = c.idCurso ' +
        'WHERE m.idMateria = $1',
        [materiaId]
      );
      
      if (materiaResult.rows.length === 0) {
        return res.status(404).json({ message: 'Materia no encontrada' });
      }
      
      // Obtener fechas de asistencia para esta materia
      const fechasResult = await query(`
        SELECT DISTINCT fecha_asist
        FROM Asistencia
        WHERE materia_idmateria = $1
        ORDER BY fecha_asist
      `, [materiaId]);
      
      // Obtener estudiantes del curso
      const estudiantesResult = await query(`
        SELECT e.idEstudiante, e.nomb_est, e.ape_est
        FROM Estudiante e
        WHERE e.curso_idcurso = $1 AND e.estado_est = 'activo'
        ORDER BY e.ape_est, e.nomb_est
      `, [materiaResult.rows[0].curso_idcurso]);
      
      // Para cada estudiante, obtener su registro de asistencia
      const reporteEstudiantes = await Promise.all(estudiantesResult.rows.map(async (estudiante) => {
        const asistenciasResult = await query(`
          SELECT 
            a.fecha_asist,
            a.estado_asist
          FROM Asistencia a
          WHERE a.materia_idmateria = $1 AND a.estudiante_idestudiante = $2
          ORDER BY a.fecha_asist
        `, [materiaId, estudiante.idestudiante]);
        
        // Calcular estadísticas
        const totalClases = fechasResult.rows.length;
        const presentes = asistenciasResult.rows.filter(a => a.estado_asist === 'presente').length;
        const ausentes = asistenciasResult.rows.filter(a => a.estado_asist === 'ausente').length;
        const justificados = asistenciasResult.rows.filter(a => a.estado_asist === 'justificado').length;
        const porcentaje = totalClases > 0 
          ? ((presentes + justificados) / totalClases) * 100 
          : 0;
        
        return {
          estudiante,
          asistencias: asistenciasResult.rows,
          estadisticas: {
            presentes,
            ausentes,
            justificados,
            totalClases,
            porcentajeAsistencia: Math.round(porcentaje * 100) / 100
          }
        };
      }));
      
      return res.status(200).json({
        message: 'Reporte de asistencia obtenido correctamente',
        materia: materiaResult.rows[0],
        fechas: fechasResult.rows,
        estudiantes: reporteEstudiantes
      });
    } catch (error) {
      console.error('Error al obtener reporte de asistencia:', error);
      return res.status(500).json({ 
        message: 'Error al obtener reporte de asistencia',
        error: error.message 
      });
    }
  }
}

module.exports = AsistenciaController;