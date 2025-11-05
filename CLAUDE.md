# PM Agent - Development Guide for Claude

This document helps Claude Code (or other developers) understand and work with the PM Agent codebase effectively.

## Project Overview

PM Agent is an AI-powered project management system for ServiceNow consulting. It uses Claude AI to analyze project documents and generate comprehensive project plans with user stories, sprints, and timelines.

**Core Workflow (Phase 1):**
1. User uploads project documents (SOW, requirements)
2. System extracts text and generates embeddings
3. Claude AI analyzes documents and generates structured project plan
4. Stories and sprints are saved to PostgreSQL
5. User views and manages plan in web interface

**Phase 2 - Meeting Management & AI Processing:**
6. User creates meetings and uploads transcripts (manual or file)
7. System stores meeting records with attendees and agendas
8. AI Execution Agent processes daily scrum transcripts (Week 5)
9. Automatic story status updates and blocker detection
10. Timeline impact analysis and recommendations
11. User views meeting history, analysis, and applied updates

## Architecture

### Backend (Node.js + Express + TypeScript)
```
backend/src/
├── config/           # Configuration and API clients
│   ├── database.ts   # PostgreSQL connection and query helpers
│   ├── anthropic.ts  # Claude API client and prompts
│   └── pinecone.ts   # Vector database client
├── services/         # Business logic
│   ├── documentProcessor.ts  # Extract text from files
│   ├── embeddingService.ts   # Generate and store embeddings
│   ├── planningAgent.ts      # Core AI planning logic
│   ├── executionAgent.ts     # AI daily scrum analysis (Week 5)
│   └── vectorStore.ts        # Vector search operations
├── routes/           # API endpoints
│   ├── projects.ts   # Project CRUD
│   ├── documents.ts  # Document upload and management
│   ├── planning.ts   # Plan generation and retrieval
│   └── meetings.ts   # Meeting management and transcripts (Phase 2)
├── utils/            # Utility functions
│   └── caseConverter.ts      # camelCase ↔ snake_case conversion
├── types/            # TypeScript type definitions
│   └── index.ts
└── index.ts          # Express server entry point
```

### Frontend (Next.js 14 + React + TypeScript)
```
frontend/
├── app/
│   ├── page.tsx                    # Dashboard (project list)
│   ├── projects/
│   │   ├── new/page.tsx           # Create project + upload docs
│   │   └── [id]/
│   │       ├── page.tsx           # Project detail + plan view
│   │       └── meetings/
│   │           ├── page.tsx       # Meetings list (Phase 2)
│   │           └── new/page.tsx   # Create meeting (Phase 2)
│   ├── meetings/
│   │   └── [id]/page.tsx          # Meeting detail + transcript (Phase 2)
│   ├── layout.tsx                  # Root layout with header/footer
│   └── globals.css                 # Tailwind styles
└── components/                     # Reusable components
    ├── StoryModal.tsx              # Story detail modal
    ├── MeetingTypeSelect.tsx       # Meeting type dropdown (Phase 2)
    ├── MeetingsList.tsx            # Meetings table view (Phase 2)
    ├── TranscriptUpload.tsx        # Transcript upload form (Phase 2)
    └── MeetingAnalysis.tsx         # AI analysis display (Week 5)
```

### Database (PostgreSQL)
```
Tables:
- projects          # Core project metadata
- stories           # User stories with points, priority, etc.
- sprints           # Sprint definitions and dates
- documents         # Uploaded documents and extracted text
- knowledge_embeddings  # Vector embeddings for semantic search
- meetings          # Meeting records with transcripts (Phase 2)
- story_updates     # Story change tracking from meetings (Phase 2)
- risks             # Blockers and risks detected by AI (Week 5)
```

## Key Files and Their Purpose

### 🧠 Core AI Logic

**`backend/src/services/planningAgent.ts`**
- The "brain" of the system
- `generateProjectPlan()` - Main function that calls Claude
- `buildPlanningPrompt()` - Constructs the detailed prompt for Claude
- `validateGeneratedPlan()` - Ensures plan structure is correct

**Key Concepts:**
- Takes project context (documents, metadata)
- Sends comprehensive prompt to Claude
- Parses JSON response into structured data
- Validates and returns GeneratedPlan object

