-- Migration 006: Add Meetings Infrastructure (Phase 2 - Week 4)
-- Adds meetings and story_updates tables for meeting management and transcript processing

-- Meetings table
CREATE TABLE IF NOT EXISTS meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,

  -- Meeting details
  title VARCHAR(255) NOT NULL,
  meeting_type VARCHAR(100) NOT NULL, -- 'daily_scrum', 'weekly_status', 'design_review', 'uat', 'kickoff', 'retrospective', 'client_general'

  -- Scheduling
  scheduled_start TIMESTAMP NOT NULL,
  scheduled_end TIMESTAMP,
  actual_start TIMESTAMP,
  actual_end TIMESTAMP,

  -- Participants
  attendees JSONB, -- [{"name": "Adam", "email": "adam@...", "role": "Developer"}]

  -- Content
  agenda TEXT,
  meeting_notes TEXT, -- AI-generated summary (added in Week 5)

  -- Transcript
  transcript_text TEXT, -- The actual transcript
  transcript_source VARCHAR(50) DEFAULT 'manual', -- 'manual', 'zoom', 'uploaded_file'
  transcript_processed BOOLEAN DEFAULT FALSE, -- Will use in Week 5

  -- AI Analysis (populated in Week 5-6)
  key_decisions JSONB,
  action_items JSONB,
  sentiment_score DECIMAL,
  topics_discussed JSONB,

  status VARCHAR(50) DEFAULT 'scheduled', -- 'scheduled', 'completed', 'cancelled'

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  CONSTRAINT meetings_type_check CHECK (meeting_type IN (
    'daily_scrum', 'weekly_status', 'design_review', 'uat',
    'kickoff', 'retrospective', 'client_general'
  )),
  CONSTRAINT meetings_status_check CHECK (status IN ('scheduled', 'completed', 'cancelled'))
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_meetings_project_id ON meetings(project_id);
CREATE INDEX IF NOT EXISTS idx_meetings_scheduled_start ON meetings(scheduled_start);
CREATE INDEX IF NOT EXISTS idx_meetings_type ON meetings(meeting_type);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);

-- Story updates tracking (for Week 5)
CREATE TABLE IF NOT EXISTS story_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE,

  field_changed VARCHAR(100), -- 'status', 'assignee', 'description', 'story_points', etc.
  old_value TEXT,
  new_value TEXT,

  -- Context
  source VARCHAR(100), -- 'daily_scrum', 'manual_update', 'client_meeting', 'api'
  source_reference UUID, -- meeting_id or other reference
  update_notes TEXT,

  updated_by VARCHAR(255) DEFAULT 'Adam',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for story updates
CREATE INDEX IF NOT EXISTS idx_story_updates_story_id ON story_updates(story_id);
CREATE INDEX IF NOT EXISTS idx_story_updates_source ON story_updates(source);
CREATE INDEX IF NOT EXISTS idx_story_updates_created_at ON story_updates(created_at);

-- Add comments for documentation
COMMENT ON TABLE meetings IS 'Stores meeting records with transcripts and AI analysis';
COMMENT ON TABLE story_updates IS 'Tracks changes to stories from meetings or manual updates';
COMMENT ON COLUMN meetings.transcript_processed IS 'Set to true after AI processes transcript (Week 5)';
COMMENT ON COLUMN meetings.meeting_notes IS 'AI-generated summary from transcript (Week 5)';
