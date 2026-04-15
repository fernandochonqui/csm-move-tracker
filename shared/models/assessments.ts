import { pgTable, varchar, timestamp, jsonb, text, integer, serial, boolean } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const assessments = pgTable("assessments", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  accountName: varchar("account_name"),
  transcript: text("transcript").notNull(),
  scores: jsonb("scores").notNull(),
  stakeholders: jsonb("stakeholders"),
  executiveSummary: text("executive_summary"),
  keyStrengths: jsonb("key_strengths"),
  coachingTips: jsonb("coaching_tips"),
  qa: jsonb("qa"),
  totalScore: integer("total_score"),
  source: varchar("source").default("manual"),
  gongConversationId: varchar("gong_conversation_id").unique(),
  gongMetadata: jsonb("gong_metadata"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const assessmentShares = pgTable("assessment_shares", {
  id: serial("id").primaryKey(),
  assessmentId: integer("assessment_id").notNull().references(() => assessments.id),
  sharedByUserId: varchar("shared_by_user_id").notNull().references(() => users.id),
  sharedWithUserId: varchar("shared_with_user_id").notNull().references(() => users.id),
  permission: varchar("permission").notNull().default("view"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const csqlCallOverrides = pgTable("csql_call_overrides", {
  id: serial("id").primaryKey(),
  oppId: varchar("opp_id").notNull().unique(),
  assessmentId: integer("assessment_id").notNull().references(() => assessments.id),
  overriddenBy: varchar("overridden_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const csqlMatchConfidence = pgTable("csql_match_confidence", {
  id: serial("id").primaryKey(),
  oppId: varchar("opp_id").notNull().unique(),
  assessmentId: integer("assessment_id").notNull().references(() => assessments.id),
  confidence: varchar("confidence").notNull(),
  reasoning: text("reasoning"),
  isManual: boolean("is_manual").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const csqlExclusions = pgTable("csql_exclusions", {
  id: serial("id").primaryKey(),
  oppId: varchar("opp_id").notNull().unique(),
  excludedBy: varchar("excluded_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Assessment = typeof assessments.$inferSelect;
export type NewAssessment = typeof assessments.$inferInsert;
export type AssessmentShare = typeof assessmentShares.$inferSelect;
export type NewAssessmentShare = typeof assessmentShares.$inferInsert;
export type CSQLCallOverride = typeof csqlCallOverrides.$inferSelect;
export type CSQLMatchConfidence = typeof csqlMatchConfidence.$inferSelect;
export type CSQLExclusion = typeof csqlExclusions.$inferSelect;
