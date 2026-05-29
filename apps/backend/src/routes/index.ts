import { Router } from "express";
import planRoutes from "./plan.routes";
import clienteRoutes from "./cliente.routes";
import reservaRoutes from "./reserva.routes";
import participanteRoutes from "./participante.routers"
import { authMiddleware } from "../middlewares/auth.middleware";

const router: Router = Router();

router.use("/planes", authMiddleware, planRoutes);
router.use("/clientes", authMiddleware, clienteRoutes);
router.use("/reservas", authMiddleware, reservaRoutes);
router.use("/participantes", authMiddleware, participanteRoutes);

export default router;