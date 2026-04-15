import { pgTable, varchar, timestamp, jsonb, text, integer, serial, boolean } from "drizzle-orm/pg-core";

export const qualifyingCallFilters = pgTable("qualifying_call_filters", {
  id: serial("id").primaryKey(),
  key: varchar("key").unique().notNull(),
  label: varchar("label").notNull(),
  description: text("description"),
  source: varchar("source"),
  enabled: boolean("enabled").default(true),
  params: jsonb("params"),
  sortOrder: integer("sort_order"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type QualifyingCallFilter = typeof qualifyingCallFilters.$inferSelect;
export type NewQualifyingCallFilter = typeof qualifyingCallFilters.$inferInsert;
