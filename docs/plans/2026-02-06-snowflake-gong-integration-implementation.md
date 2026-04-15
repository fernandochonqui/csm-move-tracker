# Snowflake Gong Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Automatically surface qualifying Gong call transcripts from Snowflake and let CSMs analyze them with one-click MOVE scoring.

**Architecture:** Express backend connects to Snowflake via `snowflake-sdk`, serves qualifying calls to a new React "Gong Calls" tab. Transcripts are flattened from Snowflake's JSON VARIANT into plain text, then fed through the existing Gemini analysis pipeline. Results are saved as assessments with a `source: "gong"` flag.

**Tech Stack:** snowflake-sdk (Node.js), Drizzle ORM (schema migration), React Query (data fetching), Tailwind CSS (styling), existing Gemini integration.

**Design Doc:** `docs/plans/2026-02-06-snowflake-gong-integration-design.md`

---

## Task 1: Install snowflake-sdk dependency

**Files:**
- Modify: `package.json`

**Step 1: Install the package**

Run:
```bash
cd /Users/aaron.nam/Desktop/Repos/251217-PD-Copy-of-CSM-MOVE-Framework-Self-assessment_vAN/.worktrees/feature/snowflake-gong-integration
npm install snowflake-sdk
npm install --save-dev @types/snowflake-sdk
```

Expected: Package added to dependencies.

**Step 2: Verify installation**

Run:
```bash
node -e "require('snowflake-sdk'); console.log('snowflake-sdk loaded')"
```

Expected: `snowflake-sdk loaded`

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add snowflake-sdk dependency"
```

---

## Task 2: Add Gong columns to assessments schema

**Files:**
- Modify: `shared/models/assessments.ts`

**Step 1: Add the new columns**

Add three new columns to the `assessments` table in `shared/models/assessments.ts`:

```typescript
import { pgTable, varchar, timestamp, jsonb, text, integer, serial } from "drizzle-orm/pg-core";
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
```

The three new columns are:
- `source` — VARCHAR, default `"manual"`. Values: `"manual"` | `"gong"`.
- `gongConversationId` — VARCHAR, nullable, unique. The Gong `CONVERSATION_ID` value. Unique constraint prevents re-analysis of the same call.
- `gongMetadata` — JSONB, nullable. Stores `{ callUrl, csmName, renewalDate, opportunityName, daysUntilRenewal, durationMins }`.

**Step 2: Push schema to database**

Run:
```bash
npm run db:push
```

Expected: Drizzle applies the migration. Three new columns appear on `assessments` table.

**Step 3: Verify build still passes**

Run:
```bash
npm run build
```

Expected: Build succeeds with no TypeScript errors.

**Step 4: Commit**

```bash
git add shared/models/assessments.ts
git commit -m "feat: add source, gongConversationId, gongMetadata columns to assessments"
```

---

## Task 3: Create Snowflake connector module

**Files:**
- Create: `server/snowflake.ts`

**Step 1: Create the Snowflake connection and query module**

Create `server/snowflake.ts` with the following content:

```typescript
import snowflake from "snowflake-sdk";

// Disable OCSP check for simpler connectivity (common in internal tools)
snowflake.configure({ ocspFailOpen: true });

function getConnection(): Promise<snowflake.Connection> {
  return new Promise((resolve, reject) => {
    const connection = snowflake.createConnection({
      account: process.env.SNOWFLAKE_ACCOUNT!,
      username: process.env.SNOWFLAKE_USER!,
      password: process.env.SNOWFLAKE_PASSWORD!,
      database: process.env.SNOWFLAKE_DATABASE || "SELFSERVE",
      schema: process.env.SNOWFLAKE_SCHEMA || "PUBLIC",
      warehouse: process.env.SNOWFLAKE_WAREHOUSE!,
      role: process.env.SNOWFLAKE_ROLE || undefined,
    });

    connection.connect((err) => {
      if (err) {
        console.error("Snowflake connection failed:", err.message);
        reject(err);
      } else {
        resolve(connection);
      }
    });
  });
}

function executeQuery<T = Record<string, unknown>>(
  connection: snowflake.Connection,
  sqlText: string,
  binds: snowflake.Binds = []
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    connection.execute({
      sqlText,
      binds,
      complete: (err, _stmt, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve((rows || []) as T[]);
        }
      },
    });
  });
}

export interface QualifyingCall {
  CONVERSATION_ID: string;
  CALL_TITLE: string;
  CALL_DATE: string;
  CALL_URL: string;
  CSM_NAME: string;
  CSM_EMAIL: string;
  DURATION_MINS: number;
  OPPORTUNITY_NAME: string;
  RENEWAL_DATE: string;
  DAYS_UNTIL_RENEWAL: number;
}

