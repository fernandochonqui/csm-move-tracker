# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [2.0.0] - 2024-12-19

### Added
- User authentication with Replit Auth (supports Google, GitHub, email login)
- Email domain restriction - only @pandadoc.com users can access the application
- PostgreSQL database integration with Drizzle ORM
- Assessment history tracking with persistent storage
- Performance trends visualization over time using Recharts
- Sharing functionality to share assessments with managers and team members
- Landing page for unauthenticated users
- History view showing all user's past assessments
- Trends view with line charts showing score progression
- Shared With Me view for assessments shared by others
- Account Name field (replaced separate CSM/call label fields)
- Spider/radar chart for visualizing MOVE scores
- PandaDoc logo favicon
- Comprehensive README with local development instructions

### Changed
- Frontend architecture updated to support authenticated routes
- Assessment auto-save on analysis (no manual save required)
- Backend server binds to 127.0.0.1 (IPv4) instead of 'localhost' to avoid IPv6 issues
- Authentication redirect URI uses X-Forwarded-Host header for proxy compatibility
- Spider chart uses fixed dimensions (250px height) for reliable rendering
- React hooks refactored to comply with Rules of Hooks (all hooks before conditionals)

### Security
- Email domain restriction enforced at authentication level
- Sharing restricted to @pandadoc.com email addresses only
- Session management with PostgreSQL-backed session store
- All routes protected with authentication middleware

### Technical Details
- Database schema: users, assessments, assessment_shares, sessions tables
- getDomain() helper function handles Replit proxy environment
- isAllowedEmailDomain() validates email domains for auth and sharing
- ResponsiveContainer replaced with explicit dimensions for chart reliability

## [1.0.0] - 2024-12-19

### Added
- Express.js backend server (`server/index.ts`) to handle Gemini API calls securely
- API endpoint `/api/analyze` for transcript analysis
- Vite proxy configuration to route API calls to backend during development
- Production-ready server configuration that serves static files and handles API requests

### Changed
- Migrated Gemini API calls from client-side to server-side for security
- Updated `services/geminiService.ts` to call backend API instead of directly accessing Gemini
- Updated Vite config to use port 5000 with proxy to backend on port 3001
- Changed deployment target from static to autoscale to support backend server

### Removed
- Client-side API key exposure via Vite's `define` configuration
- Direct `@google/genai` imports from frontend service

### Security
- API keys are now stored as environment secrets and only accessed server-side
- Client-side JavaScript bundle no longer contains sensitive credentials
- All AI analysis requests are proxied through the backend server

### Fixed
- Added missing `<script>` tag in `index.html` to load the main application entry point
