# MOVE Framework Self-Assessment Tool

## Overview
A sales call analysis tool built with React, TypeScript, and Vite for PandaDoc CSMs. Uses Google's Gemini AI to analyze sales call transcripts and score them against the MOVE (Motivation, Opportunity, Validation, Execution) rubric.

## Recent Changes (February 2026)
- Stage Velocity feature: "Days in Stage" column in CSQL table shows how long each deal has been sitting in its current stage, color-coded green/amber/red vs historical won/lost averages; new "Stage Velocity" analytics chart tab (7th sub-tab) shows horizontal bar chart of avg days in each stage for won vs lost deals plus current open deal avg, plus summary table; data fetched from `CLEAN.SALESFORCE.OPPORTUNITY_HISTORY` via `GET /api/csql-stage-history` with 10-min in-memory cache; `getStageHistory(oppIds[])` and `getStageAverages()` functions added to `server/snowflake.ts`; `useCSQLStageHistory` hook added to `hooks/use-csql-outcomes.ts`
- Trends tab now includes Monthly/Quarterly toggle: merged QuarterlyDashboard into TrendsView; Quarterly nav tab removed; Monthly shows month-by-month line/bar charts with Manager/CSM filters; Quarterly shows grouped bar chart, total score line chart, and quarter detail table
- Rep Analysis tab: 4th chart sub-tab in CSQL section showing per-CSM avg scores across all 5 MOVE dimensions (Discovery, Motivation, Opportunity, Validation, Execution), avg total score, win rate, CSQL count; color-coded dimension cells (green/amber/red by score); local time filter (All/This Month/This Quarter/Last Quarter/This Year); AI Coaching button per rep calls `/api/csql-rep-coaching` which uses Gemini 2.5 Flash to return dimension-specific coaching (rating, observation, 2-3 tips) and overall summary
- Auto-link CSQL on Find Calls analyze: after scoring a call via Find Calls modal, immediately POSTs to `/api/csql/override` to create a manual link so the score appears in the CSQL report without relying on indirect Salesforce account ID attribution
- Attribution window extended from 90 to 180 days: matches the 180-day lookback used by Find Calls search
- Manual match confidence override: clickable match dot opens popover with green/yellow/red options + reset; manual overrides show checkmark badge on dot and "Manually confirmed" in tooltip; `isManual` boolean column on `csql_match_confidence` table; `POST /api/csql/set-match-confidence` upserts with isManual=true; `DELETE /api/csql/reset-match-confidence/:oppId` removes entry; click-outside closes popover
- Per-CSQL exclusion toggle: toggle switch in Call Score column lets users include/exclude scored CSQLs from analytics; excluded CSQLs have dimmed rows and strikethrough scores; state persisted in `csql_exclusions` table; `analyticsCSQLs` memo nullifies linkedAssessment for excluded items so charts/summary/insights ignore them while table still shows them
- AI Match Confidence: "Analyze Matches" button uses Gemini to compare CSQL opportunity name with linked call's executive summary; rates green/yellow/red; results cached in `csql_match_confidence` table; color dot column in CSQL table with hover tooltip showing reasoning; batches of 10 for efficiency
- Call Proximity filter: new dropdown (All, 1 Day, 3 Days, 7 Days, 30 Days) excludes CSQLs where the linked call happened more than N days from CSQL creation date; applied globally to all charts, summary, and table; works with all other filters
- Duplicate CSQL exclusion: Snowflake query filters out opportunities where LOSS_REASON__C contains "duplicate" (50 opps excluded); stage name filter was incorrect, loss reason is the correct field
- Stage multi-select filter: custom checkbox dropdown replaces single-select for stage filtering; supports multiple simultaneous stage selections
- CSQL unscored badge: navigation tab shows count of unlinked CSQLs needing scoring; fetched via lightweight `/api/csql-unscored-count` endpoint at app load with 5-min cache; badge updates after scoring/override actions
- Gong tab badge: also shows count of new unanalyzed calls inline in the navigation pill
- CSQL time period filter: pill-style segmented control (1W, 1M, This Q, Prev Q, 1Y, Prev Y, All) matching nav tab style
- CSQL filter fixes: stale filter values auto-reset when time period changes; active filter count badge + "Clear All" button; active dropdowns get green border highlight
- Navigation tabs refactored: horizontal scroll with hidden scrollbar for overflow handling on smaller screens, cleaner map-based rendering
- CSQL chart sub-tabs: charts organized into 3 sub-tabs (Overview, Score Trends, MOVE Analysis) to reduce scroll and improve focus
- Skeleton loading: CSQL tab shows layout-matching skeleton placeholders (summary cards, chart area, table rows) instead of spinner during load
- MOVE Dimension Breakdown chart: grouped bar chart showing avg scores per dimension (Discovery, M, O, V, E) for Closed Won vs Lost, with median values and coaching priority callout
- MOVE Dimension Trends chart: 5 line charts showing each dimension's avg score over time with weekly/monthly/quarterly toggle, trend indicators
- Score-to-Outcome chart updated to 5 buckets: Very Low (1-4), Low (5-8), Medium (9-12), High (13-16), Very High (17-20)
- Average Score Trend Over Time chart: bar + cumulative line showing overall score trend with granularity toggle
- CSQL call override: Replace auto-scored calls with manually selected correct calls via "Replace" button in CSQL table
- Override stored in `csql_call_overrides` table (oppId → assessmentId); overrides take priority over auto-attribution
- "Undo" button to revert manual overrides back to auto-linked call; "Manual" label shows when a CSQL has been manually linked
- Parallel batch auto-scoring: 4 concurrent workers process CSQLs simultaneously (3-4x faster)
- AI Insights panel on CSQL tab: on-demand Gemini analysis of filtered CSQL data providing Key Insights, At-Risk Deals, Coaching Recommendations, and Win/Loss Patterns
- AI Insights uses structured JSON schema output from Gemini 2.5 Flash; data capped at 200 CSQLs per request
- CSM and Manager filter dropdowns added to CSQL tab (createdByName and creatorManager); all filters apply to charts, summary, and table