**To modify planning behavior:**
1. Edit the prompt template in `buildPlanningPrompt()`
2. Adjust `PLANNING_SYSTEM_PROMPT` in `backend/src/config/anthropic.ts`
3. Change story point scale, sprint duration, or output format

### 📄 Document Processing

**`backend/src/services/documentProcessor.ts`**
- Extracts text from PDF, DOCX, TXT files
- `processDocument()` - Main entry point
- `chunkText()` - Splits text for embeddings

**Supported formats:** PDF, DOCX, DOC, TXT, MD

**To add new file types:**
1. Add extraction function (e.g., `extractXLSX()`)
2. Add case in `processDocument()` switch statement
3. Update file filter in `backend/src/routes/documents.ts`

### 🤖 Execution Agent (Phase 2 - Week 5)

**`backend/src/services/executionAgent.ts`**
- The "intelligence" for daily scrum analysis
- `analyzeDailyScrum()` - Main function that calls Claude
- `buildDailyScrumPrompt()` - Constructs context-aware prompt
- `validateAnalysis()` - Ensures response structure is correct

**Key Concepts:**
- Takes meeting transcript and current sprint context
- Sends comprehensive prompt to Claude with story list
- Parses JSON response into DailyScrumAnalysis object
- Extracts 4 key insights:
  1. **Story Updates**: Status changes (draft → in_progress → done)
  2. **Blockers**: Issues preventing progress with severity assessment
  3. **New Work**: Scope creep or new requirements mentioned
  4. **Timeline Impact**: Sprint health and delay estimates

**Intelligence Features:**
- Smart story matching by ID or description
- Confidence scoring (high/medium/low) for uncertain matches
- Dependency tracking (identifies cascading impacts)
- Stakeholder identification for blockers
- Actionable recommendations

**To modify analysis behavior:**
1. Edit the prompt template in `buildDailyScrumPrompt()`
2. Adjust severity thresholds for blockers
3. Change confidence scoring logic
4. Add new analysis categories (e.g., velocity tracking)

**Example Output:**
```json
{
  "storyUpdates": [
    {
      "storyKey": "STORY-007",
      "oldStatus": "draft",
      "newStatus": "done",
      "confidence": "high",
      "notes": "Completed and client approved"
    }
  ],
  "blockers": [
    {
      "storyKey": "STORY-012",
      "description": "Waiting for client SSO config",
      "severity": "critical",
      "needsMeeting": true,
      "stakeholders": ["client IT team", "Adam"]
    }
  ],
  "timelineAssessment": {
    "sprintOnTrack": false,
    "estimatedDelay": 2,
    "recommendation": "Schedule urgent SSO meeting"
  }
}
```

### 🔌 API Endpoints

**`backend/src/routes/planning.ts`**
- `POST /api/projects/:projectId/generate-plan` - Generate AI plan
- `GET /api/projects/:projectId/plan` - Get current plan
- `PUT /api/stories/:storyId` - Update story
- `PUT /api/sprints/:sprintId` - Update sprint

**Key Implementation Details:**
- Plan generation uses database transaction (backend/src/routes/planning.ts:17)
- Deletes existing stories/sprints before creating new ones
- Creates sprints first, then stories (foreign key dependency)
- Maps story IDs to sprint IDs during creation

### 🎨 Frontend Pages

**`frontend/app/projects/[id]/page.tsx`**
- Shows project details and generated plan
- "Generate Plan" button triggers AI generation
- Displays sprints with nested stories
- Real-time loading states

**State Management:**
- Uses React hooks (useState, useEffect)
- Fetches data on mount
- Polls or refetches after plan generation

### 📅 Meeting Management (Phase 2)

**`backend/src/routes/meetings.ts`**
- `POST /api/projects/:projectId/meetings` - Create meeting
- `POST /api/meetings/:meetingId/transcript` - Upload transcript
- `POST /api/meetings/:meetingId/process` - Process transcript with AI (Week 5)
- `PATCH /api/meetings/:meetingId` - Update meeting details
- `GET /api/projects/:projectId/meetings` - List meetings with filters
- `GET /api/meetings/:meetingId` - Get meeting details
- `DELETE /api/meetings/:meetingId` - Delete meeting

