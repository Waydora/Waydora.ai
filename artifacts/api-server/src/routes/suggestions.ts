import { Router, type IRouter } from "express";
import { SUGGESTIONS } from "../lib/suggestions";

const router: IRouter = Router();

router.get("/suggestions", (_req, res) => {
  res.json(SUGGESTIONS);
});

export default router;