const QUALIFYING_CALLS_SQL = `
WITH csm_calls AS (
    SELECT
        c.CONVERSATION_KEY,
        c.CONVERSATION_ID,
        c.TITLE AS CALL_TITLE,
        c.STATUS,
        c.CALL_URL,
        DATEDIFF('second', c.PLANNED_START_DATETIME, c.PLANNED_END_DATETIME) AS DURATION_SEC,
        u.FIRST_NAME || ' ' || u.LAST_NAME AS CSM_NAME,
        u.TITLE AS CSM_TITLE,
        u.EMAIL AS CSM_EMAIL,
        c.PLANNED_START_DATETIME::DATE AS CALL_DATE
    FROM CLEAN.GONG.CALLS c
    JOIN CLEAN.GONG.USERS u ON c.OWNER_ID = u.USER_ID
    WHERE c.STATUS = 'COMPLETED'
      AND u.TITLE ILIKE '%customer success%'
      AND DATEDIFF('second', c.PLANNED_START_DATETIME, c.PLANNED_END_DATETIME) > 1800
)
SELECT DISTINCT
    cc.CONVERSATION_ID,
    cc.CALL_TITLE,
    cc.CALL_DATE,
    cc.CALL_URL,
    cc.CSM_NAME,
    cc.CSM_EMAIL,
    cc.DURATION_SEC / 60 AS DURATION_MINS,
    o.NAME AS OPPORTUNITY_NAME,
    o.TYPE AS OPP_TYPE,
    o.CLOSEDATE::VARCHAR AS RENEWAL_DATE,
    DATEDIFF('day', CURRENT_DATE(), o.CLOSEDATE) AS DAYS_UNTIL_RENEWAL
FROM csm_calls cc
JOIN CLEAN.GONG.CALL_TRANSCRIPTS ct
    ON cc.CONVERSATION_KEY = ct.CONVERSATION_KEY
JOIN CLEAN.GONG.CONVERSATION_CONTEXTS ctx
    ON cc.CONVERSATION_KEY = ctx.CONVERSATION_KEY
    AND ctx.OBJECT_TYPE = 'opportunity'
JOIN CLEAN.SALESFORCE.OPPORTUNITY o
    ON ctx.OBJECT_ID = o.ID
WHERE o.TYPE = 'Renewal'
  AND DATEDIFF('day', CURRENT_DATE(), o.CLOSEDATE) >= 90
  AND (
      ct.TRANSCRIPT::STRING ILIKE '%only using%pandadoc%for%'
      OR ct.TRANSCRIPT::STRING ILIKE '%not using pandadoc%'
      OR ct.TRANSCRIPT::STRING ILIKE '%not leveraging%pandadoc%'
      OR ct.TRANSCRIPT::STRING ILIKE '%not leveraging pandadoc technology%'
  )
  AND LOWER(cc.CSM_EMAIL) = LOWER(?)
ORDER BY DAYS_UNTIL_RENEWAL ASC;
`;

/**
 * Fetch qualifying Gong calls for a specific CSM by email.
 */
export async function getQualifyingCalls(
  csmEmail: string
): Promise<QualifyingCall[]> {
  const conn = await getConnection();
  try {
    return await executeQuery<QualifyingCall>(conn, QUALIFYING_CALLS_SQL, [
      csmEmail,
    ]);
  } finally {
    conn.destroy(() => {});
  }
}

const TRANSCRIPT_SQL = `
SELECT
    p.NAME AS SPEAKER_NAME,
    segment.value:topic::STRING AS TOPIC,
    sentence.value:start::NUMBER AS START_MS,
    sentence.value:text::STRING AS TEXT
FROM CLEAN.GONG.CALLS c
JOIN CLEAN.GONG.CALL_TRANSCRIPTS ct ON c.CONVERSATION_KEY = ct.CONVERSATION_KEY
CROSS JOIN LATERAL FLATTEN(input => PARSE_JSON(ct.TRANSCRIPT)) AS segment
CROSS JOIN LATERAL FLATTEN(input => segment.value:sentences) AS sentence
LEFT JOIN CLEAN.GONG.CONVERSATION_PARTICIPANTS p
    ON c.CONVERSATION_KEY = p.CONVERSATION_KEY
    AND segment.value:speakerId::STRING = p.SPEAKER_ID
WHERE c.CONVERSATION_ID = ?
ORDER BY START_MS ASC;
`;

