-- Migration 008: Add Risks/Blockers Table (Phase 2 - Week 5)
-- Adds risks table for tracking blockers identified from daily scrums and other sources

-- Risks/Blockers table
CREATE TABLE IF NOT EXISTS risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  story_id UUID REFERENCES stories(id) ON DELETE SET NULL, -- Can be null for project-level risks

  -- Risk details
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  severity VARCHAR(50) DEFAULT 'medium', -- 'critical', 'high', 'medium', 'low'
  risk_type VARCHAR(100) DEFAULT 'blocker', -- 'blocker', 'dependency', 'technical', 'resource', 'scope'

  -- Context
  source VARCHAR(100), -- 'daily_scrum', 'manual', 'ai_detected', 'client_meeting'
  source_reference UUID, -- meeting_id or other reference

  -- Resolution tracking
  status VARCHAR(50) DEFAULT 'open', -- 'open', 'in_progress', 'resolved', 'mitigated'
  blocked_since TIMESTAMP,
  resolved_at TIMESTAMP,

  -- Stakeholders and impact
  stakeholders JSONB, -- ["client IT team", "Adam", "ServiceNow admin"]
  needs_meeting BOOLEAN DEFAULT FALSE,
  estimated_delay_days INTEGER, -- Impact on timeline

  -- Notes
  resolution_notes TEXT,

  created_by VARCHAR(255) DEFAULT 'AI Agent',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  CONSTRAINT risks_severity_check CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  CONSTRAINT risks_status_check CHECK (status IN ('open', 'in_progress', 'resolved', 'mitigated'))
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_risks_project_id ON risks(project_id);
CREATE INDEX IF NOT EXISTS idx_risks_story_id ON risks(story_id);
CREATE INDEX IF NOT EXISTS idx_risks_severity ON risks(severity);
CREATE INDEX IF NOT EXISTS idx_risks_status ON risks(status);
CREATE INDEX IF NOT EXISTS idx_risks_created_at ON risks(created_at);

-- Add trigger for updated_at
CREATE TRIGGER update_risks_updated_at
  BEFORE UPDATE ON risks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE risks IS 'Tracks project risks and blockers identified from meetings or manual entry';
COMMENT ON COLUMN risks.needs_meeting IS 'True if this blocker requires a meeting to resolve';
COMMENT ON COLUMN risks.estimated_delay_days IS 'Estimated impact on project timeline in days';
