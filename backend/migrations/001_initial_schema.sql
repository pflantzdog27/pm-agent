-- PM Agent Initial Schema
-- Core tables for Phase 1: Projects, Stories, Sprints, Documents, Knowledge Embeddings

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Projects table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  client_name VARCHAR(255) NOT NULL,
  client_email VARCHAR(255),
  project_type VARCHAR(100),
  status VARCHAR(50) DEFAULT 'planning',
  start_date DATE,
  target_end_date DATE,
  budget_hours DECIMAL,
  sprint_length_weeks INTEGER DEFAULT 2,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Sprints table (must come before stories for foreign key)
CREATE TABLE sprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  sprint_number INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  sprint_goal TEXT,
  status VARCHAR(50) DEFAULT 'planned',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Stories table
CREATE TABLE stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  story_key VARCHAR(50) UNIQUE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  acceptance_criteria TEXT,
  story_points INTEGER,
  priority INTEGER DEFAULT 3,
  story_type VARCHAR(50) DEFAULT 'feature',
  status VARCHAR(50) DEFAULT 'backlog',
  sprint_id UUID REFERENCES sprints(id) ON DELETE SET NULL,
  source VARCHAR(100),
  estimated_hours DECIMAL,
  dependencies JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Documents table
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  document_type VARCHAR(100),
  file_path TEXT,
  content_text TEXT,
  content_summary TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Knowledge embeddings table
CREATE TABLE knowledge_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_type VARCHAR(100),
  source_id UUID,
  content_chunk TEXT,
  chunk_index INTEGER,
  embedding_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_stories_project_id ON stories(project_id);
CREATE INDEX idx_stories_sprint_id ON stories(sprint_id);
CREATE INDEX idx_stories_status ON stories(status);
CREATE INDEX idx_sprints_project_id ON sprints(project_id);
CREATE INDEX idx_documents_project_id ON documents(project_id);
CREATE INDEX idx_knowledge_embeddings_project_id ON knowledge_embeddings(project_id);
CREATE INDEX idx_knowledge_embeddings_source ON knowledge_embeddings(source_type, source_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stories_updated_at
  BEFORE UPDATE ON stories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for testing (optional)
-- Uncomment to add a test project
/*
INSERT INTO projects (name, client_name, client_email, project_type, status, budget_hours)
VALUES ('Test Employee Center', 'Test Corp', 'test@example.com', 'Employee Center', 'planning', 240);
*/
