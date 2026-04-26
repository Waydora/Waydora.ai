import { Router, type IRouter } from "express";
import healthRouter from "./health";
import chatRouter from "./chat";
import itinerariesRouter from "./itineraries";
import suggestionsRouter from "./suggestions";
import statsRouter from "./stats";
import templatesRouter from "./templates";

const router: IRouter = Router();

router.use(healthRouter);
router.use(chatRouter);
router.use(suggestionsRouter);
router.use(statsRouter);
router.use(templatesRouter);
router.use(itinerariesRouter);

export default router;
