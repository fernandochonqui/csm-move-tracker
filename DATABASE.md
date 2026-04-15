# Database Documentation

This document explains how the database works in the MOVE Framework Self-Assessment Tool, including schema definitions, relationships, and how to make changes safely.

## Overview

The application uses **PostgreSQL** as the database and **Drizzle ORM** for database interactions. The database is hosted on Replit's managed PostgreSQL service (Neon-backed).

- **ORM**: Drizzle ORM
- **Database**: PostgreSQL
- **Connection**: Via `DATABASE_URL` environment variable
- **Schema Location**: `shared/models/`

## Database Connection

The database connection is established in `server/db.ts`:

```typescript
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
```

The `db` object is imported throughout the application to perform database operations.

## Schema Structure

The schema is split into two model files for organization:

```
shared/
├── schema.ts           # Re-exports all models
└── models/
    ├── auth.ts         # Users and sessions tables
    └── assessments.ts  # Assessments and shares tables
```

## Tables

### 1. `users`

Stores user profiles from Replit Auth.

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR (PK) | User ID from Replit Auth (UUID) |
| `email` | VARCHAR (UNIQUE) | User's email address |
| `first_name` | VARCHAR | User's first name |
| `last_name` | VARCHAR | User's last name |
| `profile_image_url` | VARCHAR | URL to profile image |
| `role` | VARCHAR | User role (default: "csm") |
| `created_at` | TIMESTAMP | When user was created |
| `updated_at` | TIMESTAMP | When user was last updated |

**Schema Definition** (`shared/models/auth.ts`):
```typescript
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").default("csm"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

### 2. `sessions`

Stores session data for authentication (used by express-session with connect-pg-simple).

| Column | Type | Description |
|--------|------|-------------|
| `sid` | VARCHAR (PK) | Session ID |
| `sess` | JSONB | Session data |
| `expire` | TIMESTAMP | When session expires |

**Schema Definition** (`shared/models/auth.ts`):
```typescript
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);
```

### 3. `assessments`

Stores all assessment results from AI analysis.

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL (PK) | Auto-incrementing ID |
| `user_id` | VARCHAR (FK) | References `users.id` |
| `account_name` | VARCHAR | Name of the account/company |
| `transcript` | TEXT | Full call transcript |
| `scores` | JSONB | MOVE scores object |
| `stakeholders` | JSONB | Detected stakeholders array |
| `executive_summary` | TEXT | AI-generated summary |
| `key_strengths` | JSONB | Array of strengths |
| `coaching_tips` | JSONB | Array of coaching suggestions |
| `qa` | JSONB | Question/answer analysis |
| `total_score` | INTEGER | Sum of all MOVE scores |
| `created_at` | TIMESTAMP | When assessment was created |
| `updated_at` | TIMESTAMP | When assessment was last updated |

**Schema Definition** (`shared/models/assessments.ts`):
```typescript
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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

**JSONB Field Structures**:

`scores` object:
```json
{
  "discoveryQuality": 3,
  "motivation": 4,
  "opportunity": 3,
  "validation": 2,
  "execution": 4
}
```

`stakeholders` array:
```json
[
  { "name": "John Smith", "role": "VP of Sales", "influence": "Decision Maker" }
]
```

`keyStrengths` and `coachingTips` arrays:
```json
["Good discovery questions", "Strong rapport building"]
```

`qa` array:
```json
[
  { "question": "What was the main pain point?", "answer": "Slow document turnaround" }
]
```

### 4. `assessment_shares`

Stores sharing relationships between users for assessments.

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL (PK) | Auto-incrementing ID |
| `assessment_id` | INTEGER (FK) | References `assessments.id` |
| `shared_by_user_id` | VARCHAR (FK) | User who shared (references `users.id`) |
| `shared_with_user_id` | VARCHAR (FK) | User receiving share (references `users.id`) |
| `permission` | VARCHAR | Permission level (default: "view") |
| `created_at` | TIMESTAMP | When share was created |

**Schema Definition** (`shared/models/assessments.ts`):
```typescript
export const assessmentShares = pgTable("assessment_shares", {
  id: serial("id").primaryKey(),
  assessmentId: integer("assessment_id").notNull().references(() => assessments.id),
  sharedByUserId: varchar("shared_by_user_id").notNull().references(() => users.id),
  sharedWithUserId: varchar("shared_with_user_id").notNull().references(() => users.id),
  permission: varchar("permission").notNull().default("view"),
  createdAt: timestamp("created_at").defaultNow(),
});
```

## Entity Relationships

```
┌──────────────┐       ┌─────────────────┐       ┌───────────────────┐
│    users     │       │   assessments   │       │ assessment_shares │
├──────────────┤       ├─────────────────┤       ├───────────────────┤
│ id (PK)      │◄──────│ user_id (FK)    │       │ id (PK)           │
│ email        │       │ id (PK)         │◄──────│ assessment_id(FK) │
│ first_name   │       │ account_name    │       │ shared_by_user_id │──►users.id
│ last_name    │       │ transcript      │       │ shared_with_user  │──►users.id
│ ...          │       │ scores          │       │ permission        │
└──────────────┘       │ ...             │       │ created_at        │
                       └─────────────────┘       └───────────────────┘
```

