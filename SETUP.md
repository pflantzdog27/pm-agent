# PM Agent - Setup Guide

Complete setup instructions for the AI-powered project management system.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **PostgreSQL** 14+ ([Download](https://www.postgresql.org/download/))
- **npm** (comes with Node.js)

You'll also need API keys for:

- **Anthropic Claude API** ([Get API key](https://console.anthropic.com/))
- **Pinecone** (optional, for vector search) ([Get API key](https://www.pinecone.io/))
- **OpenAI** (optional, for embeddings) ([Get API key](https://platform.openai.com/))

## Step 1: Install Dependencies

### Backend
```bash
cd backend
npm install
```

### Frontend
```bash
cd frontend
npm install
```

## Step 2: Set Up PostgreSQL Database

### Create Database
```bash
# Connect to PostgreSQL
psql postgres

# Create database
CREATE DATABASE pm_agent_dev;

# Exit psql
\q
```

### Run Migrations
```bash
cd backend
psql pm_agent_dev < migrations/001_initial_schema.sql
```

You should see output confirming the tables were created successfully.

## Step 3: Configure Environment Variables

### Backend Environment

Create a `.env` file in the `backend` directory:

```bash
cd backend
cp ../.env.example .env
```

Edit `backend/.env` with your actual credentials:

```env
# Database
DATABASE_URL=postgresql://YOUR_USERNAME:YOUR_PASSWORD@localhost:5432/pm_agent_dev

# Anthropic Claude API (REQUIRED)
ANTHROPIC_API_KEY=sk-ant-your-api-key-here

# Pinecone Vector Database (OPTIONAL - for semantic search)
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_ENVIRONMENT=us-west1-gcp
PINECONE_INDEX_NAME=pm-agent-knowledge

# OpenAI (OPTIONAL - for embeddings)
OPENAI_API_KEY=sk-your-openai-api-key

# Server
NODE_ENV=development
PORT=3000
```

**Important Notes:**
- `ANTHROPIC_API_KEY` is **required** for AI planning to work
- `PINECONE_API_KEY` and `OPENAI_API_KEY` are **optional** - the system will work without them, but won't have vector search capabilities
- Replace `YOUR_USERNAME` and `YOUR_PASSWORD` with your PostgreSQL credentials

### Frontend Environment (Optional)

Create a `.env.local` file in the `frontend` directory if needed:

```bash
cd frontend
echo "NEXT_PUBLIC_API_URL=http://localhost:3000" > .env.local
```

## Step 4: Start the Application

You need two terminal windows/tabs:

### Terminal 1: Start Backend
```bash
cd backend
npm run dev
```

You should see:
```
✓ Database connected
✓ Anthropic API configured
═══════════════════════════════════════════
🚀 PM Agent API Server Running
📍 http://localhost:3000
💡 Health check: http://localhost:3000/health
📚 API docs: http://localhost:3000/
═══════════════════════════════════════════
```

### Terminal 2: Start Frontend
```bash
cd frontend
npm run dev
```

You should see:
```
▲ Next.js 14.x.x
- Local:        http://localhost:3001
```

## Step 5: Verify Installation

1. **Check Backend Health**: Open [http://localhost:3000/health](http://localhost:3000/health)
   - You should see JSON with `"status": "ok"` and service statuses

2. **Open Frontend**: Open [http://localhost:3001](http://localhost:3001)
   - You should see the PM Agent dashboard

## Step 6: Create Your First Project

### Using the UI

1. Navigate to [http://localhost:3001](http://localhost:3001)
2. Click **"New Project"**
3. Fill in project details:
   - Project Name: "Test Employee Center"
   - Client Name: "Test Company"
   - Project Type: "Employee Center"
   - Budget: 240 hours
4. Upload a test document (create a simple `.txt` file with project requirements)
5. Click **"Create Project"**
6. On the project page, click **"Generate AI Project Plan"**
7. Wait 30-60 seconds for Claude to analyze and generate the plan
8. View the generated stories and sprints!

### Sample Test Document

Create a file called `test-sow.txt` with this content:

```
PROJECT: Employee Center Implementation for Test Corp
DURATION: 12 weeks
BUDGET: 240 hours

SCOPE:
- Design and implement modern Employee Center
- Build 3 custom workspaces:
  * IT Service Request
  * HR Services
  * Knowledge Base
- Implement Virtual Agent for common questions
- Mobile responsive design
- Integration with existing SSO
- User training and documentation

DELIVERABLES:
- Wireframes and mockups (Week 2)
- Development environment setup (Week 3)
- Core workspace development (Weeks 4-8)
- Virtual Agent implementation (Weeks 9-10)
- User acceptance testing (Week 11)
- Go-live and support (Week 12)
```

## Troubleshooting

### Database Connection Fails

**Error**: `Failed to connect to database`

**Solutions**:
1. Make sure PostgreSQL is running: `psql postgres`
2. Check your `DATABASE_URL` in `.env`
3. Verify database exists: `psql -l | grep pm_agent`
4. Test connection: `psql pm_agent_dev`

### Anthropic API Error

**Error**: `ANTHROPIC_API_KEY not set`

**Solutions**:
1. Get API key from [https://console.anthropic.com/](https://console.anthropic.com/)
2. Add to `backend/.env`: `ANTHROPIC_API_KEY=sk-ant-...`
3. Restart backend server

### Port Already in Use

**Error**: `Port 3000 is already in use`

**Solutions**:
1. Change port in `backend/.env`: `PORT=3001`
2. Or stop the other process using port 3000

### Document Upload Fails

**Error**: `Failed to process document`

**Solutions**:
1. Check file type is supported (PDF, DOCX, TXT, MD)
2. Check file size is under 10MB
3. Check `backend/uploads/` directory exists and is writable
4. Check backend logs for detailed error

## API Testing

You can also test the API directly using curl:

### Create Project
```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Project",
    "client_name": "Test Client",
    "project_type": "Employee Center",
    "budget_hours": 240
  }'
```

### Generate Plan
```bash
# First upload a document, then:
curl -X POST http://localhost:3000/api/projects/{PROJECT_ID}/generate-plan
```

### Get Plan
```bash
curl http://localhost:3000/api/projects/{PROJECT_ID}/plan
```

## Next Steps

Once you have the basic system working:

1. **Customize the Planning Prompt**: Edit `backend/src/config/anthropic.ts` to adjust how Claude generates plans

2. **Add Past Projects**: Upload past project documents to improve future planning with relevant context

3. **Configure Pinecone** (optional): Set up vector search for semantic knowledge retrieval

4. **Deploy to Production**: See deployment guide (coming soon)

## Need Help?

- Check the logs in both terminal windows for detailed error messages
- Review the API documentation at [http://localhost:3000/](http://localhost:3000/)
- Make sure all prerequisites are installed and running

## Development Tips

### Reset Database
```bash
psql pm_agent_dev < backend/migrations/001_initial_schema.sql
```

### View Backend Logs
Backend logs appear in the terminal where you ran `npm run dev`

### Build for Production
```bash
# Backend
cd backend
npm run build
npm start

# Frontend
cd frontend
npm run build
npm start
```

## Success Criteria

You'll know everything is working when:

1. ✅ Backend health check shows all services connected
2. ✅ Frontend dashboard loads and shows empty state
3. ✅ You can create a new project
4. ✅ You can upload documents
5. ✅ You can generate an AI project plan
6. ✅ Plan shows stories organized into sprints
7. ✅ Story details include points, priorities, and acceptance criteria

**Congratulations!** You now have a fully functional AI-powered project management system.
