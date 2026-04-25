import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db, itinerariesTable } from "@workspace/db";

const router: IRouter = Router();

const BASE_OFFSET = 12_847;

router.get("/stats", async (_req, res) => {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(itinerariesTable);
  const real = row?.count ?? 0;
  res.json({ tripsPlanned: BASE_OFFSET + real });
});

export default router;