interface TranscriptRow {
  SPEAKER_NAME: string | null;
  TOPIC: string | null;
  START_MS: number;
  TEXT: string;
}

/**
 * Fetch and flatten a Gong transcript into readable plain text.
 * Returns the same format CSMs paste manually:
 *   [Speaker Name] (00:02:15): "text here..."
 */
export async function getTranscriptText(
  conversationId: string
): Promise<string> {
  const conn = await getConnection();
  try {
    const rows = await executeQuery<TranscriptRow>(conn, TRANSCRIPT_SQL, [
      conversationId,
    ]);

    if (rows.length === 0) {
      throw new Error(`No transcript found for conversation ${conversationId}`);
    }

    return rows
      .map((row) => {
        const speaker = row.SPEAKER_NAME || "Unknown Speaker";
        const totalSeconds = Math.floor((row.START_MS || 0) / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        const timestamp = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
        return `[${speaker}] (${timestamp}): "${row.TEXT}"`;
      })
      .join("\n\n");
  } finally {
    conn.destroy(() => {});
  }
}

/**
 * Check if Snowflake is configured (env vars present).
 */
export function isSnowflakeConfigured(): boolean {
  return !!(
    process.env.SNOWFLAKE_ACCOUNT &&
    process.env.SNOWFLAKE_USER &&
    process.env.SNOWFLAKE_PASSWORD &&
    process.env.SNOWFLAKE_WAREHOUSE
  );
}
```

**Step 2: Verify build passes**

Run:
```bash
npm run build
```

Expected: Build succeeds. (Server-side file, not imported by frontend yet.)

**Step 3: Commit**

```bash
git add server/snowflake.ts
git commit -m "feat: add Snowflake connector with qualifying calls and transcript queries"
```

---

## Task 4: Add Gong API endpoints to Express server

**Files:**
- Modify: `server/index.ts`

**Step 1: Add imports at the top of `server/index.ts`**

Add after the existing imports (line 9):

```typescript
import { getQualifyingCalls, getTranscriptText, isSnowflakeConfigured } from "./snowflake";
```

**Step 2: Add the three Gong endpoints**

Add these three endpoints inside `startServer()`, after the `/api/users/search` endpoint (after line 427) and before the production catch-all route (line 429):

```typescript
  // --- Gong Integration Endpoints ---

  app.get('/api/gong/qualifying-calls', isAuthenticated, async (req: any, res) => {
    try {
      if (!isSnowflakeConfigured()) {
        return res.status(503).json({ error: 'Snowflake integration not configured' });
      }

      const userEmail = req.user?.claims?.email;
      if (!userEmail) {
        return res.status(400).json({ error: 'User email not available' });
      }

      const calls = await getQualifyingCalls(userEmail);

      // Check which calls are already analyzed
      const analyzedCalls = await db.select({ gongConversationId: assessments.gongConversationId })
        .from(assessments)
        .where(sql`${assessments.gongConversationId} IS NOT NULL`);

      const analyzedIds = new Set(analyzedCalls.map(a => a.gongConversationId));

      const enrichedCalls = calls.map(call => ({
        conversationId: call.CONVERSATION_ID,
        title: call.CALL_TITLE,
        callDate: call.CALL_DATE,
        callUrl: call.CALL_URL,
        csmName: call.CSM_NAME,
        durationMins: call.DURATION_MINS,
        opportunityName: call.OPPORTUNITY_NAME,
        renewalDate: call.RENEWAL_DATE,
        daysUntilRenewal: call.DAYS_UNTIL_RENEWAL,
        alreadyAnalyzed: analyzedIds.has(call.CONVERSATION_ID),
      }));

      res.json({
        calls: enrichedCalls,
        total: enrichedCalls.length,
      });
    } catch (error) {
      console.error("Error fetching qualifying calls:", error);
      res.status(500).json({ error: 'Failed to fetch qualifying calls from Snowflake' });
    }
  });

  app.get('/api/gong/transcript/:conversationId', isAuthenticated, async (req: any, res) => {
    try {
      if (!isSnowflakeConfigured()) {
        return res.status(503).json({ error: 'Snowflake integration not configured' });
      }

      const { conversationId } = req.params;
      const transcript = await getTranscriptText(conversationId);
      res.json({ conversationId, transcript });
    } catch (error) {
      console.error("Error fetching transcript:", error);
      res.status(500).json({ error: 'Failed to fetch transcript from Snowflake' });
    }
  });

  app.post('/api/gong/analyze', isAuthenticated, async (req: any, res) => {
    try {
      if (!isSnowflakeConfigured()) {
        return res.status(503).json({ error: 'Snowflake integration not configured' });
      }

      const userId = req.user?.claims?.sub;
      const { conversationIds } = req.body;

      if (!Array.isArray(conversationIds) || conversationIds.length === 0) {
        return res.status(400).json({ error: 'conversationIds array is required' });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'API key not configured' });
      }

      const { GoogleGenAI, Type } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });

      const results: Array<{ conversationId: string; assessmentId: number; success: boolean; error?: string }> = [];

      for (const conversationId of conversationIds) {
        try {
          // Check if already analyzed
          const [existing] = await db.select({ id: assessments.id })
            .from(assessments)
            .where(eq(assessments.gongConversationId, conversationId));

          if (existing) {
            results.push({ conversationId, assessmentId: existing.id, success: true });
            continue;
          }

          // Fetch transcript from Snowflake
          const transcript = await getTranscriptText(conversationId);

          // Fetch call metadata for account name
          const userEmail = req.user?.claims?.email;
          const calls = await getQualifyingCalls(userEmail);
          const callMeta = calls.find(c => c.CONVERSATION_ID === conversationId);
          const accountName = callMeta?.OPPORTUNITY_NAME?.split(' - ')[0] || callMeta?.CALL_TITLE || 'Gong Call';

          // Run Gemini analysis (reuse existing prompt from /api/analyze)
          const prompt = `
            You are an expert Sales Coach. Analyze the following sales call transcript (or notes) and score it against the "MOVE" Rubric provided below.

            PART 1: MOVE RUBRIC DEFINITIONS:
            ${MOVE_RUBRIC_CONTEXT}

            TRANSCRIPT/NOTES:
            ${transcript}

            INSTRUCTIONS:

            1. MOVE SCORING: For each of the 5 categories, assign a score from 1 to 4 based strictly on the rubric criteria.
               Use these EXACT categoryId values:
               - "discovery" for Discovery Quality
               - "motivation" for Motivation
               - "opportunity" for Opportunity
               - "validation" for Validation
               - "execution" for Execution

            2. DETAILED ANALYSIS PER CATEGORY:
               - Observation: What happened? Describe the CSM's behavior concisely.
               - Evidence (CRITICAL): You MUST extract DIRECT QUOTES from the transcript to support your scoring.
               - The Gap: Specifically what was missed or done poorly that prevented a higher score?
               - Recommendation: The STRATEGIC advice.
               - Better Question: The TACTICAL script.

            3. STAKEHOLDER MAPPING: Identify key participants from the customer side.

            4. SUMMARY: Provide an executive summary, key strengths, and coaching tips.

            5. QA CHECKLIST: Evaluate the call against these binary criteria (Yes/No/NA):
               - Agenda, Decision Maker, Timeline, Competitors, Next Steps
          `;

          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  scores: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        categoryId: { type: Type.STRING, enum: ["discovery", "motivation", "opportunity", "validation", "execution"] },
                        score: { type: Type.INTEGER },
                        reasoning: { type: Type.STRING },
                        gap: { type: Type.STRING },
                        quotes: { type: Type.ARRAY, items: { type: Type.STRING } },
                        betterQuestion: { type: Type.STRING },
                        recommendation: { type: Type.STRING }
                      },
                      required: ["categoryId", "score", "reasoning", "gap", "quotes", "betterQuestion", "recommendation"]
                    }
                  },
                  stakeholders: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        title: { type: Type.STRING },
                        persona: { type: Type.STRING },
                        sentiment: { type: Type.STRING, enum: ["Positive", "Neutral", "Skeptical", "Negative", "Unknown"] },
                        influence: { type: Type.STRING, enum: ["High", "Medium", "Low"] },
                        keyInterest: { type: Type.STRING },
                        missingInfo: { type: Type.BOOLEAN },
                        painPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                        businessGoal: { type: Type.STRING },
                        additionalNotes: { type: Type.STRING }
                      },
                      required: ["name", "title", "persona", "sentiment", "influence", "keyInterest", "missingInfo", "painPoints", "businessGoal", "additionalNotes"]
                    }
                  },
                  executiveSummary: { type: Type.STRING },
                  keyStrengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                  coachingTips: { type: Type.ARRAY, items: { type: Type.STRING } },
                  qa: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        label: { type: Type.STRING },
                        question: { type: Type.STRING },
                        status: { type: Type.STRING },
                        evidence: { type: Type.STRING }
                      },
                      required: ["id", "label", "question", "status"]
                    }
                  }
                },
                required: ["scores", "executiveSummary", "keyStrengths", "coachingTips", "stakeholders"]
              }
            }
          });

          const text = response.text;
          if (!text) {
            results.push({ conversationId, assessmentId: 0, success: false, error: 'No response from AI' });
            continue;
          }

          const analysisResult = JSON.parse(text);
          const totalScore = analysisResult.scores.reduce((sum: number, s: any) => sum + s.score, 0);

          const [saved] = await db.insert(assessments).values({
            userId,
            accountName,
            transcript,
            scores: analysisResult.scores,
            stakeholders: analysisResult.stakeholders,
            executiveSummary: analysisResult.executiveSummary,
            keyStrengths: analysisResult.keyStrengths,
            coachingTips: analysisResult.coachingTips,
            qa: analysisResult.qa,
            totalScore,
            source: "gong",
            gongConversationId: conversationId,
            gongMetadata: {
              callUrl: callMeta?.CALL_URL,
              csmName: callMeta?.CSM_NAME,
              renewalDate: callMeta?.RENEWAL_DATE,
              opportunityName: callMeta?.OPPORTUNITY_NAME,
              daysUntilRenewal: callMeta?.DAYS_UNTIL_RENEWAL,
              durationMins: callMeta?.DURATION_MINS,
            },
          }).returning();

          results.push({ conversationId, assessmentId: saved.id, success: true });
        } catch (callError: any) {
          console.error(`Error analyzing call ${conversationId}:`, callError);
          results.push({ conversationId, assessmentId: 0, success: false, error: callError.message });
        }
      }

      res.json({
        results,
        succeeded: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
      });
    } catch (error) {
      console.error("Error in batch Gong analysis:", error);
      res.status(500).json({ error: 'Batch analysis failed' });
    }
  });
