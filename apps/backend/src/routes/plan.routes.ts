import { Router } from "express";
import {
  getPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan,
} from "../controllers/plan.controller";

const router: Router = Router();

router.get("/", getPlans);
router.get("/:id", getPlanById);
router.post("/", createPlan);
router.put("/:id", updatePlan);
router.delete("/:id", deletePlan);

export default router;