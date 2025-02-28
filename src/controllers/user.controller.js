const { validationResult } = require('express-validator');
const { query } = require('../config/database');
const bcrypt = require('bcryptjs');

// ===== CONTROLADORES PARA ESTUDIANTES =====

// Obtener todos los estudiantes
exports.getAllEstudiantes = async (req, res) => {
  try {
    const result = await query(`
      SELECT e.*, c.nomb_curso, u.nomb_user 
      FROM Estudiante e
      INNER JOIN Curso c ON e.Curso_idCurso = c.idCurso
      INNER JOIN Usuario u ON e.Usuario_idUsuario = u.idUsuario
      ORDER BY e.ape_est, e.nomb_est
    `);
    
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener estudiantes:', error);
    return res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

// Obtener estudiante por ID
exports.getEstudianteById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(`
      SELECT e.*, c.nomb_curso, u.nomb_user, u.tipo_user 
      FROM Estudiante e
      INNER JOIN Curso c ON e.Curso_idCurso = c.idCurso
      INNER JOIN Usuario u ON e.Usuario_idUsuario = u.idUsuario
      WHERE e.idEstudiante = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Estudiante no encontrado' });
    }
    
    // Obtener información médica si existe
    const infoMedico = await query('SELECT * FROM Info_medico WHERE Estudiante_idEstudiante = $1', [id]);
    
    // Obtener tutores asociados
    const tutores = await query(`
      SELECT t.* 
      FROM Tutor t
      INNER JOIN Estudiante_has_Tutor et ON t.idTutor = et.Tutor_idTutor
      WHERE et.Estudiante_idEstudiante = $1
    `, [id]);
    
    // Obtener documentación
    const documentacion = await query('SELECT * FROM Documentacion_estudiante WHERE Estudiante_idEstudiante = $1', [id]);
    
    // Obtener configuración de accesibilidad
    const accessibilityResult = await query(`
      SELECT ca.* 
      FROM Conf_accesibilidad ca
      INNER JOIN Usuario u ON ca.Usuario_idUsuario = u.idUsuario
      INNER JOIN Estudiante e ON e.Usuario_idUsuario = u.idUsuario
      WHERE e.idEstudiante = $1
    `, [id]);
    
    const estudiante = {
      ...result.rows[0],
      infoMedica: infoMedico.rows.length > 0 ? infoMedico.rows[0] : null,
      tutores: tutores.rows,
      documentacion: documentacion.rows,
      configuracionAccesibilidad: accessibilityResult.rows.length > 0 ? accessibilityResult.rows[0] : null
    };
    
    return res.status(200).json(estudiante);
  } catch (error) {
    console.error('Error al obtener estudiante:', error);
    return res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

// Crear nuevo estudiante
exports.createEstudiante = async (req, res) => {
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
      Curso_idCurso, nomb_user, password 
    } = req.body;
    
    // Crear transacción
    const client = await query('BEGIN');
    
    try {
      // 1. Crear usuario
      const hashedPassword = await bcrypt.hash(password || '123456', 10); // Password por defecto si no se proporciona
      
      const userResult = await query(
        'INSERT INTO Usuario (nomb_user, contraseña_user, tipo_user) VALUES ($1, $2, $3) RETURNING idUsuario',
        [nomb_user || `est_${ci_est}`, hashedPassword, 'estudiante']
      );
      
      const Usuario_idUsuario = userResult.rows[0].idUsuario;
      
      // 2. Crear estudiante
      const estudianteResult = await query(
        `INSERT INTO Estudiante (
          Usuario_idUsuario, Curso_idCurso, nomb_est, ape_est, ci_est, 
          fech_nac_est, direccion_est, telef1_est, telef2_est, 
          email_est, genero_est, nacionalidad_est, 
          necesidad_especial, obs_est, fech_ingreso_est, estado_est
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_DATE, 'activo')
        RETURNING idEstudiante`,
        [
          Usuario_idUsuario, Curso_idCurso, nomb_est, ape_est, ci_est,
          fech_nac_est || null, direccion_est || null, telef1_est || null, telef2_est || null,
          email_est || null, genero_est || null, nacionalidad_est || null,
          necesidad_especial || null, obs_est || null
        ]
      );
      
      // Confirmar transacción
      await query('COMMIT');
      
      return res.status(201).json({
        message: 'Estudiante creado correctamente',
        estudiante: {
          idEstudiante: estudianteResult.rows[0].idEstudiante,
          nomb_est,
          ape_est,
          ci_est,
          Usuario_idUsuario
        }
      });
      
    } catch (error) {
      // Revertir transacción en caso de error
      await query('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.error('Error al crear estudiante:', error);
    return res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

// Actualizar estudiante
exports.updateEstudiante = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      nomb_est, ape_est, ci_est, fech_nac_est, direccion_est, 
      telef1_est, telef2_est, email_est, genero_est,
      nacionalidad_est, necesidad_especial, obs_est,
      Curso_idCurso, estado_est 
    } = req.body;
    
    // Verificar si el estudiante existe
    const checkResult = await query('SELECT * FROM Estudiante WHERE idEstudiante = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Estudiante no encontrado' });
    }
    
    // Actualizar estudiante
    await query(
      `UPDATE Estudiante SET
        nomb_est = COALESCE($1, nomb_est),
        ape_est = COALESCE($2, ape_est),
        ci_est = COALESCE($3, ci_est),
        fech_nac_est = COALESCE($4, fech_nac_est),
        direccion_est = COALESCE($5, direccion_est),
        telef1_est = COALESCE($6, telef1_est),
        telef2_est = COALESCE($7, telef2_est),
        email_est = COALESCE($8, email_est),
        genero_est = COALESCE($9, genero_est),
        nacionalidad_est = COALESCE($10, nacionalidad_est),
        necesidad_especial = COALESCE($11, necesidad_especial),
        obs_est = COALESCE($12, obs_est),
        Curso_idCurso = COALESCE($13, Curso_idCurso),
        estado_est = COALESCE($14, estado_est)
      WHERE idEstudiante = $15`,
      [
        nomb_est, ape_est, ci_est, fech_nac_est, direccion_est,
        telef1_est, telef2_est, email_est, genero_est,
        nacionalidad_est, necesidad_especial, obs_est,
        Curso_idCurso, estado_est, id
      ]
    );
    
    // Obtener estudiante actualizado
    const result = await query('SELECT * FROM Estudiante WHERE idEstudiante = $1', [id]);
    
    return res.status(200).json({
      message: 'Estudiante actualizado correctamente',
      estudiante: result.rows[0]
    });
  } catch (error) {
    console.error('Error al actualizar estudiante:', error);
    return res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

// Eliminar estudiante
exports.deleteEstudiante = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar si el estudiante existe
    const checkResult = await query('SELECT Usuario_idUsuario FROM Estudiante WHERE idEstudiante = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Estudiante no encontrado' });
    }
    
    const Usuario_idUsuario = checkResult.rows[0].Usuario_idUsuario;
    
    // Iniciar transacción
    await query('BEGIN');
    
    try {
      // Eliminar registros relacionados
      await query('DELETE FROM Asistencia WHERE Estudiante_idEstudiante = $1', [id]);
      await query('DELETE FROM Calificacion WHERE Estudiante_idEstudiante = $1', [id]);
      await query('DELETE FROM Beca WHERE Estudiante_idEstudiante = $1', [id]);
      await query('DELETE FROM Registro_conduct WHERE Estudiante_idEstudiante = $1', [id]);
      await query('DELETE FROM Info_medico WHERE Estudiante_idEstudiante = $1', [id]);
      await query('DELETE FROM Documentacion_estudiante WHERE Estudiante_idEstudiante = $1', [id]);
      await query('DELETE FROM Estudiante_has_Tutor WHERE Estudiante_idEstudiante = $1', [id]);
      
      // Eliminar cuotas y pagos asociados
      const cuotasResult = await query('SELECT idCuota FROM Cuota WHERE Estudiante_idEstudiante = $1', [id]);
      for (const cuota of cuotasResult.rows) {
        await query('DELETE FROM Pago WHERE Cuota_idCuota = $1', [cuota.idCuota]);
      }
      await query('DELETE FROM Cuota WHERE Estudiante_idEstudiante = $1', [id]);
      
      // Eliminar estudiante
      await query('DELETE FROM Estudiante WHERE idEstudiante = $1', [id]);
      
      // Eliminar configuración de accesibilidad
      await query('DELETE FROM Conf_accesibilidad WHERE Usuario_idUsuario = $1', [Usuario_idUsuario]);
      
      // Eliminar usuario
      await query('DELETE FROM Usuario WHERE idUsuario = $1', [Usuario_idUsuario]);
      
      // Confirmar transacción
      await query('COMMIT');
      
      return res.status(200).json({ message: 'Estudiante eliminado correctamente' });
    } catch (error) {
      // Revertir transacción en caso de error
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error al eliminar estudiante:', error);
    return res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

// ===== CONTROLADORES PARA PROFESORES =====

// Obtener todos los profesores
exports.getAllProfesores = async (req, res) => {
  try {
    const result = await query(`
      SELECT p.*, u.nomb_user 
      FROM Profesor p
      INNER JOIN Usuario u ON p.Usuario_idUsuario = u.idUsuario
      ORDER BY p.ape_prof, p.nomb_prof
    `);
    
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener profesores:', error);
    return res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

// Obtener profesor por ID
exports.getProfesorById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(`
      SELECT p.*, u.nomb_user, u.tipo_user 
      FROM Profesor p
      INNER JOIN Usuario u ON p.Usuario_idUsuario = u.idUsuario
      WHERE p.idProfesor = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Profesor no encontrado' });
    }
    
    // Obtener materias asignadas
    const materias = await query(`
      SELECT m.idMateria, m.nomb_materia, c.nomb_curso, c.año
      FROM Materia m
      INNER JOIN Curso c ON m.Curso_idCurso = c.idCurso
      WHERE m.Profesor_idProfesor = $1
    `, [id]);
    
    // Obtener configuración de accesibilidad
    const accessibilityResult = await query(`
      SELECT ca.* 
      FROM Conf_accesibilidad ca
      INNER JOIN Usuario u ON ca.Usuario_idUsuario = u.idUsuario
      INNER JOIN Profesor p ON p.Usuario_idUsuario = u.idUsuario
      WHERE p.idProfesor = $1
    `, [id]);
    
    const profesor = {
      ...result.rows[0],
      materias: materias.rows,
      configuracionAccesibilidad: accessibilityResult.rows.length > 0 ? accessibilityResult.rows[0] : null
    };
    
    return res.status(200).json(profesor);
  } catch (error) {
    console.error('Error al obtener profesor:', error);
    return res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

// Crear nuevo profesor
exports.createProfesor = async (req, res) => {
  try {
    // Validar inputs
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { 
      nomb_prof, ape_prof, ci_prof, direccion_prof, fecha_nac_prof,
      especialidad, email, telef1_prof, telef2_prof,
      nomb_user, password 
    } = req.body;
    
    // Crear transacción
    await query('BEGIN');
    
    try {
      // 1. Crear usuario
      const hashedPassword = await bcrypt.hash(password || '123456', 10); // Password por defecto si no se proporciona
      
      const userResult = await query(
        'INSERT INTO Usuario (nomb_user, contraseña_user, tipo_user) VALUES ($1, $2, $3) RETURNING idUsuario',
        [nomb_user || `prof_${ci_prof}`, hashedPassword, 'profesor']
      );
      
      const Usuario_idUsuario = userResult.rows[0].idUsuario;
      
      // 2. Crear profesor
      const profesorResult = await query(
        `INSERT INTO Profesor (
          Usuario_idUsuario, nomb_prof, ape_prof, ci_prof, 
          direccion_prof, fecha_nac_prof, especialidad, 
          email, telef1_prof, telef2_prof
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING idProfesor`,
        [
          Usuario_idUsuario, nomb_prof, ape_prof, ci_prof,
          direccion_prof || null, fecha_nac_prof || null, especialidad || null,
          email || null, telef1_prof || null, telef2_prof || null
        ]
      );
      
      // Confirmar transacción
      await query('COMMIT');
      
      return res.status(201).json({
        message: 'Profesor creado correctamente',
        profesor: {
          idProfesor: profesorResult.rows[0].idProfesor,
          nomb_prof,
          ape_prof,
          ci_prof,
          Usuario_idUsuario
        }
      });
      
    } catch (error) {
      // Revertir transacción en caso de error
      await query('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.error('Error al crear profesor:', error);
    return res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

// Actualizar profesor
exports.updateProfesor = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      nomb_prof, ape_prof, ci_prof, direccion_prof, fecha_nac_prof,
      especialidad, email, telef1_prof, telef2_prof
    } = req.body;
    
    // Verificar si el profesor existe
    const checkResult = await query('SELECT * FROM Profesor WHERE idProfesor = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Profesor no encontrado' });
    }
    
    // Actualizar profesor
    await query(
      `UPDATE Profesor SET
        nomb_prof = COALESCE($1, nomb_prof),
        ape_prof = COALESCE($2, ape_prof),
        ci_prof = COALESCE($3, ci_prof),
        direccion_prof = COALESCE($4, direccion_prof),
        fecha_nac_prof = COALESCE($5, fecha_nac_prof),
        especialidad = COALESCE($6, especialidad),
        email = COALESCE($7, email),
        telef1_prof = COALESCE($8, telef1_prof),
        telef2_prof = COALESCE($9, telef2_prof)
      WHERE idProfesor = $10`,
      [
        nomb_prof, ape_prof, ci_prof, direccion_prof, fecha_nac_prof,
        especialidad, email, telef1_prof, telef2_prof, id
      ]
    );
    
    // Obtener profesor actualizado
    const result = await query('SELECT * FROM Profesor WHERE idProfesor = $1', [id]);
    
    return res.status(200).json({
      message: 'Profesor actualizado correctamente',
      profesor: result.rows[0]
    });
  } catch (error) {
    console.error('Error al actualizar profesor:', error);
    return res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

// Eliminar profesor
exports.deleteProfesor = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar si el profesor existe
    const checkResult = await query('SELECT Usuario_idUsuario FROM Profesor WHERE idProfesor = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: 'Profesor no encontrado' });
    }
    
    const Usuario_idUsuario = checkResult.rows[0].Usuario_idUsuario;
    
    // Iniciar transacción
    await query('BEGIN');
    
    try {
      // Actualizar materias asignadas a este profesor (asignar NULL)
      await query('UPDATE Materia SET Profesor_idProfesor = NULL WHERE Profesor_idProfesor = $1', [id]);
      
      // Eliminar profesor
      await query('DELETE FROM Profesor WHERE idProfesor = $1', [id]);
      
      // Eliminar configuración de accesibilidad
      await query('DELETE FROM Conf_accesibilidad WHERE Usuario_idUsuario = $1', [Usuario_idUsuario]);
      
      // Eliminar usuario
      await query('DELETE FROM Usuario WHERE idUsuario = $1', [Usuario_idUsuario]);
      
      // Confirmar transacción
      await query('COMMIT');
      
      return res.status(200).json({ message: 'Profesor eliminado correctamente' });
    } catch (error) {
      // Revertir transacción en caso de error
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error al eliminar profesor:', error);
    return res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};