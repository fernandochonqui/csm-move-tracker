import snowflake from "snowflake-sdk";
import { db } from "./db";
import { qualifyingCallFilters } from "@shared/schema";
import type { QualifyingCallFilter } from "@shared/schema";
import { eq, asc } from "drizzle-orm";

snowflake.configure({ ocspFailOpen: true, logLevel: "WARN" });

let cachedConnection: snowflake.Connection | null = null;
let connectionPromise: Promise<snowflake.Connection> | null = null;

function createNewConnection(): Promise<snowflake.Connection> {
  return new Promise((resolve, reject) => {
    const connection = snowflake.createConnection({
      account: process.env.SNOWFLAKE_ACCOUNT!,
      username: process.env.SNOWFLAKE_USER!,
      password: process.env.SNOWFLAKE_PASSWORD!,
      database: process.env.SNOWFLAKE_DATABASE || "SELFSERVE",
      schema: process.env.SNOWFLAKE_SCHEMA || "PUBLIC",
      warehouse: process.env.SNOWFLAKE_WAREHOUSE!,
      role: process.env.SNOWFLAKE_ROLE || undefined,
      clientSessionKeepAlive: true,
    });

    connection.connect((err) => {
      if (err) {
        console.error("Snowflake connection failed:", err.message);
        cachedConnection = null;
        connectionPromise = null;
        reject(err);
      } else {
        cachedConnection = connection;
        resolve(connection);
      }
    });
  });
}

function getConnection(): Promise<snowflake.Connection> {
  if (cachedConnection && cachedConnection.isUp()) {
    return Promise.resolve(cachedConnection);
  }
  if (connectionPromise) {
    return connectionPromise;
  }
  connectionPromise = createNewConnection().finally(() => {
    connectionPromise = null;
  });
  return connectionPromise;
}

const QUERY_TIMEOUT_MS = 30000;

