# MOVE Framework Self-Assessment Tool

A sales call analysis tool for PandaDoc CSMs that uses Google's Gemini AI to analyze call transcripts and score them against the MOVE (Motivation, Opportunity, Validation, Execution) rubric.

## Features

- **AI-Powered Analysis**: Automatically analyze sales call transcripts using Google Gemini
- **MOVE Scoring**: Score calls against Discovery Quality, Motivation, Opportunity, Validation, and Execution criteria
- **Stakeholder Detection**: Automatically identify stakeholders mentioned in calls
- **Assessment History**: Track and review all your past assessments
- **Performance Trends**: Visualize your scoring trends over time with charts
- **Team Sharing**: Share assessments with managers and team members
- **Secure Authentication**: Replit Auth integration restricted to @pandadoc.com emails only

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS
- **Backend**: Express.js, Node.js
- **Database**: PostgreSQL with Drizzle ORM
- **AI**: Google Gemini API (@google/genai)
- **Auth**: Replit Auth (OpenID Connect)
- **Charts**: Recharts

## Project Structure

```
├── client/                  # Frontend source (Vite serves from here)
│   ├── components/          # React components
│   ├── hooks/               # Custom React hooks
│   ├── services/            # API service layer
│   ├── App.tsx              # Main application component
│   ├── constants.ts         # MOVE rubric definitions
│   └── types.ts             # TypeScript types
├── server/                  # Backend source
│   ├── replit_integrations/ # Auth integration
│   │   └── auth/            # Replit Auth setup
│   ├── index.ts             # Express server entry point
│   └── db.ts                # Database connection
├── shared/                  # Shared code between frontend/backend
│   └── schema.ts            # Drizzle database schema
└── dist/                    # Production build output
```

## Local Development

### Prerequisites

- Node.js 20+
- PostgreSQL database
- Google Gemini API key

### Environment Variables

Create a `.env` file (or set these in your environment):

```bash
# Required
GEMINI_API_KEY=your_gemini_api_key
DATABASE_URL=postgresql://user:password@host:port/database

# For Replit Auth (auto-configured on Replit)
REPL_ID=your_repl_id
REPLIT_DEV_DOMAIN=your_dev_domain
SESSION_SECRET=your_session_secret
```

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd move-framework-tool
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up the database**
   ```bash
   npm run db:push
   ```

4. **Start the development servers**

   You need to run both the backend and frontend servers:

   **Terminal 1 - Backend server (port 3001):**
   ```bash
   node --import tsx server/index.ts
   ```

   **Terminal 2 - Frontend server (port 5000):**
   ```bash
   npm run dev
   ```

5. **Access the application**
   
   Open http://localhost:5000 in your browser.

### Notes for Local Development

- The backend binds to `127.0.0.1:3001` (IPv4) to avoid IPv6 resolution issues
- The frontend Vite dev server proxies `/api` requests to the backend
- Authentication requires Replit environment variables (`REPL_ID`, etc.) - when running locally outside Replit, auth will not work
- For local testing without auth, you may need to modify `server/index.ts` to bypass authentication checks

## Production Deployment

The app is configured for Replit autoscale deployment:

1. **Build the frontend**
   ```bash
   npm run build
   ```

2. **Run the production server**
   ```bash
   NODE_ENV=production node --import tsx server/index.ts
   ```

The production server:
- Serves static files from `dist/`
- Handles API requests
- Binds to `0.0.0.0:5000` for external access

## Security

- **API Keys**: Gemini API key is stored as a secret and only accessed server-side
- **Authentication**: Replit Auth with email domain restriction (@pandadoc.com only)
- **Sharing**: Assessments can only be shared with @pandadoc.com email addresses
- **Database**: All assessments are tied to authenticated users

## Database Schema

- `users` - User profiles from Replit Auth
- `assessments` - Saved assessments with scores, stakeholders, and Q&A
- `assessment_shares` - Sharing relationships between users
- `sessions` - Session storage for authentication

## Scripts

- `npm run dev` - Start Vite dev server (frontend only)
- `npm run build` - Build for production
- `npm run db:push` - Push schema changes to database
- `node --import tsx server/index.ts` - Start backend server

## License

Internal PandaDoc tool - not for public distribution.
