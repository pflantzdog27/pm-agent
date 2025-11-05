-- Migration: Change priority from integer to text with Critical/High/Medium/Low values

-- Add a temporary column
ALTER TABLE stories ADD COLUMN priority_text VARCHAR(20);

-- Convert existing numeric priorities to text labels
-- Assuming 1-2 = Critical, 3-4 = High, 5-6 = Medium, 7+ = Low
UPDATE stories
SET priority_text = CASE
  WHEN priority <= 2 THEN 'Critical'
  WHEN priority <= 4 THEN 'High'
  WHEN priority <= 6 THEN 'Medium'
  ELSE 'Low'
END;

-- Drop the old integer column
ALTER TABLE stories DROP COLUMN priority;

-- Rename the new column
ALTER TABLE stories RENAME COLUMN priority_text TO priority;

-- Add constraint
ALTER TABLE stories ADD CONSTRAINT stories_priority_check
  CHECK (priority IN ('Critical', 'High', 'Medium', 'Low'));

-- Set default
ALTER TABLE stories ALTER COLUMN priority SET DEFAULT 'Medium';

COMMENT ON COLUMN stories.priority IS 'Story priority: Critical, High, Medium, or Low';
