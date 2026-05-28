import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

export const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,

  ssl: {
    rejectUnauthorized: false,
  },
});

// prueba de conexión
pool.connect()
  .then(() => {
    console.log("✅ Base de datos conectada");
  })
  .catch((error) => {
    console.error("❌ Error conectando DB:", error.message);
  });