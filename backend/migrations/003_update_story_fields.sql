-- Migration: Update story status options and notes format

-- First, update existing 'backlog' status to 'draft'
UPDATE stories SET status = 'draft' WHERE status = 'backlog';

-- Drop the old constraint
ALTER TABLE stories DROP CONSTRAINT IF EXISTS stories_status_check;

-- Add new status constraint with updated values
ALTER TABLE stories ADD CONSTRAINT stories_status_check
  CHECK (status IN ('draft', 'ready', 'in_progress', 'review', 'on_hold', 'done'));

-- Convert notes to JSONB format for journal entries
-- First, backup existing notes as the first journal entry
UPDATE stories
SET notes = jsonb_build_array(
  jsonb_build_object(
    'timestamp', created_at,
    'author', 'System',
    'content', COALESCE(notes, '')
  )
)::text
WHERE notes IS NOT NULL AND notes != '';

-- For empty or null notes, set to empty JSON array
UPDATE stories
SET notes = '[]'
WHERE notes IS NULL OR notes = '';

-- Add comment for documentation
COMMENT ON COLUMN stories.notes IS 'Journal entries in JSON format: [{timestamp, author, content}, ...]';

-- Convert acceptance_criteria to allow HTML (already TEXT type, just add comment)
COMMENT ON COLUMN stories.acceptance_criteria IS 'Acceptance criteria with HTML formatting support';
