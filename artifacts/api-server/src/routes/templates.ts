import { Router, type IRouter } from "express";
import { TRIP_TEMPLATES } from "../lib/templates";

const router: IRouter = Router();

router.get("/templates", (_req, res) => {
  res.json(TRIP_TEMPLATES);
});

export default router;
