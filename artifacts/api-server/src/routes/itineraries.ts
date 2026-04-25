import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db, itinerariesTable } from "@workspace/db";
import {
  SaveItineraryBody,
  GetItineraryParams,
  DeleteItineraryParams,
  GetSharedItineraryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function makeShareSlug(): string {
  return randomBytes(6).toString("base64url").toLowerCase();
}

function rowToResponse(row: typeof itinerariesTable.$inferSelect) {
  return {
    id: row.id,
    shareSlug: row.shareSlug,
    createdAt: row.createdAt.toISOString(),
    itinerary: row.data,
  };
}

router.get("/itineraries", async (_req, res) => {
  const rows = await db
    .select()
    .from(itinerariesTable)
    .orderBy(itinerariesTable.createdAt);
  res.json(rows.map(rowToResponse).reverse());
});

router.post("/itineraries", async (req, res) => {
  const parsed = SaveItineraryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const slug = makeShareSlug();
  const [row] = await db
    .insert(itinerariesTable)
    .values({
      shareSlug: slug,
      data: parsed.data.itinerary,
    })
    .returning();

  if (!row) {
    res.status(500).json({ error: "Failed to save itinerary" });
    return;
  }

  res.status(201).json(rowToResponse(row));
});

router.get("/itineraries/share/:slug", async (req, res) => {
  const parsed = GetSharedItineraryParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid slug" });
    return;
  }

  const [row] = await db
    .select()
    .from(itinerariesTable)
    .where(eq(itinerariesTable.shareSlug, parsed.data.slug))
    .limit(1);

  if (!row) {
    res.status(404).json({ error: "Itinerary not found" });
    return;
  }

  res.json(rowToResponse(row));
});

router.get("/itineraries/:id", async (req, res) => {
  const parsed = GetItineraryParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [row] = await db
    .select()
    .from(itinerariesTable)
    .where(eq(itinerariesTable.id, parsed.data.id))
    .limit(1);

  if (!row) {
    res.status(404).json({ error: "Itinerary not found" });
    return;
  }

  res.json(rowToResponse(row));
});

router.delete("/itineraries/:id", async (req, res) => {
  const parsed = DeleteItineraryParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const result = await db
    .delete(itinerariesTable)
    .where(eq(itinerariesTable.id, parsed.data.id))
    .returning({ id: itinerariesTable.id });

  if (result.length === 0) {
    res.status(404).json({ error: "Itinerary not found" });
    return;
  }

  res.status(204).end();
});

export default router;
