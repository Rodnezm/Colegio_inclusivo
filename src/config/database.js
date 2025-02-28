const { Pool } = require('pg');

// Crear conexión a la base de datos PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Probar la conexión a la base de datos
const setupDatabase = async () => {
  try {
    const client = await pool.connect();
    console.log('Conexión a la base de datos establecida correctamente');
    client.release();
    return true;
  } catch (error) {
    console.error('Error al conectar a la base de datos:', error);
    return false;
  }
};

module.exports = {
  pool,
  setupDatabase,
  query: (text, params) => pool.query(text, params),
};