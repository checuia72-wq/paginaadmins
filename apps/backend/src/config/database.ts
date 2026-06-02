import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const dbConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 20,                    // máximo de conexiones en el pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
};

// Si no tienes DATABASE_URL, usa las variables individuales
const poolConfig = process.env.DATABASE_URL 
  ? dbConfig 
  : {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_DATABASE,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: { rejectUnauthorized: false },
    };

export const pool = new Pool(poolConfig);

// Prueba de conexión
pool.connect()
  .then(() => {
    console.log("✅ Base de datos conectada correctamente");
  })
  .catch((error) => {
    console.error("❌ Error conectando DB:", error.message);
    console.error("Revisa tus variables de entorno en .env");
  });