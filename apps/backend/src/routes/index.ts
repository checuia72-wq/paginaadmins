import { Router } from "express";
import planRoutes from "./plan.routes.js";
import clienteRoutes from "./cliente.routes.js";
import reservaRoutes from "./reserva.routes.js";
import participanteRoutes from "./participante.routers.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router: Router = Router();

router.use("/planes", authMiddleware, planRoutes);
router.use("/clientes", authMiddleware, clienteRoutes);
router.use("/reservas", authMiddleware, reservaRoutes);
router.use("/participantes", authMiddleware, participanteRoutes);

export default router;