**Meeting Types:**
- `daily_scrum` - Daily standup meetings
- `weekly_status` - Weekly status calls with client
- `design_review` - Review designs/wireframes
- `uat` - User acceptance testing sessions
- `kickoff` - Project or sprint kickoffs
- `retrospective` - Team retrospectives
- `client_general` - General client meetings

**Key Implementation Details:**
- Transcript upload supports manual paste or .txt file upload
- Minimum 50 characters required for transcripts
- Meeting status: scheduled, completed, cancelled
- Transcript source tracking: manual, uploaded_file, zoom
- JSONB fields for attendees, AI analysis results
- Ready for AI processing in Week 5

**Frontend Components:**
- `MeetingTypeSelect.tsx` - Dropdown with meeting types and descriptions
- `MeetingsList.tsx` - Filterable table view with status badges
- `TranscriptUpload.tsx` - Dual-mode upload (paste or file)

**Frontend Pages:**
- `/projects/[id]/meetings` - Meetings list with stats
- `/projects/[id]/meetings/new` - Create meeting form
- `/meetings/[id]` - Meeting detail + transcript upload

## Common Development Tasks

### 1. Modify the AI Planning Prompt

**Location:** `backend/src/services/planningAgent.ts` (buildPlanningPrompt function)

**Example - Add custom field to stories:**
```typescript
// In buildPlanningPrompt(), update the JSON schema example:
{
  "stories": [
    {
      "id": "STORY-001",
      "title": "string",
      "customField": "your new field",  // Add here
      // ... rest of fields
    }
  ]
}
```

**Then update:**
1. `backend/src/types/index.ts` - Add to GeneratedStory interface
2. `backend/src/routes/planning.ts` - Add to INSERT query
3. `backend/migrations/001_initial_schema.sql` - Add column to stories table
4. Frontend components to display new field

### 2. Change Sprint Duration

**Location:** `backend/src/services/planningAgent.ts`

Update the prompt text:
```typescript
// Change "2-week sprints" to desired duration
"2. SPRINT PLAN: Organize stories into 2-week sprints"
```

**Also update:**
- Default in database schema: `sprint_length_weeks INTEGER DEFAULT 2`
- Frontend form in project creation

### 3. Add New Document Type (e.g., Excel)

**Step 1:** Install parser
```bash
cd backend
npm install xlsx
```

**Step 2:** Add extraction function in `documentProcessor.ts`
```typescript
import * as XLSX from 'xlsx';

async function extractXLSX(filePath: string): Promise<string> {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_txt(sheet);
}
```

**Step 3:** Add to switch statement
```typescript
case '.xlsx':
case '.xls':
  content = await extractXLSX(filePath);
  type = 'excel';
  break;
```

**Step 4:** Update file upload validation
- `backend/src/routes/documents.ts` - Add to allowedTypes
- `frontend/app/projects/new/page.tsx` - Add to accept attribute

### 4. Customize Story Point Scale

**Location:** `backend/src/services/planningAgent.ts` (buildPlanningPrompt)

Change from Fibonacci to Linear:
```typescript
// Before:
"- Story points (1, 2, 3, 5, 8, 13, 21) - use Fibonacci sequence"

// After:
"- Story points (1, 2, 3, 4, 5) - use linear scale 1-5"
```

### 5. Add Story Status Workflow

**Current statuses:** backlog, ready, in_progress, review, done

**To add new status:**

**Step 1:** Update database enum/check
```sql
-- In migration file
ALTER TABLE stories DROP CONSTRAINT IF EXISTS stories_status_check;
ALTER TABLE stories ADD CONSTRAINT stories_status_check
  CHECK (status IN ('backlog', 'ready', 'in_progress', 'review', 'testing', 'done'));
```

**Step 2:** Update TypeScript types
```typescript
// backend/src/types/index.ts
status: 'backlog' | 'ready' | 'in_progress' | 'review' | 'testing' | 'done';
```

**Step 3:** Update frontend color mapping
```typescript
// frontend/app/projects/[id]/page.tsx
const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    testing: 'bg-orange-100 text-orange-800',  // Add here
    // ... other statuses
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
};
```

### 6. Add New API Endpoint

**Example:** Add endpoint to get project risks

