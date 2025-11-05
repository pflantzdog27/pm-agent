-- Migration: Add assigned_to, assignment_group, and notes fields to stories table

-- Add new columns to stories table
ALTER TABLE stories
  ADD COLUMN IF NOT EXISTS assigned_to VARCHAR(255),
  ADD COLUMN IF NOT EXISTS assignment_group VARCHAR(255),
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add comments for documentation
COMMENT ON COLUMN stories.assigned_to IS 'User or person assigned to this story';
COMMENT ON COLUMN stories.assignment_group IS 'Team or group responsible for this story';
COMMENT ON COLUMN stories.notes IS 'Additional notes and comments about the story';
