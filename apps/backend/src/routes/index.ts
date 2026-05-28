import { Router } from "express";
import planRoutes from "./plan.routes";
import clienteRoutes from "./cliente.routes";
import reservaRoutes from "./reserva.routes";
import participanteRoutes from "./participante.routers"

const router: Router = Router();

router.use("/planes", planRoutes);
router.use("/clientes", clienteRoutes);
router.use("/reservas", reservaRoutes);
router.use("/participantes", participanteRoutes)

export default router;