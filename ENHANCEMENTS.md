# MOVE Framework Tool - Enhancement Summary

This document explains what was added when the original version was enhanced with a database and deployed on Replit. It's written for the original creator to understand what's new and how the app has evolved.

---

## Before vs. After Overview

| Aspect | Before (v1.0) | After (v2.0) |
|--------|---------------|--------------|
| Data Storage | None - assessments were lost on page refresh | Saved permanently in a database |
| User Identity | None - anyone could use it | Login required with @pandadoc.com email |
| Access | Only worked locally | Live on the web 24/7 |
| History | None | Full history of all assessments |
| Collaboration | Not possible | Share assessments with teammates |

---

## New User-Facing Features

### 1. Login with Your Work Account
- Users now sign in using their PandaDoc email
- Supports Google, GitHub, or email-based login
- Only @pandadoc.com email addresses are allowed (security restriction)

### 2. Your Assessments Are Saved Automatically
- Every time you analyze a call, it's saved to your account
- No more copy-pasting results or losing your work
- You can close the browser and come back later - your data is still there

### 3. Assessment History
- New **History** section shows all your past assessments
- See the account name, date, and scores at a glance
- Click any assessment to view full details
- Delete old assessments you no longer need

### 4. Performance Trends Over Time
- New **Trends** view shows how your scores change over time
- Line charts display Discovery Quality, Motivation, Opportunity, Validation, and Execution scores
- Helps identify patterns in your call performance

### 5. Share Assessments with Your Team
- Share any assessment with a manager or teammate
- They'll see it in their "Shared With Me" section
- Only @pandadoc.com emails can receive shares
- Great for coaching conversations or manager reviews

### 6. Shared With Me View
- See all assessments others have shared with you
- Easily distinguish between your own work and shared assessments

### 7. Account Name Field
- Replaced separate CSM/call label fields with a single "Account Name" field
- Cleaner interface for tracking which customer the call was about

### 8. Visual Score Charts
- Spider/radar chart shows your MOVE scores visually
- Makes it easy to spot strengths and areas for improvement at a glance

### 9. Landing Page
- New welcome page for users who aren't logged in
- Explains what the tool does and provides login button

---

## Platform Capabilities (From Replit Deployment)

### Always Online
- The app runs 24/7 on Replit's servers
- No need to keep your computer on or run anything locally
- Accessible from any device with a web browser

### Automatic Scaling
- Uses Replit's "autoscale" deployment
- When nobody is using it, it scales down (saves resources)
- When people start using it, it scales up automatically

### Secure API Key Management
- The Gemini AI API key is stored as a secret on the server
- Users never see or have access to the API key
- If the key needs to be rotated, it's changed in one place

### Database with Backup Capability
- Uses Replit's managed PostgreSQL database
- Data is stored reliably and can be backed up
- Database supports rollback if something goes wrong

### Session Management
- User login sessions are stored securely
- Users stay logged in across browser sessions
- Sessions expire automatically for security

---

## Technical Changes (For Reference)

If you need to make changes or understand how things work:

### Database Tables
- **users** - Stores user profiles (email, name, profile picture)
- **assessments** - Stores all saved assessments with scores, transcript, and AI analysis
- **assessment_shares** - Tracks who shared what with whom
- **sessions** - Manages login sessions

### Key Files Changed/Added
- `server/index.ts` - Main backend server with all API endpoints
- `server/db.ts` - Database connection setup
- `server/replit_integrations/auth/` - Login/authentication code
- `shared/schema.ts` - Database table definitions
- `client/components/` - New UI components for history, trends, sharing

### Environment Variables Required
- `GEMINI_API_KEY` - For AI analysis (stored as secret)
- `DATABASE_URL` - Database connection (auto-configured by Replit)
- `SESSION_SECRET` - For secure sessions (stored as secret)

---

## How to Operate the App

### Viewing the Live App
The app is deployed and accessible at its Replit URL. Anyone with a @pandadoc.com email can log in and use it.

### Updating the App
1. Make changes in the Replit editor
2. The app will automatically restart to pick up changes
3. For production deployment, click the "Publish" button

### Checking Logs
- Use Replit's console/logs panel to see server output
- Helpful for debugging if something isn't working

### Database Management
- Use Replit's database panel to view/edit data if needed
- Be careful - changes to the database affect all users

---

## Summary of What You Now Have

You started with a basic tool that analyzed transcripts but lost all data on refresh. You now have:

1. **A real web application** that's always online and accessible to your team
2. **Persistent storage** so nothing is ever lost
3. **User accounts** so each person has their own data
4. **Collaboration features** for sharing and team coaching
5. **Analytics** to track performance over time
6. **Enterprise-grade security** with email domain restrictions and secure API key handling

The app has evolved from a personal prototype to a team-ready tool that can support the entire CSM organization.