## Previous Changes (February 2026)
- Added Quarterly Dashboard view: shows score trends organized by fiscal quarters (Q3 2025 = Jul-Sep, Q4 = Oct-Dec, etc.) with grouped bar charts, total score line chart, and detail table
- Made Gong-analyzed call assessments viewable by all logged-in users (not just the person who analyzed)
- Added Team Trends view: shows all analyzed calls across the team with Team/Personal toggle (defaults to Team)
- Gong call cards now show score, "View" button, and who analyzed each call
- Added CSM name display on Gong call cards
- Added CSM Leaderboard view with 5 tabs: Overall, Motivation, Opportunity, Execution, Validation
- Added editable qualifying call filters: toggle filters on/off, adjust numeric params (duration, renewal days), add/remove transcript keyword patterns from the UI
- Replaced transcript keyword filtering with call title pattern matching as primary qualifying call criteria
- New call title patterns: Success Sync, Monthly/Quarterly Business Review, MBR, QBR, Workflow Consultation, Account Sync, Account Review
- Made Salesforce opportunity/renewal joins conditional - only execute when renewal filters are enabled
- Transcript keyword filter disabled by default, kept as optional filter
- Filter config stored in `qualifying_call_filters` DB table; Snowflake SQL built dynamically from active filters
- Added input sanitization and validation for filter params to prevent SQL injection
- Added CSM roster table (name, segment, attachment, manager) with 28 PandaDoc CSMs
- Leaderboard now groups scores by CSM name from Gong call data (not the person who analyzed)
- Leaderboard has filters for Manager's team, Segment, and Attachment
- Added CSQL Outcomes view: tracks CSM-sourced opportunities (CSQLs) linked to qualifying call scores
- CSQL identification: opportunities where Created By matches a CSM from Gong (via email or name)
- Call attribution: links each CSQL to the most recent analyzed call for the same account within 90 days before (or 24h after) opp creation
- CSQL view includes: summary cards (pipeline, win rate, avg scores), score-vs-outcome bar chart, status distribution pie chart, sortable/filterable data table
- Account name normalization for CSQL matching: lowercased, apostrophe/whitespace/punctuation standardized
- CSQL "Find Call" feature: unlinked CSQLs show a button to search Gong for calls on that account before the opp creation date
- Find Call modal shows matching calls with analyze button; once scored, CSQL auto-links via attribution logic
- CSQL attribution: matches scored calls to CSQLs via Salesforce Account ID → Gong Conversation ID mapping (not account name), with 90-day lookback window
- Auto-Score All: batch auto-scores unlinked CSQLs by finding closest Gong call per account, fetching transcript, running Gemini analysis; uses SSE for real-time progress tracking with scored/skipped/failed counts
- Time period filter on CSQL tab: This Week (Monday-based), This Month, Current/Previous Quarter, Current/Previous Year, All Time
- Snowflake connection pooling: singleton connection with session keep-alive, 30s query timeout
- Chart rendering: all ResponsiveContainer components have minHeight/minWidth to prevent sizing warnings
- CSQL data refresh: staleTime set to 0 so charts/table update immediately after scoring; manual refresh button added
- Win Rate Over Time chart: line chart showing win rate by score range (Low/Mid/High) over time with weekly/monthly/quarterly granularity toggle

