import { Router } from "express";
import {
  getParticipantes,
  getParticipanteById,
  createParticipante,
  updateParticipante,
  deleteParticipante,
} from "../controllers/participante.controller";

const router: Router = Router();

router.get("/", getParticipantes);
router.get("/:id", getParticipanteById);
router.post("/", createParticipante);
router.put("/:id", updateParticipante);
router.delete("/:id", deleteParticipante);

export default router;