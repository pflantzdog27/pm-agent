-- Migration: Add plan_metadata column to projects table to store timeline, meetings, and risks

ALTER TABLE projects ADD COLUMN IF NOT EXISTS plan_metadata JSONB;

COMMENT ON COLUMN projects.plan_metadata IS 'Stores generated plan metadata including timeline, meetings, and risks as JSON';