**Step 1:** Create route handler
```typescript
// backend/src/routes/planning.ts
router.get('/:projectId/risks', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    // Fetch risks from database or generate from AI
    res.json({ success: true, risks });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

**Step 2:** Add to API documentation in `backend/src/index.ts`

**Step 3:** Create frontend hook/service
```typescript
// frontend - in page.tsx
const fetchRisks = async () => {
  const response = await fetch(`${API_URL}/api/projects/${projectId}/risks`);
  const data = await response.json();
  return data.risks;
};
```

## Database Operations

### Running Migrations
```bash
psql pm_agent_dev < backend/migrations/001_initial_schema.sql
```

### Adding New Migration
Create `backend/migrations/002_your_change.sql`:
```sql
-- Add new column
ALTER TABLE stories ADD COLUMN estimated_hours DECIMAL;

-- Create index
CREATE INDEX idx_stories_estimated_hours ON stories(estimated_hours);
```

### Common Queries
```sql
-- Get all stories for a project with sprint info
SELECT s.*, sp.name as sprint_name
FROM stories s
LEFT JOIN sprints sp ON s.sprint_id = sp.id
WHERE s.project_id = 'PROJECT_UUID'
ORDER BY sp.sprint_number, s.priority;

-- Get project statistics
SELECT
  COUNT(*) as total_stories,
  SUM(story_points) as total_points,
  COUNT(*) FILTER (WHERE status = 'done') as completed_stories
FROM stories
WHERE project_id = 'PROJECT_UUID';
```

## Testing

### Manual API Testing

**Create Project:**
```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Project",
    "client_name": "Test Client",
    "project_type": "Employee Center"
  }'
```

**Upload Document:**
```bash
curl -X POST http://localhost:3000/api/projects/{PROJECT_ID}/documents \
  -F "file=@test-sow.txt" \
  -F "document_type=sow"
```

**Generate Plan:**
```bash
curl -X POST http://localhost:3000/api/projects/{PROJECT_ID}/generate-plan
```

**Create Meeting (Phase 2):**
```bash
curl -X POST http://localhost:3000/api/projects/{PROJECT_ID}/meetings \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Daily Standup - Sprint 3 Day 5",
    "meetingType": "daily_scrum",
    "scheduledStart": "2024-11-05T09:00:00Z",
    "attendees": [{"name": "Adam", "role": "Developer"}],
    "agenda": "Sprint progress update"
  }'
```

**Upload Transcript:**
```bash
curl -X POST http://localhost:3000/api/meetings/{MEETING_ID}/transcript \
  -H "Content-Type: application/json" \
  -d '{
    "transcriptText": "Adam: Yesterday I completed STORY-12...",
    "transcriptSource": "manual"
  }'
```

**List Meetings:**
```bash
curl http://localhost:3000/api/projects/{PROJECT_ID}/meetings
```

### Testing Claude Prompt Changes

**Quick iteration workflow:**
1. Edit prompt in `planningAgent.ts`
2. Restart backend: `npm run dev`
3. Generate plan via API or UI
4. Review generated stories/sprints
5. Adjust prompt based on results

**Prompt testing tips:**
- Be very specific about output format
- Use examples in the prompt
- Specify constraints (e.g., "no more than 30 points per sprint")
- Request thinking/reasoning in JSON response for debugging

## Environment Variables

### Required
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/pm_agent_dev
ANTHROPIC_API_KEY=sk-ant-...  # Required for AI planning
```

### Optional (for vector search)
```env
PINECONE_API_KEY=...
PINECONE_INDEX_NAME=pm-agent-knowledge
OPENAI_API_KEY=sk-...
```

### Development vs Production
- Development: Uses local PostgreSQL, verbose logging
- Production: Should use connection pooling, error tracking, SSL

## Debugging Tips

### Backend Issues

