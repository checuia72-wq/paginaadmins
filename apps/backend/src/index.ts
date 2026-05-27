import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "Backend funcionando correctamente" });
});

app.listen(3000, () => {
  console.log("Servidor backend corriendo en http://localhost:3000");
});