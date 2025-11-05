# AI-Powered Project Management System

An intelligent project management system for ServiceNow consulting that uses Claude AI to generate comprehensive project plans from documents.

## Phase 1 Features

- Upload project documents (SOW, requirements, past projects)
- AI-powered analysis and requirement extraction using Claude Sonnet 4.5
- Automatic generation of user stories, sprints, and timelines
- PostgreSQL database for structured data
- Vector database (Pinecone) for semantic search
- Web dashboard to view and manage project plans

## Tech Stack

**Backend:**
- Node.js with Express
- PostgreSQL (structured data)
- Pinecone (vector embeddings)
- Anthropic Claude API

**Frontend:**
- Next.js with React
- TailwindCSS
- TypeScript

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Pinecone account
- Anthropic API key

### Setup

1. Clone and install dependencies:
```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your actual credentials
```

3. Create and migrate database:
```bash
createdb pm_agent_dev
psql pm_agent_dev < backend/migrations/001_initial_schema.sql
```

4. Run the application:
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

5. Open http://localhost:3001 in your browser

## Project Structure

```
pm-application/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Express server
│   │   ├── config/               # Configuration files
│   │   ├── services/             # Business logic
│   │   ├── routes/               # API endpoints
│   │   └── types/                # TypeScript types
│   └── migrations/               # Database migrations
├── frontend/
│   ├── app/                      # Next.js app directory
│   └── components/               # React components
└── .env.example                  # Environment variables template
```

## Core Workflow

1. **Upload Documents** → Extract text from PDF/DOCX/TXT files
2. **Generate Embeddings** → Create vector embeddings for semantic search
3. **AI Planning** → Claude analyzes context and generates comprehensive project plan
4. **Store & Display** → Save to PostgreSQL and display in dashboard
5. **Manage** → Edit stories, adjust sprints, track progress

## API Endpoints

- `POST /api/projects` - Create new project
- `POST /api/projects/:id/documents` - Upload documents
- `POST /api/projects/:id/generate-plan` - Generate AI project plan
- `GET /api/projects/:id/plan` - Get project plan
- `PUT /api/stories/:id` - Update story
- `GET /api/projects` - List all projects

## License

Private - Adam Pflantzer ServiceNow Consulting
