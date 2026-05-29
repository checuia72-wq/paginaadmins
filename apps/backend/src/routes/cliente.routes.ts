import { Router } from "express";
import {
  getClientes,
  getClienteByTelefono,
  createCliente,
  updateCliente,
  deleteCliente,
} from "../controllers/cliente.controller";

const router: Router = Router();

router.get("/", getClientes);
router.get("/:telefono", getClienteByTelefono);
router.post("/", createCliente);
router.put("/:telefono", updateCliente);
router.delete("/:telefono", deleteCliente);

export default router;