## Changes (December 2024)
- Added user authentication with Replit Auth (supports Google, GitHub, email login)
- **Email domain restriction**: Only @pandadoc.com users can access the application
- **Sharing restriction**: Assessments can only be shared with @pandadoc.com emails
- Implemented persistent storage with PostgreSQL database
- Added assessment history tracking and performance trends over time
- Created sharing functionality for managers and team members
- Updated UI with landing page, history view, trends view, and shared assessments view
- Changed from single CSM/call label fields to Account Name field
- Fixed backend server binding to use IPv4 (127.0.0.1) for proper local development
- Fixed spider chart rendering with explicit dimensions (250px height)
- Fixed React hooks violation (all hooks before conditional returns)
- Added PandaDoc logo favicon

## Project Architecture
- **Frontend**: React 19 with TypeScript, served via Vite dev server on port 5000
- **Backend**: Express.js server on port 3001 for secure API handling
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Replit Auth integration (OpenID Connect)
- **Build Tool**: Vite
- **Styling**: Tailwind CSS (via CDN)
- **AI Integration**: Google Gemini API (@google/genai) - handled securely on backend
- **Charts**: Recharts for data visualization
- **Icons**: Lucide React

## Key Files
- `App.tsx` - Main application component with auth routing
- `components/LandingPage.tsx` - Unauthenticated landing page
- `components/AssessmentHistory.tsx` - User's assessment history
- `components/TrendsView.tsx` - Performance trends over time
- `components/SharedWithMe.tsx` - Assessments shared by others
- `components/QuarterlyDashboard.tsx` - Quarterly performance dashboard (FY quarters starting Q3 2025)
- `components/TranscriptInput.tsx` - AI transcript analyzer
- `components/CSQLOutcomes.tsx` - CSQL outcomes tracking with call score attribution
- `server/index.ts` - Express backend server (handles Gemini API calls, auth, database)
- `server/replit_integrations/auth/` - Replit Auth integration
- `shared/schema.ts` - Database schema (users, assessments, shares, sessions)
- `hooks/use-auth.ts` - Authentication hook
- `hooks/use-assessments.ts` - Assessment data hooks
- `services/geminiService.ts` - Frontend service that calls backend API
- `constants.ts` - MOVE rubric definitions
- `types.ts` - TypeScript type definitions

## Database Schema
- `users` - User profiles from Replit Auth
- `assessments` - Saved assessment results with scores, QA, stakeholders
- `assessment_shares` - Sharing relationships between users
- `sessions` - Session storage for authentication
- `qualifying_call_filters` - Editable filter configuration for Gong qualifying calls (key, label, description, source, enabled, params as jsonb, sortOrder)

See [DATABASE.md](DATABASE.md) for complete database documentation including schema definitions, relationships, and how to make changes.

## Environment Variables
- `GEMINI_API_KEY` - Required for AI-powered analysis (stored as secret, used only on backend)
- `DATABASE_URL` - PostgreSQL connection string (auto-configured)
- `SESSION_SECRET` - Session encryption key
- `REPL_ID` - Replit environment ID

## Security
- API keys are never exposed to the client
- All Gemini API calls are proxied through the backend server
- User authentication required for all protected routes
- Assessments are tied to authenticated users
- Email domain restriction: Only @pandadoc.com users can authenticate
- Sharing restriction: Assessments can only be shared with @pandadoc.com emails
- Domain validation handled by `isAllowedEmailDomain()` in auth module

## Development
- **Frontend Port**: 5000 (webview)
- **Backend Port**: 3001 (console)
- **Frontend Workflow**: `npm run dev` (vite only)
- **Backend Workflow**: `node --import tsx server/index.ts`
- **Build**: `npm run build`
- **Database Push**: `npm run db:push`

## Deployment
- Autoscale deployment with Express server
- Build command builds Vite frontend
- Server serves static files and handles API requests
- Uses production port 5000 with 0.0.0.0 binding
