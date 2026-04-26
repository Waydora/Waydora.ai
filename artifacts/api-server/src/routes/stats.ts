import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db, itinerariesTable } from "@workspace/db";

const router: IRouter = Router();

const ANCHOR_MS = Date.UTC(2026, 3, 26, 0, 0, 0);
const ANCHOR_BASE = 12_847;
const SECONDS_PER_TRIP = 180;

router.get("/stats", async (_req, res) => {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(itinerariesTable);
  const real = row?.count ?? 0;

  const elapsedSec = Math.max(0, Math.floor((Date.now() - ANCHOR_MS) / 1000));
  const organic = ANCHOR_BASE + Math.floor(elapsedSec / SECONDS_PER_TRIP);

  res.json({ tripsPlanned: organic + real });
});

export default router;
