# Snowflake Gong Integration — Design Document

**Date:** 2026-02-06
**Status:** Approved
**Author:** Aaron Nam
**Stakeholder:** Fernando Chonqui

## Problem

CSMs currently paste call transcripts manually into the MOVE Framework Self-Assessment tool. Fernando needs automatic discovery of qualifying Gong calls from Snowflake so CSMs can analyze them with one click.

## Filter Criteria (from Fernando)

All 5 filters are applied in a single Snowflake query:

| # | Criterion | Snowflake Implementation | Confidence |
|---|-----------|--------------------------|------------|
| 1 | Call Owner/Host = CSM | `GONG.USERS.TITLE ILIKE '%customer success%'` joined via `OWNER_ID` | HIGH |
| 2 | Call length > 30 min | `DATEDIFF('second', PLANNED_START_DATETIME, PLANNED_END_DATETIME) > 1800` | MEDIUM (planned, not actual) |
| 3 | Status = COMPLETED | `CALLS.STATUS = 'COMPLETED'` | HIGH |
| 4 | Renewal Opp >= 90 days out | `OPPORTUNITY.TYPE = 'Renewal' AND DATEDIFF('day', CURRENT_DATE(), CLOSEDATE) >= 90` | MEDIUM (requires opp link) |
| 5 | Transcript patterns | 4 patterns combined with OR logic | HIGH |

### Transcript Patterns (confirmed by Fernando)

```sql
ct.TRANSCRIPT::STRING ILIKE '%only using%pandadoc%for%'
OR ct.TRANSCRIPT::STRING ILIKE '%not using pandadoc%'
OR ct.TRANSCRIPT::STRING ILIKE '%not leveraging%pandadoc%'
OR ct.TRANSCRIPT::STRING ILIKE '%not leveraging pandadoc technology%'
```

**Result:** ~1,125 qualifying calls with all filters applied.

## Architecture

```
Snowflake (CLEAN.GONG.*) ──query──▶ Express API ──flatten──▶ Gemini Analysis
                                        │                         │
                                        ▼                         ▼
                                   React UI              PostgreSQL
                                (Gong Calls tab)      (assessments table)
```

### Approach: Hybrid (Search + Auto-suggest)

CSMs open the app and see a notification: "You have X qualifying calls ready for analysis." They can preview the call list, select specific calls or analyze all, and the existing Gemini MOVE scoring pipeline processes them.

## Data Sources

### Snowflake Tables

| Table | Purpose |
|-------|---------|
| `CLEAN.GONG.CALLS` | Call metadata (owner, status, duration, timestamps) |
| `CLEAN.GONG.USERS` | User profiles (title, email for CSM identification) |
| `CLEAN.GONG.CALL_TRANSCRIPTS` | Full transcript as VARIANT (JSON) |
| `CLEAN.GONG.CONVERSATION_CONTEXTS` | Links calls to Salesforce objects |
| `CLEAN.GONG.CONVERSATION_PARTICIPANTS` | Call participants |
| `CLEAN.SALESFORCE.OPPORTUNITY` | Renewal type, close date |

### CSM-to-User Mapping

Match Snowflake `GONG.USERS.EMAIL` to the app's `users.email` (both @pandadoc.com). Each CSM sees only their own qualifying calls.

## Database Changes

### New columns on `assessments` table

| Column | Type | Purpose |
|--------|------|---------|
| `source` | VARCHAR, default `"manual"` | Distinguishes manual vs Gong imports |
| `gong_conversation_id` | VARCHAR, nullable, unique | Links back to Gong, prevents re-analysis |
| `gong_metadata` | JSONB, nullable | Stores call URL, account, renewal date, opportunity info |

Existing features (history, trends, sharing, scoring) work identically for both sources.

## API Endpoints

### New endpoints (all require authentication)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/gong/qualifying-calls` | Returns CSM's qualifying calls from Snowflake (metadata only) |
| `GET` | `/api/gong/transcript/:conversationId` | Fetches full transcript for a specific call |
| `POST` | `/api/gong/analyze` | Accepts conversation IDs, pulls transcripts, runs Gemini analysis |