**Problem:** Claude returns invalid JSON
- Check logs for raw response
- Look for markdown code blocks (```json)
- Verify `parseClaudeJSON()` is handling it (backend/src/config/anthropic.ts:62)

**Problem:** Database connection fails
- Check `DATABASE_URL` format
- Verify PostgreSQL is running: `psql postgres`
- Test connection: visit http://localhost:3000/health

**Problem:** Document upload fails
- Check file type is supported
- Verify `uploads/` directory exists
- Check file size (10MB limit)
- Review logs for extraction errors

### Frontend Issues

**Problem:** API calls fail
- Check `NEXT_PUBLIC_API_URL` in .env.local
- Verify backend is running
- Check CORS settings in backend
- Open browser console for errors

**Problem:** Plan doesn't display
- Check browser console for errors
- Verify API response structure
- Check if `hasPlan` state is set correctly

### AI Planning Issues

**Problem:** Stories are too generic
- Add more detail to prompt about ServiceNow specifics
- Include examples of good stories in prompt
- Increase context by uploading more detailed documents

**Problem:** Sprint balancing is off
- Adjust target points per sprint in prompt
- Add explicit balancing instructions
- Consider adding sprint capacity as project metadata

## Performance Optimization

### Current Performance Characteristics
- Plan generation: 30-60 seconds (Claude API call)
- Document upload: 1-5 seconds per file
- Database queries: <100ms for most operations

### Optimization Opportunities
1. **Cache Claude responses** - Store plans and reuse for similar projects
2. **Background job queue** - Move plan generation to background workers
3. **Batch embedding generation** - Generate embeddings in parallel
4. **Database indexing** - Add indexes on frequently queried columns
5. **Frontend pagination** - Paginate large lists of stories

## Security Considerations

### Current Implementation
- No authentication/authorization (MVP)
- API keys in environment variables
- File upload size limits (10MB)
- SQL injection protection via parameterized queries

### Production Requirements
1. Add user authentication (JWT, OAuth)
2. Implement role-based access control
3. Add rate limiting on API endpoints
4. Validate and sanitize all inputs
5. Use HTTPS in production
6. Implement CSRF protection
7. Add API request logging and monitoring

## Deployment

### Backend Deployment
```bash
cd backend
npm run build
npm start
```

### Frontend Deployment
```bash
cd frontend
npm run build
npm start
```

### Environment Setup
- Set `NODE_ENV=production`
- Use production database URL
- Configure proper logging
- Set up error tracking (Sentry, etc.)
- Use environment-specific API keys

## Future Enhancements (Phase 2+)

### Phase 2: Meeting Integration
- Add Zoom API integration
- Transcribe meeting recordings
- Extract action items and story updates
- Auto-update story status from meeting notes

### Phase 3: Email Integration
- Connect to Gmail/Outlook
- Parse client emails for requirements
- Generate stories from email threads
- Track client communications

### Phase 4: Daily Updates
- Process daily scrum notes
- Update story progress automatically
- Generate sprint reports
- Detect blockers and risks

### Phase 5: Analytics
- Story velocity tracking
- Sprint burn-down charts
- Risk prediction
- Budget vs actual tracking

## Code Style and Conventions

### TypeScript
- Use explicit types, avoid `any` when possible
- Define interfaces in `types/index.ts`
- Use async/await over promises
- Handle errors explicitly with try/catch

### React/Next.js
- Use functional components with hooks
- Keep components focused and small
- Use TypeScript for props
- Handle loading and error states

### Database
- Use transactions for multi-step operations
- Always use parameterized queries
- Add indexes for foreign keys
- Include updated_at timestamps

### API Design
- RESTful endpoints
- Consistent response format: `{ success: boolean, data?, error? }`
- Use proper HTTP status codes
- Include pagination for list endpoints

## Getting Help

### Useful Commands
```bash
# View backend logs
cd backend && npm run dev

# Check database
psql pm_agent_dev -c "SELECT COUNT(*) FROM projects;"

# Test API health
curl http://localhost:3000/health

# Check Claude API
curl http://localhost:3000/api/projects
```

### Common Error Messages

**"Project not found"**
- Check project ID is correct UUID
- Verify project exists in database

**"No documents found for this project"**
- Upload documents before generating plan
- Check documents table: `SELECT * FROM documents WHERE project_id = '...'`

**"Failed to generate project plan"**
- Check Anthropic API key is set
- Review backend logs for detailed error
- Verify Claude API is accessible

**"Transcript must be at least 50 characters" (Phase 2)**
- Ensure transcript text is substantial
- Cannot upload empty or very short transcripts
- Paste or upload more content

**"Meeting not found" (Phase 2)**
- Check meeting ID is correct UUID
- Verify meeting exists: `SELECT * FROM meetings WHERE id = '...'`

## Quick Reference

### Important Function Locations

| Function | File | Line |
|----------|------|------|
| Generate plan | `backend/src/services/planningAgent.ts` | generateProjectPlan() |
| Build prompt | `backend/src/services/planningAgent.ts` | buildPlanningPrompt() |
| Analyze daily scrum | `backend/src/services/executionAgent.ts` | analyzeDailyScrum() |
| Process document | `backend/src/services/documentProcessor.ts` | processDocument() |
| Upload document | `backend/src/routes/documents.ts` | POST /:projectId/documents |
| Create project | `backend/src/routes/projects.ts` | POST / |
| Create meeting | `backend/src/routes/meetings.ts` | POST /:projectId/meetings |
| Upload transcript | `backend/src/routes/meetings.ts` | POST /:meetingId/transcript |
| Process meeting AI | `backend/src/routes/meetings.ts` | POST /:meetingId/process |
| Database query | `backend/src/config/database.ts` | query() |
| Call Claude | `backend/src/config/anthropic.ts` | callClaude() |

### File Upload Flow
1. User selects files in `frontend/app/projects/new/page.tsx`
2. Files sent to `POST /api/projects/:projectId/documents/bulk`
3. Multer saves to `backend/uploads/`
4. `documentProcessor.processDocument()` extracts text
5. Document saved to database
6. `embeddingService.embedDocument()` generates embeddings (async)

### Plan Generation Flow
1. User clicks "Generate Plan" in `frontend/app/projects/[id]/page.tsx`
2. Frontend calls `POST /api/projects/:projectId/generate-plan`
3. Backend fetches project and documents
4. `planningAgent.generateProjectPlan()` builds prompt
5. Claude API called with comprehensive context
6. Response parsed and validated
7. Stories and sprints saved in transaction
8. Frontend displays generated plan

### Meeting & Transcript Upload Flow (Phase 2)
1. User clicks "Meetings" in `frontend/app/projects/[id]/page.tsx`
2. Navigates to meetings list view
3. Clicks "New Meeting" → `frontend/app/projects/[id]/meetings/new/page.tsx`
4. Fills in meeting details (title, type, date, attendees, agenda)
5. Frontend calls `POST /api/projects/:projectId/meetings`
6. Meeting created and user redirected to meeting detail
7. User uploads transcript via paste or .txt file
8. `TranscriptUpload.tsx` component validates (50 char minimum)
9. Frontend calls `POST /api/meetings/:meetingId/transcript`
10. Transcript saved, meeting status updated to "completed"
11. User clicks "Process with AI" button on meeting detail page

### AI Transcript Processing Flow (Week 5)
1. User clicks "Process with AI" button on meeting detail page
2. Frontend calls `POST /api/meetings/:meetingId/process` with `autoApply: true`
3. Backend fetches meeting transcript and current sprint context
4. Backend queries active sprint and stories in that sprint
5. `executionAgent.analyzeDailyScrum()` called with transcript and context
6. Claude AI analyzes transcript for:
   - Story status updates (completed, in progress, blocked)
   - Blockers and risks with severity assessment
   - New work/scope changes mentioned
   - Timeline impact and recommendations
7. AI response validated and parsed into DailyScrumAnalysis
8. If `autoApply: true`:
   - Story statuses updated in database
   - Story update records created in `story_updates` table
   - Blocker records created in `risks` table
   - New work items flagged in analysis
9. Analysis stored in meeting's `key_decisions` JSONB field
10. Meeting marked as `transcript_processed = true`
11. Frontend displays comprehensive AI analysis using `MeetingAnalysis.tsx`
12. User sees:
    - ✅ Story updates with before/after status
    - ⚠️ Blockers identified with severity badges
    - 🆕 New work mentioned for review
    - 📊 Timeline assessment with recommendations

**Example Results:**
- 3 stories automatically updated (STORY-007 → done, STORY-008 → in_progress, STORY-015 → ready)
- 1 critical blocker created (SSO config waiting on client IT for 3 days)
- 1 new work item flagged (mobile push notifications - 8 points)
- Sprint marked as not on track with 2-day delay estimate
- Actionable recommendation: "Schedule urgent meeting with client IT team"

---

**Last Updated:** November 2024
**Version:** 2.1.0 (Phase 2 - Week 5 Complete: AI Daily Scrum Intelligence)