- A **user** can have many **assessments**
- An **assessment** belongs to one **user**
- An **assessment** can have many **shares**
- A **share** connects two **users** through one **assessment**

## Common Database Operations

### Reading Data

```typescript
import { db } from "./db";
import { users, assessments, assessmentShares } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";

// Get user by ID
const [user] = await db.select().from(users).where(eq(users.id, userId));

// Get user's assessments (paginated)
const userAssessments = await db.select()
  .from(assessments)
  .where(eq(assessments.userId, userId))
  .orderBy(desc(assessments.createdAt))
  .limit(10)
  .offset(0);

// Get assessment with ownership check
const [assessment] = await db.select()
  .from(assessments)
  .where(eq(assessments.id, assessmentId));
```

### Inserting Data

```typescript
// Create new assessment
const [saved] = await db.insert(assessments).values({
  userId,
  accountName: "Acme Corp",
  transcript: "...",
  scores: { discoveryQuality: 3, motivation: 4, ... },
  stakeholders: [...],
  totalScore: 16,
}).returning();

// Create share
const [share] = await db.insert(assessmentShares).values({
  assessmentId,
  sharedByUserId: userId,
  sharedWithUserId: targetUser.id,
  permission: "view",
}).returning();
```

### Updating Data (Upsert)

```typescript
// Upsert user (insert or update on conflict)
const [user] = await db
  .insert(users)
  .values(userData)
  .onConflictDoUpdate({
    target: users.id,
    set: {
      ...userData,
      updatedAt: new Date(),
    },
  })
  .returning();
```

### Deleting Data

```typescript
// Delete a share
await db.delete(assessmentShares).where(eq(assessmentShares.id, shareId));
```

### Joins

```typescript
// Get assessments shared with current user (with sharer info)
const shares = await db.select({
  assessment: assessments,
  share: assessmentShares,
  sharedBy: users,
})
  .from(assessmentShares)
  .innerJoin(assessments, eq(assessmentShares.assessmentId, assessments.id))
  .innerJoin(users, eq(assessmentShares.sharedByUserId, users.id))
  .where(eq(assessmentShares.sharedWithUserId, userId))
  .orderBy(desc(assessmentShares.createdAt));
```

## Making Schema Changes

### Adding a New Column

1. Update the schema file (e.g., `shared/models/assessments.ts`):
   ```typescript
   export const assessments = pgTable("assessments", {
     // ... existing columns
     newColumn: varchar("new_column"),  // Add new column
   });
   ```

2. Push changes to database:
   ```bash
   npm run db:push
   ```

### Adding a New Table

1. Create or update a model file in `shared/models/`:
   ```typescript
   export const newTable = pgTable("new_table", {
     id: serial("id").primaryKey(),
     name: varchar("name").notNull(),
     createdAt: timestamp("created_at").defaultNow(),
   });
   ```

2. Export from `shared/schema.ts` if in a new file:
   ```typescript
   export * from "./models/newModel";
   ```

3. Push changes:
   ```bash
   npm run db:push
   ```

### Important Safety Rules

1. **NEVER change primary key types** - Changing from `serial` to `varchar` or vice versa will break existing data

2. **Use `db:push` not manual migrations** - Drizzle handles schema synchronization safely:
   ```bash
   npm run db:push
   # If there are conflicts:
   npm run db:push --force
   ```

3. **Check existing schema first** - Before making changes, understand what already exists

4. **Preserve ID patterns**:
   - Serial IDs: `id: serial("id").primaryKey()`
   - UUID IDs: `id: varchar("id").primaryKey().default(sql\`gen_random_uuid()\`)`

5. **Foreign key considerations** - When adding foreign keys, ensure referenced tables exist

## TypeScript Types

Drizzle automatically generates types from the schema:

```typescript
// Import types
import { User, UpsertUser } from "@shared/schema";
import { Assessment, NewAssessment, AssessmentShare } from "@shared/schema";

// Use inferred types
type User = typeof users.$inferSelect;        // For reading
type UpsertUser = typeof users.$inferInsert;  // For inserting
```

## Environment Setup

The database requires the `DATABASE_URL` environment variable:

```bash
DATABASE_URL=postgresql://user:password@host:port/database
```

On Replit, this is automatically configured when you create a PostgreSQL database.

## Useful Commands

```bash
# Push schema changes to database
npm run db:push

# Force push (use with caution)
npm run db:push --force

# Generate migrations (if needed)
npx drizzle-kit generate

# Open Drizzle Studio (database GUI)
npx drizzle-kit studio
```

## Troubleshooting

### "Relation does not exist" error
Run `npm run db:push` to create missing tables.

### Type mismatch errors
Ensure your Drizzle schema matches the actual database structure. Never manually change column types.

### Connection issues
Verify `DATABASE_URL` is set correctly and the database is accessible.

### Migration conflicts
If `db:push` fails, try `npm run db:push --force` (be careful with production data).
