const winston = require('winston');
const path = require('path');

const setupLogging = () => {
  const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    defaultMeta: { service: 'sistema-educativo' },
    transports: [
      // Escribir logs a consola
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        ),
      }),
    ],
  });

  // Añadir el logger a global para usarlo en toda la aplicación
  global.logger = logger;

  // Manejar excepciones no capturadas
  process.on('uncaughtException', (error) => {
    logger.error('Excepción no capturada:', error);
  });

  return logger;
};

module.exports = {
  setupLogging,
};