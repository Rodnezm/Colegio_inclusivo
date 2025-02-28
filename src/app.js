const express = require('express');
const cors = require('cors');
const path = require('path');
const { setupLogging } = require('./config/logging');
require('dotenv').config();

// Importar rutas
//const authRoutes = require('./routes/auth.routes');
//const userRoutes = require('./routes/user.routes');

const app = express();

// Configuración de middlewares
app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Configuración de logging
setupLogging();

// Rutas de la API
//app.use('/api/auth', authRoutes);
//app.use('/api/users', userRoutes);

// Middleware para accesibilidad - Agregar encabezados especiales
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
});

// Manejo de errores global
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        message: '¡Algo salió mal!',
        error: process.env.NODE_ENV === 'development' ? err.message : 'Error interno del servidor'
    });
});

// Ruta para verificar estado del servidor
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'OK', message: 'Servidor funcionando correctamente' });
});

module.exports = app;