```

**Important:** The `MOVE_RUBRIC_CONTEXT` variable is already defined earlier in `startServer()` (line 31), so the Gong analyze endpoint reuses it. The Gemini prompt and response schema are identical to the existing `/api/analyze` endpoint.

**Step 3: Verify build**

Run:
```bash
npm run build
```

Expected: Build succeeds.

**Step 4: Commit**

```bash
git add server/index.ts
git commit -m "feat: add /api/gong/* endpoints for qualifying calls, transcripts, and batch analysis"
```

---

## Task 5: Create React Query hooks for Gong endpoints

**Files:**
- Create: `hooks/use-gong-calls.ts`

**Step 1: Create the hooks file**

Create `hooks/use-gong-calls.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface GongCall {
  conversationId: string;
  title: string;
  callDate: string;
  callUrl: string;
  csmName: string;
  durationMins: number;
  opportunityName: string;
  renewalDate: string;
  daysUntilRenewal: number;
  alreadyAnalyzed: boolean;
}

export interface GongCallsResponse {
  calls: GongCall[];
  total: number;
}

export interface AnalyzeResult {
  conversationId: string;
  assessmentId: number;
  success: boolean;
  error?: string;
}

export interface AnalyzeResponse {
  results: AnalyzeResult[];
  succeeded: number;
  failed: number;
}

