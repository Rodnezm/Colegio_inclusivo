const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
const { query } = require('../config/database');

// Registro de usuario
exports.register = async (req, res) => {
  try {
    // Validar inputs
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { nomb_user, password, tipo_user, perfil } = req.body;

    // Verificar si el usuario ya existe
    const userCheck = await query('SELECT * FROM Usuario WHERE nomb_user = $1', [nomb_user]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ message: 'El nombre de usuario ya está registrado' });
    }

    // Encriptar contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insertar usuario en la base de datos
    const result = await query(
      'INSERT INTO Usuario (nomb_user, contraseña_user, tipo_user) VALUES ($1, $2, $3) RETURNING idUsuario, nomb_user, tipo_user',
      [nomb_user, hashedPassword, tipo_user]
    );

    const user = result.rows[0];

    // Si se proporcionan datos de perfil, insertar en la tabla correspondiente
    if (perfil) {
      if (tipo_user === 'profesor') {
        await query(
          'INSERT INTO Profesor (Usuario_idUsuario, nomb_prof, ape_prof, ci_prof, email) VALUES ($1, $2, $3, $4, $5)',
          [
            user.idUsuario, 
            perfil.nomb_prof || '', 
            perfil.ape_prof || '', 
            perfil.ci_prof || '', 
            perfil.email || ''
          ]
        );
      } else if (tipo_user === 'estudiante') {
        await query(
          'INSERT INTO Estudiante (Usuario_idUsuario, Curso_idCurso, nomb_est, ape_est, ci_est) VALUES ($1, $2, $3, $4, $5)',
          [
            user.idUsuario, 
            perfil.Curso_idCurso || 1, 
            perfil.nomb_est || '', 
            perfil.ape_est || '', 
            perfil.ci_est || ''
          ]
        );
      }
    }

    // Generar token JWT
    const token = jwt.sign(
      { id: user.idUsuario, nomb_user: user.nomb_user, tipo_user: user.tipo_user },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    return res.status(201).json({
      message: 'Usuario registrado correctamente',
      user: {
        id: user.idUsuario,
        nomb_user: user.nomb_user,
        tipo_user: user.tipo_user
      },
      token
    });
  } catch (error) {
    console.error('Error en registro:', error);
    return res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

// Iniciar sesión
exports.login = async (req, res) => {
  try {
    // Validar inputs
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { nomb_user, password } = req.body;

    // Buscar usuario por nombre de usuario
    const result = await query('SELECT * FROM Usuario WHERE nomb_user = $1', [nomb_user]);
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const user = result.rows[0];

    // Verificar contraseña
    const isPasswordValid = await bcrypt.compare(password, user.contraseña_user);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    // Buscar información adicional según el tipo de usuario
    let userDetails = null;
    if (user.tipo_user === 'profesor') {
      const profesorResult = await query('SELECT * FROM Profesor WHERE Usuario_idUsuario = $1', [user.idUsuario]);
      if (profesorResult.rows.length > 0) {
        userDetails = profesorResult.rows[0];
      }
    } else if (user.tipo_user === 'estudiante') {
      const estudianteResult = await query('SELECT * FROM Estudiante WHERE Usuario_idUsuario = $1', [user.idUsuario]);
      if (estudianteResult.rows.length > 0) {
        userDetails = estudianteResult.rows[0];
      }
    }

    // Generar token JWT
    const token = jwt.sign(
      { id: user.idUsuario, nomb_user: user.nomb_user, tipo_user: user.tipo_user },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    // Obtener preferencias de accesibilidad si existen
    const accessibilityResult = await query(
      'SELECT * FROM Conf_accesibilidad WHERE Usuario_idUsuario = $1',
      [user.idUsuario]
    );
    
    const accessibilityPreferences = accessibilityResult.rows.length > 0 
      ? accessibilityResult.rows[0] 
      : null;

    return res.status(200).json({
      message: 'Inicio de sesión exitoso',
      user: {
        id: user.idUsuario,
        nomb_user: user.nomb_user,
        tipo_user: user.tipo_user,
        details: userDetails
      },
      accessibilityPreferences,
      token
    });
  } catch (error) {
    console.error('Error en login:', error);
    return res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

// Cerrar sesión
exports.logout = (req, res) => {
  // JWT es stateless, por lo que solo invalidamos en el cliente
  return res.status(200).json({ message: 'Sesión cerrada correctamente' });
};

// Recuperar contraseña
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Buscar usuario que tenga ese email (en Profesor o Estudiante)
    let userId = null;
    
    // Buscar en Profesor
    const profesorResult = await query('SELECT Usuario_idUsuario FROM Profesor WHERE email = $1', [email]);
    if (profesorResult.rows.length > 0) {
      userId = profesorResult.rows[0].Usuario_idUsuario;
    } else {
      // Buscar en Estudiante
      const estudianteResult = await query('SELECT Usuario_idUsuario FROM Estudiante WHERE email_est = $1', [email]);
      if (estudianteResult.rows.length > 0) {
        userId = estudianteResult.rows[0].Usuario_idUsuario;
      }
    }

    if (!userId) {
      // Por seguridad, no informamos si el correo existe o no
      return res.status(200).json({ message: 'Si el correo existe, recibirás instrucciones para restablecer tu contraseña' });
    }

    // Generar token único de restablecimiento
    const resetToken = jwt.sign(
      { id: userId },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Aquí enviaríamos un correo con el enlace de restablecimiento
    // Por simplicidad, solo devolvemos el token en la respuesta
    return res.status(200).json({
      message: 'Si el correo existe, recibirás instrucciones para restablecer tu contraseña',
      // En producción no enviaríamos el token en la respuesta
      resetToken
    });
  } catch (error) {
    console.error('Error en recuperación de contraseña:', error);
    return res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

// Restablecer contraseña
exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    // Verificar token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(400).json({ message: 'Token inválido o expirado' });
    }

    // Encriptar nueva contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Actualizar contraseña
    await query(
      'UPDATE Usuario SET contraseña_user = $1 WHERE idUsuario = $2',
      [hashedPassword, decoded.id]
    );

    return res.status(200).json({ message: 'Contraseña restablecida correctamente' });
  } catch (error) {
    console.error('Error en restablecimiento de contraseña:', error);
    return res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

// Obtener configuración de accesibilidad
exports.getAccessibilityConfig = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await query(
      'SELECT * FROM Conf_accesibilidad WHERE Usuario_idUsuario = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No se encontró configuración de accesibilidad' });
    }
    
    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error al obtener configuración de accesibilidad:', error);
    return res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};

// Actualizar configuración de accesibilidad
exports.updateAccessibilityConfig = async (req, res) => {
  try {
    const userId = req.user.id;
    const accessibilityConfig = req.body;
    
    // Verificar si ya existe una configuración
    const existingConfig = await query(
      'SELECT * FROM Conf_accesibilidad WHERE Usuario_idUsuario = $1',
      [userId]
    );
    
    if (existingConfig.rows.length === 0) {
      // Crear nueva configuración
      await query(
        `INSERT INTO Conf_accesibilidad (
          Usuario_idUsuario, 
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
          time_extra_actividad
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          userId,
          accessibilityConfig.tipo_discapacidad || null,
          accessibilityConfig.subtitulos_activados || false,
          accessibilityConfig.lenguajes_señas || false,
          accessibilityConfig.alto_contraste || false,
          accessibilityConfig.tamaño_letra || 16,
          accessibilityConfig.velocidad_reproduccion || 1.0,
          accessibilityConfig.transcripcion_automatica || false,
          accessibilityConfig.notif_visuales || false,
          accessibilityConfig.notif_sonoras || false,
          accessibilityConfig.modo_daltonismo || null,
          accessibilityConfig.atajos_teclado || null,
          accessibilityConfig.naveg_voz || false,
          accessibilityConfig.modo_lect_facil || false,
          accessibilityConfig.time_extra_actividad || 0
        ]
      );
    } else {
      // Actualizar configuración existente
      await query(
        `UPDATE Conf_accesibilidad SET
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
          time_extra_actividad = $14
        WHERE Usuario_idUsuario = $15`,
        [
          accessibilityConfig.tipo_discapacidad || null,
          accessibilityConfig.subtitulos_activados || false,
          accessibilityConfig.lenguajes_señas || false,
          accessibilityConfig.alto_contraste || false,
          accessibilityConfig.tamaño_letra || 16,
          accessibilityConfig.velocidad_reproduccion || 1.0,
          accessibilityConfig.transcripcion_automatica || false,
          accessibilityConfig.notif_visuales || false,
          accessibilityConfig.notif_sonoras || false,
          accessibilityConfig.modo_daltonismo || null,
          accessibilityConfig.atajos_teclado || null,
          accessibilityConfig.naveg_voz || false,
          accessibilityConfig.modo_lect_facil || false,
          accessibilityConfig.time_extra_actividad || 0,
          userId
        ]
      );
    }
    
    // Obtener la configuración actualizada
    const updatedConfig = await query(
      'SELECT * FROM Conf_accesibilidad WHERE Usuario_idUsuario = $1',
      [userId]
    );
    
    return res.status(200).json({
      message: 'Configuración de accesibilidad actualizada correctamente',
      config: updatedConfig.rows[0]
    });
  } catch (error) {
    console.error('Error al actualizar configuración de accesibilidad:', error);
    return res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};
