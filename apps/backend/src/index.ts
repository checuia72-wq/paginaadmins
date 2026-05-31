import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import routes from "./routes"

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api", routes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor backend corriendo en http://localhost:${PORT}`);
});
