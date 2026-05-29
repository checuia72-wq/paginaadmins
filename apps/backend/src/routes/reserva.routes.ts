import { Router } from "express";
import {
  getReservas,
  getReservaById,
  createReserva,
  updateReserva,
  deleteReserva,
} from "../controllers/reserva.controller";

const router: Router = Router();

router.get("/", getReservas);
router.get("/:id", getReservaById);
router.post("/", createReserva);
router.put("/:id", updateReserva);
router.delete("/:id", deleteReserva);

export default router;