export function useGongCalls() {
  return useQuery<GongCallsResponse>({
    queryKey: ["/api/gong/qualifying-calls"],
    queryFn: async () => {
      const response = await fetch("/api/gong/qualifying-calls", {
        credentials: "include",
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to fetch qualifying calls");
      }
      return response.json();
    },
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useAnalyzeGongCalls() {
  const queryClient = useQueryClient();

  return useMutation<AnalyzeResponse, Error, string[]>({
    mutationFn: async (conversationIds: string[]) => {
      const response = await fetch("/api/gong/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ conversationIds }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Batch analysis failed");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gong/qualifying-calls"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assessments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trends"] });
    },
  });
}
```

**Step 2: Verify build**

Run:
```bash
npm run build
```

Expected: Build succeeds.

**Step 3: Commit**

```bash
git add hooks/use-gong-calls.ts
git commit -m "feat: add React Query hooks for Gong qualifying calls and batch analysis"
```

---

## Task 6: Create GongCalls component

**Files:**
- Create: `components/GongCalls.tsx`

**Step 1: Create the component**

Create `components/GongCalls.tsx`:

```typescript
import React, { useState } from "react";
import {
  Phone,
  Calendar,
  Clock,
  Building2,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useGongCalls, useAnalyzeGongCalls, GongCall } from "../hooks/use-gong-calls";

const GongCalls: React.FC = () => {
  const { data, isLoading, error, refetch } = useGongCalls();
  const analyzeMutation = useAnalyzeGongCalls();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const calls = data?.calls || [];
  const newCalls = calls.filter((c) => !c.alreadyAnalyzed);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllNew = () => {
    setSelectedIds(new Set(newCalls.map((c) => c.conversationId)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleAnalyze = (ids: string[]) => {
    analyzeMutation.mutate(ids, {
      onSuccess: () => {
        setSelectedIds(new Set());
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#248567" }} />
        <span className="ml-3 text-sm font-medium" style={{ color: "#87B5A7" }}>
          Loading qualifying calls from Gong...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl shadow-soft p-8 text-center" style={{ border: "1px solid #EEE9E1" }}>
        <AlertCircle className="w-12 h-12 mx-auto mb-4" style={{ color: "#FF8B6C" }} />
        <h3 className="text-lg font-bold mb-2" style={{ color: "#242424" }}>
          Unable to load calls from Gong
        </h3>
        <p className="text-sm mb-4" style={{ color: "#87B5A7" }}>
          {error.message.includes("not configured")
            ? "Snowflake integration is not configured. Contact your administrator."
            : "Please try again later."}
        </p>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          style={{ backgroundColor: "#E7F6EE", color: "#248567" }}
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-soft overflow-hidden" style={{ border: "1px solid #EEE9E1" }}>
        <div className="px-8 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold" style={{ color: "#242424" }}>
              Gong Calls
            </h2>
            <p className="text-sm mt-1" style={{ color: "#87B5A7" }}>
              {newCalls.length > 0
                ? `${newCalls.length} new qualifying call${newCalls.length === 1 ? "" : "s"} ready for analysis`
                : "All qualifying calls have been analyzed"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {selectedIds.size > 0 ? (
              <>
                <button
                  onClick={clearSelection}
                  className="px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
                  style={{ color: "#87B5A7" }}
                >
                  Clear ({selectedIds.size})
                </button>
                <button
                  onClick={() => handleAnalyze(Array.from(selectedIds))}
                  disabled={analyzeMutation.isPending}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white transition-colors shadow-lg disabled:opacity-50"
                  style={{ backgroundColor: "#248567" }}
                >
                  {analyzeMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  Analyze Selected ({selectedIds.size})
                </button>
              </>
            ) : (
              <>
                {newCalls.length > 0 && (
                  <>
                    <button
                      onClick={selectAllNew}
                      className="px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
                      style={{ color: "#248567", backgroundColor: "#E7F6EE" }}
                    >
                      Select All New
                    </button>
                    <button
                      onClick={() =>
                        handleAnalyze(newCalls.map((c) => c.conversationId))
                      }
                      disabled={analyzeMutation.isPending}
                      className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white transition-colors shadow-lg disabled:opacity-50"
                      style={{ backgroundColor: "#248567" }}
                    >
                      {analyzeMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                      Analyze All New ({newCalls.length})
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Progress bar during analysis */}
        {analyzeMutation.isPending && (
          <div className="px-8 pb-4">
            <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: "#E7F6EE" }}>
              <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#248567" }} />
              <span className="text-sm font-medium" style={{ color: "#248567" }}>
                Analyzing calls... This may take a minute.
              </span>
            </div>
          </div>
        )}

        {/* Results summary after analysis */}
        {analyzeMutation.isSuccess && (
          <div className="px-8 pb-4">
            <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: "#E7F6EE" }}>
              <CheckCircle2 className="w-4 h-4" style={{ color: "#248567" }} />
              <span className="text-sm font-medium" style={{ color: "#248567" }}>
                {analyzeMutation.data.succeeded} call{analyzeMutation.data.succeeded === 1 ? "" : "s"} analyzed successfully
                {analyzeMutation.data.failed > 0 &&
                  `, ${analyzeMutation.data.failed} failed`}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Call Cards */}
      {calls.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-soft p-12 text-center" style={{ border: "1px solid #EEE9E1" }}>
          <Phone className="w-12 h-12 mx-auto mb-4" style={{ color: "#B9CDC7" }} />
          <h3 className="text-lg font-bold mb-2" style={{ color: "#242424" }}>
            No qualifying calls found
          </h3>
          <p className="text-sm" style={{ color: "#87B5A7" }}>
            No Gong calls match the current filter criteria for your account.
            Your email may differ between PandaDoc and Gong.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {calls.map((call) => (
            <CallCard
              key={call.conversationId}
              call={call}
              selected={selectedIds.has(call.conversationId)}
              onToggle={() => toggleSelect(call.conversationId)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

function CallCard({
  call,
  selected,
  onToggle,
}: {
  call: GongCall;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      onClick={call.alreadyAnalyzed ? undefined : onToggle}
      className={`bg-white rounded-xl shadow-soft overflow-hidden transition-all ${
        call.alreadyAnalyzed ? "opacity-70" : "cursor-pointer hover:shadow-md"
      }`}
      style={{
        border: selected
          ? "2px solid #248567"
          : "1px solid #EEE9E1",
      }}
    >
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-sm truncate" style={{ color: "#242424" }}>
              {call.title}
            </h4>
            <p className="text-xs mt-0.5 truncate" style={{ color: "#87B5A7" }}>
              {call.opportunityName}
            </p>
          </div>
          <div className="flex items-center gap-2 ml-3 shrink-0">
            {call.alreadyAnalyzed ? (
              <span
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase"
                style={{ backgroundColor: "#E7F6EE", color: "#248567" }}
              >
                <CheckCircle2 className="w-3 h-3" />
                Analyzed
              </span>
            ) : selected ? (
              <div
                className="w-5 h-5 rounded-md flex items-center justify-center"
                style={{ backgroundColor: "#248567" }}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
              </div>
            ) : (
              <div
                className="w-5 h-5 rounded-md"
                style={{ border: "2px solid #EEE9E1" }}
              />
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 text-xs" style={{ color: "#87B5A7" }}>
          <span className="inline-flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {new Date(call.callDate).toLocaleDateString()}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {call.durationMins} min
          </span>
          <span className="inline-flex items-center gap-1">
            <Building2 className="w-3 h-3" />
            {call.daysUntilRenewal}d to renewal
          </span>
          {call.callUrl && (
            <a
              href={call.callUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 hover:text-primary transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Gong
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default GongCalls;
```

**Step 2: Verify build**

Run:
```bash
npm run build
```

Expected: Build succeeds.

**Step 3: Commit**

```bash
git add components/GongCalls.tsx
git commit -m "feat: add GongCalls component with call list, selection, and batch analyze"
```

---

## Task 7: Add Gong Calls tab to App.tsx

**Files:**
- Modify: `App.tsx`

**Step 1: Add import for GongCalls component**

Add after line 9 (`import SharedWithMe from './components/SharedWithMe';`):

```typescript
import GongCalls from './components/GongCalls';
```

Add `Phone` to the lucide-react import (line 23-27 area). It's not currently imported, so add it to the destructured imports:

```typescript
import {
  Sparkles, RefreshCw, Trophy, ThumbsUp, TrendingUp, FileText,
  LayoutDashboard, PlusCircle, User, Tag, Zap, LogOut, History, Share2,
  Target, CheckCircle2, ArrowUpRight, Users, Smile, Meh, Frown, HelpCircle,
  Crown, Briefcase, ShieldAlert, Signal, Lightbulb, Flame, Phone
} from 'lucide-react';
```

**Step 2: Update view state type**

Change line 33 from:

```typescript
const [view, setView] = useState<'form' | 'history' | 'trends' | 'shared'>('form');
```

to:

```typescript
const [view, setView] = useState<'form' | 'history' | 'trends' | 'shared' | 'gong'>('form');
```

**Step 3: Add Gong tab button to navigation**

Add a new button in the navigation pill group (after the "Shared" button, before the closing `</div>` of the navigation container — around line 445):

```typescript
             <button
               onClick={() => setView('gong')}
               className={`flex items-center gap-2 px-3 sm:px-5 py-1.5 rounded-full text-sm font-semibold transition-colors duration-200 focus:ring-2 focus:ring-primary focus:outline-none ${
                 view === 'gong'
                 ? 'bg-white text-primary shadow-sm'
                 : 'hover:text-dark'
               }`}
               style={view === 'gong' ? { border: '1px solid #EEE9E1' } : { color: '#87B5A7' }}
               aria-label="View Gong Calls"
               aria-current={view === 'gong' ? 'page' : undefined}
             >
               <Phone className="w-4 h-4" />
               <span className="hidden sm:inline">Gong</span>
             </button>
```

**Step 4: Add Gong view to the main content area**

In the main content area (around line 495-501), update the conditional rendering to include the Gong view. Change:

```typescript
        {view === 'history' ? (
           <AssessmentHistory onViewAssessment={handleViewAssessment} />
        ) : view === 'trends' ? (
           <TrendsView />
        ) : view === 'shared' ? (
           <SharedWithMe onViewAssessment={handleViewAssessment} />
        ) : (
```

to:

```typescript
        {view === 'history' ? (
           <AssessmentHistory onViewAssessment={handleViewAssessment} />
        ) : view === 'trends' ? (
           <TrendsView />
        ) : view === 'shared' ? (
           <SharedWithMe onViewAssessment={handleViewAssessment} />
        ) : view === 'gong' ? (
           <GongCalls />
        ) : (
```

**Step 5: Verify build**

Run:
```bash
npm run build
```

Expected: Build succeeds.

**Step 6: Commit**

```bash
git add App.tsx
git commit -m "feat: add Gong Calls tab to main navigation"
```

---

## Task 8: Add notification banner on Dashboard

**Files:**
- Modify: `App.tsx`

**Step 1: Add import for useGongCalls hook**

Add after the `use-auth` import (line 10):

```typescript
import { useGongCalls } from './hooks/use-gong-calls';
```

**Step 2: Add the hook call**

Inside the `App` component, after the `useAuth()` call (line 30), add:

```typescript
  const { data: gongData } = useGongCalls();
  const newGongCallCount = gongData?.calls?.filter(c => !c.alreadyAnalyzed).length || 0;
```

**Step 3: Add the notification banner**

In the `view === 'form'` branch, right before the grid layout opens (before `<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">`), add:

```typescript
          {/* Gong Notification Banner */}
          {newGongCallCount > 0 && (
            <div
              onClick={() => setView('gong')}
              className="mb-6 p-4 rounded-xl flex items-center justify-between cursor-pointer hover:shadow-md transition-shadow"
              style={{ backgroundColor: '#E7F6EE', border: '1px solid #87B5A7' }}
            >
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5" style={{ color: '#248567' }} />
                <span className="text-sm font-semibold" style={{ color: '#248567' }}>
                  You have {newGongCallCount} new qualifying Gong call{newGongCallCount === 1 ? '' : 's'} ready for analysis
                </span>
              </div>
              <span className="text-sm font-bold" style={{ color: '#248567' }}>
                View &rarr;
              </span>
            </div>
          )}
```

**Step 4: Verify build**

Run:
```bash
npm run build
```

Expected: Build succeeds.

**Step 5: Commit**

```bash
git add App.tsx
git commit -m "feat: add Gong qualifying calls notification banner on dashboard"
```

---

## Task 9: Final build verification and cleanup

**Step 1: Full build test**

Run:
```bash
npm run build
```

Expected: Build succeeds with no errors.

**Step 2: Verify TypeScript types**

Run:
```bash
npx tsc --noEmit
```

Expected: No type errors. (If there are type errors related to `snowflake-sdk`, they can be resolved with a `declare module` in a `.d.ts` file.)

**Step 3: Review all changes**

Run:
```bash
git log --oneline
```

Expected commits (most recent first):
```
feat: add Gong qualifying calls notification banner on dashboard
feat: add Gong Calls tab to main navigation
feat: add GongCalls component with call list, selection, and batch analyze
feat: add React Query hooks for Gong qualifying calls and batch analysis
feat: add /api/gong/* endpoints for qualifying calls, transcripts, and batch analysis
feat: add Snowflake connector with qualifying calls and transcript queries
feat: add source, gongConversationId, gongMetadata columns to assessments
chore: add snowflake-sdk dependency
```

**Step 4: Final commit with any cleanup**

If any lint/type fixes were needed:
```bash
git add -A
git commit -m "chore: fix lint and type issues from Snowflake integration"
```

---

## Environment Variables Checklist

Before running the app, ensure these env vars are set:

```
SNOWFLAKE_ACCOUNT=<your-account-id>
SNOWFLAKE_USER=<your-username>
SNOWFLAKE_PASSWORD=<your-password>
SNOWFLAKE_DATABASE=FIVETRAN_DATABASE
SNOWFLAKE_SCHEMA=CLEAN
SNOWFLAKE_WAREHOUSE=<your-warehouse>
```

The app works without these — the Gong tab will show a "not configured" message, and all other features continue normally.

---

## Post-Implementation Testing

1. **Without Snowflake configured:** Visit the Gong tab — should show "Snowflake integration not configured" error with retry button. All other features should work normally.

2. **With Snowflake configured:** Visit the Gong tab — should show your qualifying calls. Select one and click "Analyze" — should create a new assessment visible in History.

3. **Dedup check:** Try analyzing the same call twice — second attempt should skip (returns existing assessment ID).

4. **Notification banner:** On the main form view, if you have unanalyzed qualifying calls, a green banner should appear linking to the Gong tab.
