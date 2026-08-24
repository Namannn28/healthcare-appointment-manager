# Healthcare Appointment & Follow-up Manager

A comprehensive healthcare platform providing patient booking, AI-generated visit summaries (via Claude), background jobs (email/calendar updates via BullMQ), and role-based access.

## Features
- **Role-Based Portals**: Admin, Doctor, and Patient access.
- **Double-booking Prevention**: Transactional slot booking with row-level locks and partial unique indexing.
- **AI Integration**: Anthropic (Claude) API analyzes symptoms (pre-visit) and generates patient-friendly summaries (post-visit).
- **Background Jobs**: **n8n** Webhook Integration to automate email notifications, calendar syncs, and medication reminders.
- **Modern UI**: React and Vite with TailwindCSS, utilizing a dark-themed CRM template.

## Tech Stack
- **Backend**: Node.js, Express, PostgreSQL, Axios.
- **Frontend**: React, Vite, Tailwind CSS.
- **Integrations**: Anthropic API, n8n (Webhooks for Google Calendar & Nodemailer).

## Setup Instructions

### Prerequisites
- Node.js (v18+)
- PostgreSQL installed and running
- Redis installed and running (default port 6379)
- GitHub account (for pushing code)

### 1. Database Setup
1. Create a PostgreSQL database (e.g. `healthcare`).
2. Run the schema migrations from `backend/database.sql`:
   ```bash
   psql -U postgres -d healthcare -f backend/database.sql
   ```

### 2. Backend Setup
1. `cd backend`
2. Configure environment variables in `.env` based on `.env.example`. Make sure `DATABASE_URL` matches your DB.
3. Start the server:
   ```bash
   node server.js
   ```

### 3. Frontend Setup
1. `cd frontend`
2. Start the Vite development server:
   ```bash
   npm run dev
   ```

### 4. Push to GitHub
If you haven't already:
```bash
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <YOUR_GITHUB_REPO_URL>
git push -u origin main
```