### Qualifying Calls Response Shape

```json
{
  "calls": [
    {
      "conversationId": "abc123",
      "title": "Template Review | PandaDoc + Acme Corp",
      "callDate": "2026-01-27",
      "callUrl": "https://app.gong.io/call?id=abc123",
      "csmName": "Karen O'Connor",
      "durationMins": 60,
      "opportunityName": "Acme Corp - Renewal - 2026-09-15",
      "renewalDate": "2026-09-15",
      "daysUntilRenewal": 221,
      "alreadyAnalyzed": false
    }
  ],
  "total": 12,
  "lastSynced": "2026-02-06T08:00:00Z"
}
```

## Transcript Flattening

Gong stores transcripts as a VARIANT (JSON array of speaker segments with nested sentences). We flatten server-side into the same plain-text format CSMs currently paste:

```
[Speaker Name] (00:02:15): "So we're really only using PandaDoc for
basic document sending, we haven't explored the templates or..."

[CSM Name] (00:02:45): "I see — let's talk about what features
would help your team the most..."
```

This ensures 100% reuse of the existing Gemini prompt and MOVE scoring pipeline.

## Frontend UI

### New "Gong Calls" Tab

- **Call list:** Cards with title, date, account, duration, renewal date, days until renewal
- **Sort:** By date or renewal urgency
- **Badge:** "Already analyzed" for calls with existing assessments
- **Batch controls:** "Analyze All New" button + checkboxes for selective analysis
- **Progress indicator:** "Analyzing 3 of 12 calls..." with real-time updates

### Dashboard Notification Banner

"You have 8 new qualifying calls ready for analysis" — surfaces when `qualifying_calls.count > 0`, links to Gong Calls tab.

## Error Handling

| Scenario | Handling |
|----------|----------|
| Snowflake unreachable | Graceful fallback message, rest of app works normally |
| Gemini rate limit / failure mid-batch | Save successful ones, surface failures with "Retry" button |
| Empty transcript | Skip, mark as "No transcript available" |
| Transcript too long | Truncate at ~100k tokens with note to CSM |
| CSM email mismatch (app vs Gong) | "No calls found" message with explanation |
| Duplicate opportunities per call | Deduplicate by `conversation_id`, store all opp info in metadata |
| Stale Snowflake data | Show "Last synced: [timestamp]" |

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `shared/models/assessments.ts` | Modify | Add `source`, `gongConversationId`, `gongMetadata` columns |
| `server/index.ts` | Modify | Add 3 new `/api/gong/*` endpoints |
| `server/snowflake.ts` | **Create** | Snowflake connection pool + query functions |
| `server/gong-transcript.ts` | **Create** | VARIANT → plain text transformer |
| `components/GongCalls.tsx` | **Create** | Call list + batch analyze UI |
| `hooks/use-gong-calls.ts` | **Create** | React Query hooks for Gong endpoints |
| `App.tsx` | Modify | Add Gong Calls tab to navigation |

## Environment Variables (new)

```
SNOWFLAKE_ACCOUNT=<account-identifier>
SNOWFLAKE_USER=<username>
SNOWFLAKE_PASSWORD=<password>
SNOWFLAKE_DATABASE=FIVETRAN_DATABASE
SNOWFLAKE_SCHEMA=CLEAN
SNOWFLAKE_WAREHOUSE=<warehouse-name>
```

## Validated SQL Query

```sql
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
ORDER BY DAYS_UNTIL_RENEWAL ASC;
```

## Open Questions

1. **Call duration:** Using planned duration (scheduled meeting length) since `BROWSER_DURATION_SEC` is often NULL. Is this acceptable?
2. **Calls without opportunity links:** Currently excluded. Should we include CSM calls linked to accounts with ANY open renewal?
3. **CSM title matching:** Using `ILIKE '%customer success%'` — should we exclude managers/directors (only ICs)?
