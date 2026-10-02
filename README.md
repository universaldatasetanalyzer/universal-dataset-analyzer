# Universal Dataset Analyzer — Full-Stack SaaS

## Project Structure

```
/frontend    — React/TypeScript/Vite SaaS frontend
/backend     — Node.js/Express REST API
/backend/python-service  — FastAPI Python analysis microservice
```

## Quick Start

### 1. Database (PostgreSQL required)
```bash
createdb uda_db
cd backend
npm install
npm run migrate
```

### 2. Backend
```bash
cd backend
npm install
npm run dev
# Runs on http://localhost:3001
```

### 3. Python Microservice
```bash
cd backend/python-service
pip install -r requirements.txt
python main.py
# Runs on http://localhost:8000
```

### 4. Frontend
```bash
cd frontend
npm install
npm install @paddle/paddle-js
npm run dev
# Runs on http://localhost:5173
```

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and replace each placeholder with a real local or deployment value.

### backend/.env
```
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=uda_db
DB_USER=postgres
DB_PASSWORD=replace_with_database_password
JWT_SECRET=replace_with_long_random_secret
PYTHON_SERVICE_URL=http://localhost:8000
GEMINI_API_KEY=replace_with_gemini_api_key
GEMINI_MODEL=gemini-3.6-flash
FRONTEND_URL=http://localhost:5173
PYTHON_SERVICE_URL=http://localhost:8000
PYTHON_SERVICE_TOKEN=replace_with_internal_service_token

# Email (Resend)
RESEND_API_KEY=replace_with_resend_api_key
EMAIL_FROM=onboarding@resend.dev

# Beta resource limits
STORAGE_PROVIDER=local
MAX_FILE_SIZE=52428800
MAX_DATASET_ROWS=1000000
MAX_DATASET_COLUMNS=200
MAX_STORAGE_BYTES=5368709120
MAX_CONCURRENT_ANALYSES=2
APP_URL=http://localhost:5173
```

### frontend/.env
```
VITE_API_URL=http://localhost:3001/api
```

## Features Implemented

### Phase A — Backend Architecture ✅
- Express.js REST API with controllers, services, middleware
- Request validation, error handling, logging
- Rate limiting (200 req/15min, 20 auth req/15min)

### Phase B — Database ✅
- PostgreSQL with full schema:
  users, organizations, org_members, datasets, analysis_results,
  chat_sessions, chat_messages, reports, subscriptions, usage_tracking, audit_logs
- Migration script: `npm run migrate`

### Phase C — Authentication ✅
- Register, Login, Logout, Forgot/Reset Password
- Password reset and verification email via Resend
- JWT authentication (7-day tokens)
- Protected routes (frontend auth guard)
- Role-based access: Owner, Admin, Analyst, Viewer

### Phase D — Real Dataset Analysis ✅
- Python FastAPI microservice
- Supports CSV, XLSX, XLS, TSV, JSON
- Column type detection (numeric, categorical, datetime, boolean, text)
- Missing value analysis
- Duplicate detection
- Outlier detection (IQR method)
- Correlation analysis
- Dataset health score calculation

### Phase E — Data Cleaning Engine ✅
- Fill missing values (mean, median, mode, custom, drop)
- Remove duplicates
- Outlier handling (remove, cap, winsorize)
- Text normalization (trim, lowercase, uppercase, titlecase)
- Drop empty columns
- Preview mode before applying
- Download cleaned dataset

### Phase F — Visualization Engine ✅
- Histograms for numeric columns
- Bar charts for categorical columns
- Scatter plots for numeric pairs
- Correlation heatmap
- All charts use real dataset data

### Phase G — AI Insights Engine ✅
- OpenAI-compatible API integration
- Generates: executive summary, key findings, trends, correlations, anomalies, recommendations
- Insight history stored in DB
- Regenerate on demand
- Graceful fallback when no API key configured

### Phase H — Chat With Dataset ✅
- AI-powered dataset assistant
- Session management with history
- Real conversation context with dataset metadata
- Markdown rendering in responses
- Persisted chat history

### Phase I — Report Generation ✅
- Report creation with dataset context
- Types: full, quality, summary, executive
- Status tracking (generating → ready)
- Delete reports

### Phase J — Teams ✅
- Organization management
- Member invitations
- Role management (owner/admin/analyst/viewer)
- Permission matrix

### Phase K — Subscriptions ✅
- Free / Pro / Business / Enterprise plans
- Usage tracking
- Plan switching
- Billing dashboard with invoices

### Phase L — Security ✅
- JWT authentication
- bcrypt password hashing (12 rounds)
- Rate limiting
- Helmet.js (XSS, CSRF protection)
- Input validation
- SQL injection protection (parameterized queries)
- Secure file uploads (type + size validation)
- Audit log table

## API Endpoints

### Auth
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/forgot-password
POST /api/auth/reset-password

### Datasets
GET    /api/datasets
POST   /api/datasets/upload
GET    /api/datasets/:id
DELETE /api/datasets/:id
GET    /api/datasets/:id/summary
GET    /api/datasets/:id/quality
GET    /api/datasets/:id/visualization
GET    /api/datasets/:id/download-clean
POST   /api/datasets/:id/clean/preview
POST   /api/datasets/:id/clean/apply

### Chat
GET    /api/chat/sessions
POST   /api/chat/sessions
GET    /api/chat/sessions/:id
POST   /api/chat/sessions/:id/messages
DELETE /api/chat/sessions/:id

### Insights / Reports / Team / Billing / Settings
GET    /api/insights/:datasetId
POST   /api/insights/:datasetId/regenerate
GET/POST/DELETE /api/reports
GET    /api/team
POST   /api/team/invite
PATCH  /api/team/members/:id
DELETE /api/team/members/:id
GET    /api/billing
POST   /api/billing/change-plan
GET    /api/settings
PATCH  /api/settings/profile
POST   /api/settings/change-password
DELETE /api/settings/account
GET    /api/dashboard/stats