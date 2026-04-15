import { pgTable, varchar, serial, timestamp } from "drizzle-orm/pg-core";

export const csmRoster = pgTable("csm_roster", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  segment: varchar("segment").notNull(),
  attachment: varchar("attachment").notNull(),
  manager: varchar("manager").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type CsmRosterEntry = typeof csmRoster.$inferSelect;
export type NewCsmRosterEntry = typeof csmRoster.$inferInsert;