function executeQuery<T = Record<string, unknown>>(
  connection: snowflake.Connection,
  sqlText: string,
  binds: snowflake.Binds = []
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error("Snowflake query timed out after 30 seconds"));
      }
    }, QUERY_TIMEOUT_MS);

    connection.execute({
      sqlText,
      binds,
      complete: (err, _stmt, rows) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (err) {
          if (err.message?.includes("not connected") || err.message?.includes("not open")) {
            cachedConnection = null;
          }
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
  OPPORTUNITY_NAME: string | null;
  RENEWAL_DATE: string | null;
  DAYS_UNTIL_RENEWAL: number | null;
  MATCHED_KEYWORDS: string | null;
}

const DEFAULT_FILTERS = [
  {
    key: "status_completed",
    label: "Completed calls only",
    description: "Excludes scheduled, cancelled, or in-progress calls",
    source: "Gong",
    enabled: true,
    params: {},
    sortOrder: 1,
  },
  {
    key: "csm_title",
    label: "Customer Success managers",
    description: 'Call owner has a "Customer Success" title',
    source: "Gong",
    enabled: true,
    params: { titlePattern: "customer success" },
    sortOrder: 2,
  },
  {
    key: "min_duration",
    label: "Minimum call duration",
    description: "Short check-ins and internal syncs are excluded",
    source: "Gong",
    enabled: true,
    params: { minutes: 30 },
    sortOrder: 3,
  },
  {
    key: "call_start_date",
    label: "Calls on or after date",
    description: "Only include calls that started on or after this date",
    source: "Gong",
    enabled: true,
    params: { date: "2025-07-01" },
    sortOrder: 4,
  },
  {
    key: "renewal_type",
    label: "Renewal opportunities only",
    description: 'Opportunity type is "Renewal" in Salesforce',
    source: "Salesforce",
    enabled: true,
    params: {},
    sortOrder: 5,
  },
  {
    key: "min_days_renewal",
    label: "Renewal days out",
    description: "Close date is at least N days from today",
    source: "Salesforce",
    enabled: true,
    params: { days: 90 },
    sortOrder: 6,
  },
  {
    key: "call_title_patterns",
    label: "Call title matches",
    description: "Only include calls whose title contains one of these keywords",
    source: "Gong",
    enabled: true,
    params: {
      patterns: [
        "Success Sync",
        "Monthly Business Review",
        "Quarterly Business Review",
        "MBR",
        "QBR",
        "Workflow Consultation",
        "Account Sync",
        "Account Review",
      ],
    },
    sortOrder: 7,
  },
  {
    key: "transcript_patterns",
    label: "Adoption risk keywords in transcript",
    description: "Matches keywords indicating underuse of PandaDoc",
    source: "Transcript",
    enabled: false,
    params: {
      patterns: [
        "only using%pandadoc%for",
        "not using pandadoc",
        "not leveraging%pandadoc%",
        "not leveraging pandadoc technology",
      ],
    },
    sortOrder: 8,
  },
];

export async function seedDefaultFilters(): Promise<QualifyingCallFilter[]> {
  const existing = await db.select().from(qualifyingCallFilters);
  if (existing.length > 0) {
    return existing;
  }

  const inserted = await db
    .insert(qualifyingCallFilters)
    .values(DEFAULT_FILTERS)
    .returning();
  return inserted;
}

function getFilterByKey(filters: QualifyingCallFilter[], key: string): QualifyingCallFilter | undefined {
  return filters.find((f) => f.key === key);
}

function sanitizeSqlString(value: string): string {
  return value.replace(/'/g, "''").replace(/[;\-\-\/\*]/g, "");
}

function sanitizePositiveInt(value: any, fallback: number): number {
  const num = parseInt(String(value), 10);
  if (isNaN(num) || num < 1 || num > 10000) return fallback;
  return num;
}

export function buildQualifyingCallsSQL(filters: QualifyingCallFilter[]): string {
  const statusFilter = getFilterByKey(filters, "status_completed");
  const csmFilter = getFilterByKey(filters, "csm_title");
  const durationFilter = getFilterByKey(filters, "min_duration");
  const callStartDateFilter = getFilterByKey(filters, "call_start_date");
  const callTitleFilter = getFilterByKey(filters, "call_title_patterns");
  const renewalTypeFilter = getFilterByKey(filters, "renewal_type");
  const minDaysFilter = getFilterByKey(filters, "min_days_renewal");
  const transcriptFilter = getFilterByKey(filters, "transcript_patterns");

  const cteWhereConditions: string[] = [];
  if (statusFilter?.enabled) {
    cteWhereConditions.push("c.STATUS = 'COMPLETED'");
  }
  if (csmFilter?.enabled) {
    const rawTitle = (csmFilter.params as any)?.titlePattern || "customer success";
    const titlePattern = sanitizeSqlString(String(rawTitle));
    cteWhereConditions.push(`u.TITLE ILIKE '%${titlePattern}%'`);
  }
  if (durationFilter?.enabled) {
    const minutes = sanitizePositiveInt((durationFilter.params as any)?.minutes, 30);
    cteWhereConditions.push(
      `DATEDIFF('second', c.PLANNED_START_DATETIME, c.PLANNED_END_DATETIME) > ${minutes * 60}`
    );
  }
  if (callStartDateFilter?.enabled) {
    const rawDate = String((callStartDateFilter.params as any)?.date || "2025-07-01");
    const dateMatch = rawDate.match(/^(\d{4}-\d{2}-\d{2})$/);
    const safeDate = dateMatch ? dateMatch[1] : "2025-07-01";
    cteWhereConditions.push(`c.PLANNED_START_DATETIME >= '${safeDate}'`);
  }

  const titlePatterns: string[] = (callTitleFilter?.enabled && (callTitleFilter.params as any)?.patterns) || [];
  if (callTitleFilter?.enabled && titlePatterns.length > 0) {
    const titleClauses = titlePatterns.map(
      (p: string) => `c.TITLE ILIKE '%${sanitizeSqlString(String(p))}%'`
    );
    cteWhereConditions.push(`(\n        ${titleClauses.join("\n        OR ")}\n      )`);
  }

  const cteWhere =
    cteWhereConditions.length > 0
      ? `WHERE ${cteWhereConditions.join("\n      AND ")}`
      : "";

  const transcriptPatterns: string[] = (transcriptFilter?.enabled && (transcriptFilter.params as any)?.patterns) || [];
  const hasActiveTranscriptPatterns = transcriptFilter?.enabled && transcriptPatterns.length > 0;

  const needsOpportunityJoin = renewalTypeFilter?.enabled || minDaysFilter?.enabled;

  const outerJoins: string[] = [];
  if (hasActiveTranscriptPatterns) {
    outerJoins.push(
      `JOIN CLEAN.GONG.CALL_TRANSCRIPTS ct\n    ON cc.CONVERSATION_KEY = ct.CONVERSATION_KEY`
    );
  }
  if (needsOpportunityJoin) {
    outerJoins.push(
      `JOIN CLEAN.GONG.CONVERSATION_CONTEXTS ctx\n    ON cc.CONVERSATION_KEY = ctx.CONVERSATION_KEY\n    AND ctx.OBJECT_TYPE = 'opportunity'`
    );
    outerJoins.push(
      `JOIN CLEAN.SALESFORCE.OPPORTUNITY o\n    ON ctx.OBJECT_ID = o.ID`
    );
  }

  const outerWhereConditions: string[] = [];
  if (renewalTypeFilter?.enabled) {
    outerWhereConditions.push("o.TYPE = 'Renewal'");
  }
  if (minDaysFilter?.enabled) {
    const days = sanitizePositiveInt((minDaysFilter.params as any)?.days, 90);
    outerWhereConditions.push(
      `DATEDIFF('day', CURRENT_DATE(), o.CLOSEDATE) >= ${days}`
    );
  }
  if (hasActiveTranscriptPatterns) {
    const patternClauses = transcriptPatterns.map(
      (p: string) => `ct.TRANSCRIPT::STRING ILIKE '%${sanitizeSqlString(String(p))}%'`
    );
    outerWhereConditions.push(`(\n      ${patternClauses.join("\n      OR ")}\n  )`);
  }

  let matchedKeywordsExpr = "NULL AS MATCHED_KEYWORDS";
  if (hasActiveTranscriptPatterns) {
    const caseClauses = transcriptPatterns.map((p: string) => {
      const sanitized = sanitizeSqlString(String(p));
      const display = sanitized.replace(/%/g, " ").replace(/\s+/g, " ").trim();
      return `CASE WHEN MAX(CASE WHEN ct.TRANSCRIPT::STRING ILIKE '%${sanitized}%' THEN 1 ELSE 0 END) = 1 THEN '${display}' END`;
    });
    matchedKeywordsExpr = `ARRAY_TO_STRING(ARRAY_COMPACT(ARRAY_CONSTRUCT(${caseClauses.join(", ")})), ', ') AS MATCHED_KEYWORDS`;
  }

  const outerWhere =
    outerWhereConditions.length > 0
      ? `WHERE ${outerWhereConditions.join("\n  AND ")}`
      : "";

  const selectColumns = [
    "cc.CONVERSATION_ID",
    "cc.CALL_TITLE",
    "cc.CALL_DATE",
    "cc.CALL_URL",
    "cc.CSM_NAME",
    "cc.CSM_EMAIL",
    "cc.DURATION_SEC / 60 AS DURATION_MINS",
  ];
  const groupByColumns = [
    "cc.CONVERSATION_ID", "cc.CALL_TITLE", "cc.CALL_DATE", "cc.CALL_URL",
    "cc.CSM_NAME", "cc.CSM_EMAIL", "cc.DURATION_SEC",
  ];

  if (needsOpportunityJoin) {
    selectColumns.push(
      "o.NAME AS OPPORTUNITY_NAME",
      "o.TYPE AS OPP_TYPE",
      "o.CLOSEDATE::VARCHAR AS RENEWAL_DATE",
      "DATEDIFF('day', CURRENT_DATE(), o.CLOSEDATE) AS DAYS_UNTIL_RENEWAL",
    );
    groupByColumns.push("o.NAME", "o.TYPE", "o.CLOSEDATE");
  } else {
    selectColumns.push(
      "NULL AS OPPORTUNITY_NAME",
      "NULL AS OPP_TYPE",
      "NULL AS RENEWAL_DATE",
      "NULL AS DAYS_UNTIL_RENEWAL",
    );
  }
  selectColumns.push(matchedKeywordsExpr);

  const orderBy = needsOpportunityJoin ? "ORDER BY DAYS_UNTIL_RENEWAL ASC" : "ORDER BY cc.CALL_DATE DESC";

  return `
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
        u.EMAIL_ADDRESS AS CSM_EMAIL,
        c.PLANNED_START_DATETIME::DATE AS CALL_DATE
    FROM CLEAN.GONG.CALLS c
    JOIN CLEAN.GONG.USERS u ON c.OWNER_ID = u.USER_ID
    ${cteWhere}
)
SELECT
    ${selectColumns.join(",\n    ")}
FROM csm_calls cc
${outerJoins.join("\n")}
${outerWhere}
GROUP BY ${groupByColumns.join(", ")}
${orderBy};
`;
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
        u.EMAIL_ADDRESS AS CSM_EMAIL,
        c.PLANNED_START_DATETIME::DATE AS CALL_DATE
    FROM CLEAN.GONG.CALLS c
    JOIN CLEAN.GONG.USERS u ON c.OWNER_ID = u.USER_ID
    WHERE c.STATUS = 'COMPLETED'
      AND u.TITLE ILIKE '%customer success%'
      AND DATEDIFF('second', c.PLANNED_START_DATETIME, c.PLANNED_END_DATETIME) > 1800
      AND c.PLANNED_START_DATETIME >= '2025-07-01'
)
SELECT
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
    DATEDIFF('day', CURRENT_DATE(), o.CLOSEDATE) AS DAYS_UNTIL_RENEWAL,
    ARRAY_TO_STRING(ARRAY_COMPACT(ARRAY_CONSTRUCT(
      CASE WHEN MAX(CASE WHEN ct.TRANSCRIPT::STRING ILIKE '%only using%pandadoc%for%' THEN 1 ELSE 0 END) = 1 THEN 'only using pandadoc for' END,
      CASE WHEN MAX(CASE WHEN ct.TRANSCRIPT::STRING ILIKE '%not using pandadoc%' THEN 1 ELSE 0 END) = 1 THEN 'not using pandadoc' END,
      CASE WHEN MAX(CASE WHEN ct.TRANSCRIPT::STRING ILIKE '%not leveraging%pandadoc%' THEN 1 ELSE 0 END) = 1 THEN 'not leveraging pandadoc' END,
      CASE WHEN MAX(CASE WHEN ct.TRANSCRIPT::STRING ILIKE '%not leveraging pandadoc technology%' THEN 1 ELSE 0 END) = 1 THEN 'not leveraging pandadoc technology' END
    )), ', ') AS MATCHED_KEYWORDS
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
GROUP BY cc.CONVERSATION_ID, cc.CALL_TITLE, cc.CALL_DATE, cc.CALL_URL, cc.CSM_NAME, cc.CSM_EMAIL, cc.DURATION_SEC, o.NAME, o.TYPE, o.CLOSEDATE
ORDER BY DAYS_UNTIL_RENEWAL ASC;
`;

export async function getQualifyingCalls(filters?: QualifyingCallFilter[]): Promise<QualifyingCall[]> {
  let sqlToExecute: string;

  try {
    if (!filters) {
      filters = await db
        .select()
        .from(qualifyingCallFilters)
        .orderBy(asc(qualifyingCallFilters.sortOrder));
    }

    if (filters.length > 0) {
      sqlToExecute = buildQualifyingCallsSQL(filters);
    } else {
      sqlToExecute = QUALIFYING_CALLS_SQL;
    }
  } catch (err) {
    console.error("Failed to load filters from DB, using static SQL fallback:", err);
    sqlToExecute = QUALIFYING_CALLS_SQL;
  }

  const conn = await getConnection();
  return await executeQuery<QualifyingCall>(conn, sqlToExecute);
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

export async function getTranscriptText(
  conversationId: string
): Promise<string> {
  const conn = await getConnection();
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
}

export interface CSQLOpportunity {
  OPP_ID: string;
  OPP_NAME: string;
  ACCOUNT_NAME: string;
  ACCOUNT_ID: string;
  AMOUNT: number | null;
  STAGE_NAME: string;
  CREATED_DATE: string;
  CLOSE_DATE: string | null;
  CREATED_BY_NAME: string;
  IS_CLOSED: boolean;
  FINAL_STAGE: string;
}

const CSQL_QUERY = `
WITH csm_identifiers AS (
  SELECT DISTINCT
    u.FIRST_NAME || ' ' || u.LAST_NAME AS FULL_NAME,
    LOWER(TRIM(u.EMAIL_ADDRESS)) AS EMAIL
  FROM CLEAN.GONG.USERS u
  WHERE u.TITLE ILIKE '%customer success%'
)
SELECT
    o.ID AS OPP_ID,
    o.NAME AS OPP_NAME,
    a.NAME AS ACCOUNT_NAME,
    a.ID AS ACCOUNT_ID,
    o.AMOUNT,
    o.STAGENAME AS STAGE_NAME,
    o.CREATEDDATE::DATE::VARCHAR AS CREATED_DATE,
    o.CLOSEDATE::DATE::VARCHAR AS CLOSE_DATE,
    su.NAME AS CREATED_BY_NAME,
    o.ISCLOSED AS IS_CLOSED,
    o.STAGENAME AS FINAL_STAGE
FROM CLEAN.SALESFORCE.OPPORTUNITY o
JOIN CLEAN.SALESFORCE.ACCOUNT a ON o.ACCOUNTID = a.ID
JOIN CLEAN.SALESFORCE.USER su ON o.CREATED_BY_SNAPSHOT__C = su.ID
JOIN csm_identifiers ci
  ON LOWER(TRIM(su.EMAIL)) = ci.EMAIL
  OR LOWER(TRIM(su.NAME)) = LOWER(TRIM(ci.FULL_NAME))
WHERE o.CREATEDDATE >= '2025-07-01'
  AND (o.LOSS_REASON__C IS NULL OR o.LOSS_REASON__C NOT ILIKE '%duplicate%')
ORDER BY o.CREATEDDATE DESC
`;

export async function getCSQLOpportunities(): Promise<CSQLOpportunity[]> {
  const conn = await getConnection();
  return await executeQuery<CSQLOpportunity>(conn, CSQL_QUERY);
}

const CSQL_DUPLICATE_CHECK_QUERY = `
WITH csm_identifiers AS (
  SELECT DISTINCT
    u.FIRST_NAME || ' ' || u.LAST_NAME AS FULL_NAME,
    LOWER(TRIM(u.EMAIL_ADDRESS)) AS EMAIL
  FROM CLEAN.GONG.USERS u
  WHERE u.TITLE ILIKE '%customer success%'
)
SELECT
    o.STAGENAME AS STAGE_NAME,
    o.LOSS_REASON__C AS LOSS_REASON,
    COUNT(*) AS CNT
FROM CLEAN.SALESFORCE.OPPORTUNITY o
JOIN CLEAN.SALESFORCE.ACCOUNT a ON o.ACCOUNTID = a.ID
JOIN CLEAN.SALESFORCE.USER su ON o.CREATED_BY_SNAPSHOT__C = su.ID
JOIN csm_identifiers ci
  ON LOWER(TRIM(su.EMAIL)) = ci.EMAIL
  OR LOWER(TRIM(su.NAME)) = LOWER(TRIM(ci.FULL_NAME))
WHERE o.CREATEDDATE >= '2025-07-01'
  AND o.ISCLOSED = TRUE
GROUP BY o.STAGENAME, o.LOSS_REASON__C
ORDER BY CNT DESC
`;

export async function getCSQLDuplicateCheck(): Promise<{ STAGE_NAME: string; CNT: number }[]> {
  const conn = await getConnection();
  return await executeQuery<{ STAGE_NAME: string; CNT: number }>(conn, CSQL_DUPLICATE_CHECK_QUERY);
}

interface AccountConversation {
  ACCOUNT_ID: string;
  CONVERSATION_ID: string;
  CALL_DATE: string;
}

const ACCOUNT_CONVERSATIONS_QUERY = `
SELECT DISTINCT
    ctx.OBJECT_ID AS ACCOUNT_ID,
    c.CONVERSATION_ID,
    c.PLANNED_START_DATETIME::DATE::VARCHAR AS CALL_DATE
FROM CLEAN.GONG.CONVERSATION_CONTEXTS ctx
JOIN CLEAN.GONG.CALLS c ON ctx.CONVERSATION_KEY = c.CONVERSATION_KEY
WHERE ctx.OBJECT_TYPE = 'account'
  AND c.STATUS = 'COMPLETED'
  AND c.PLANNED_START_DATETIME >= DATEADD('day', -730, CURRENT_DATE())
`;

export async function getAccountConversationMap(): Promise<Map<string, { conversationId: string; callDate: string }[]>> {
  const conn = await getConnection();
  const rows = await executeQuery<AccountConversation>(conn, ACCOUNT_CONVERSATIONS_QUERY);

  const map = new Map<string, { conversationId: string; callDate: string }[]>();
  for (const row of rows) {
    const key = row.ACCOUNT_ID;
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push({ conversationId: row.CONVERSATION_ID, callDate: row.CALL_DATE });
  }
  return map;
}

export interface AccountCall {
  CONVERSATION_ID: string;
  CALL_TITLE: string;
  CALL_DATE: string;
  CSM_NAME: string;
  DURATION_MINS: number;
  ACCOUNT_NAME: string;
}

export async function getCallsForAccount(accountName: string, beforeDate: string): Promise<AccountCall[]> {
  const sanitized = accountName.replace(/'/g, "''");
  const query = `
SELECT DISTINCT
    c.CONVERSATION_ID,
    c.TITLE AS CALL_TITLE,
    c.PLANNED_START_DATETIME::DATE::VARCHAR AS CALL_DATE,
    u.FIRST_NAME || ' ' || u.LAST_NAME AS CSM_NAME,
    ROUND(DATEDIFF('second', c.PLANNED_START_DATETIME, c.PLANNED_END_DATETIME) / 60, 1) AS DURATION_MINS,
    ctx.MAPPED_FIELDS_SNAPSHOT:name::STRING AS ACCOUNT_NAME
FROM CLEAN.GONG.CALLS c
JOIN CLEAN.GONG.USERS u ON c.OWNER_ID = u.USER_ID
JOIN CLEAN.GONG.CONVERSATION_CONTEXTS ctx
    ON c.CONVERSATION_KEY = ctx.CONVERSATION_KEY
    AND ctx.OBJECT_TYPE = 'account'
WHERE LOWER(TRIM(ctx.MAPPED_FIELDS_SNAPSHOT:name::STRING)) = LOWER(TRIM('${sanitized}'))
  AND c.PLANNED_START_DATETIME::DATE <= '${beforeDate}'
  AND c.PLANNED_START_DATETIME::DATE >= DATEADD('day', -180, '${beforeDate}'::DATE)
  AND DATEDIFF('second', c.PLANNED_START_DATETIME, c.PLANNED_END_DATETIME) >= 300
  AND c.STATUS = 'COMPLETED'
ORDER BY CALL_DATE DESC
LIMIT 20
`;
  const conn = await getConnection();
  return await executeQuery<AccountCall>(conn, query);
}

export async function runSnowflakeQuery<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  const conn = await getConnection();
  return executeQuery<T>(conn, sql);
}

export interface StageHistoryRow {
  OPPORTUNITY_ID: string;
  STAGE_NAME: string;
  CREATED_DATE: string;
}

export interface StageAverage {
  STAGE_NAME: string;
  OUTCOME: string;
  AVG_DAYS: number;
  DEAL_COUNT: number;
}

export async function getStageHistory(oppIds: string[]): Promise<StageHistoryRow[]> {
  if (oppIds.length === 0) return [];
  const conn = await getConnection();
  const CHUNK = 100;
  const results: StageHistoryRow[] = [];
  for (let i = 0; i < oppIds.length; i += CHUNK) {
    const chunk = oppIds.slice(i, i + CHUNK);
    const placeholders = chunk.map(() => '?').join(', ');
    const rows = await executeQuery<StageHistoryRow>(
      conn,
      `SELECT OPPORTUNITY_ID, STAGE_NAME, CREATED_DATE::DATE::VARCHAR AS CREATED_DATE
       FROM CLEAN.SALESFORCE.OPPORTUNITY_HISTORY
       WHERE OPPORTUNITY_ID IN (${placeholders})
       ORDER BY OPPORTUNITY_ID, CREATED_DATE ASC`,
      chunk as any
    );
    results.push(...rows);
  }
  return results;
}

export async function getStageAverages(from?: string, to?: string): Promise<StageAverage[]> {
  const conn = await getConnection();
  const dateConditions = [
    'o.ISCLOSED = TRUE',
    "o.CREATEDDATE >= '2024-01-01'",
    ...(from ? [`o.CREATEDDATE >= '${from}'`] : []),
    ...(to ? [`o.CREATEDDATE <= '${to}'`] : []),
  ].join(' AND ');

  return executeQuery<StageAverage>(
    conn,
    `WITH csm_identifiers AS (
       SELECT DISTINCT
         u.FIRST_NAME || ' ' || u.LAST_NAME AS FULL_NAME,
         LOWER(TRIM(u.EMAIL_ADDRESS)) AS EMAIL
       FROM CLEAN.GONG.USERS u
       WHERE u.TITLE ILIKE '%customer success%'
     ),
     transitions AS (
       SELECT
         oh.OPPORTUNITY_ID,
         oh.STAGE_NAME,
         oh.CREATED_DATE AS stage_start,
         LEAD(oh.CREATED_DATE) OVER (PARTITION BY oh.OPPORTUNITY_ID ORDER BY oh.CREATED_DATE) AS stage_end
       FROM CLEAN.SALESFORCE.OPPORTUNITY_HISTORY oh
       JOIN CLEAN.SALESFORCE.OPPORTUNITY o ON oh.OPPORTUNITY_ID = o.ID
       JOIN CLEAN.SALESFORCE.USER su ON o.CREATED_BY_SNAPSHOT__C = su.ID
       JOIN csm_identifiers ci
         ON LOWER(TRIM(su.EMAIL)) = ci.EMAIL
         OR LOWER(TRIM(su.NAME)) = LOWER(TRIM(ci.FULL_NAME))
       WHERE ${dateConditions}
     )
     SELECT
       t.STAGE_NAME,
       CASE WHEN o.STAGENAME ILIKE '%won%' THEN 'won' ELSE 'lost' END AS OUTCOME,
       ROUND(AVG(DATEDIFF('day', t.stage_start, COALESCE(t.stage_end, CURRENT_DATE())))) AS AVG_DAYS,
       COUNT(DISTINCT t.OPPORTUNITY_ID) AS DEAL_COUNT
     FROM transitions t
     JOIN CLEAN.SALESFORCE.OPPORTUNITY o ON t.OPPORTUNITY_ID = o.ID
     WHERE DATEDIFF('day', t.stage_start, COALESCE(t.stage_end, CURRENT_DATE())) BETWEEN 0 AND 365
       AND t.STAGE_NAME NOT ILIKE '%closed%'
     GROUP BY t.STAGE_NAME, CASE WHEN o.STAGENAME ILIKE '%won%' THEN 'won' ELSE 'lost' END
     ORDER BY t.STAGE_NAME, OUTCOME`
  );
}

export function isSnowflakeConfigured(): boolean {
  return !!(
    process.env.SNOWFLAKE_ACCOUNT &&
    process.env.SNOWFLAKE_USER &&
    process.env.SNOWFLAKE_PASSWORD &&
    process.env.SNOWFLAKE_WAREHOUSE
  );
}
