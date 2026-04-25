import { pgTable, serial, text, jsonb, timestamp } from "drizzle-orm/pg-core";

export const itinerariesTable = pgTable("itineraries", {
  id: serial("id").primaryKey(),
  shareSlug: text("share_slug").notNull().unique(),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type ItineraryRow = typeof itinerariesTable.$inferSelect;
export type InsertItineraryRow = typeof itinerariesTable.$inferInsert;
