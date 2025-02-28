const app = require('./app');
const { setupDatabase } = require('./config/database');
require('dotenv').config();

// Iniciar servidor
const PORT = process.env.PORT || 3000;

// Función para iniciar la aplicación
const startServer = async () => {
  try {
    // Inicializar conexión a la base de datos
    const dbConnected = await setupDatabase();
    
    if (!dbConnected) {
      console.error('Error al conectar a la base de datos. Asegúrate de que PostgreSQL esté en ejecución.');
      process.exit(1);
    }
    
    app.listen(PORT, () => {
      console.log(`Servidor corriendo en el puerto ${PORT}`);
      console.log(`Modo: ${process.env.NODE_ENV}`);
      console.log('Conexión a la base de datos establecida correctamente');
    });
  } catch (error) {
    console.error('Error al iniciar el servidor:', error);
    process.exit(1);
  }
};

// Manejar terminación del proceso
process.on('SIGINT', () => {
  console.log('Cerrando la aplicación...');
  process.exit(0);
});

// Iniciar el servidor
startServer();