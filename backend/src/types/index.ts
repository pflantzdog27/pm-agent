// Core domain types for PM Agent

export interface JournalEntry {
  timestamp: Date | string;
  author: string;
  content: string;
}

export interface Project {
  id: string;
  name: string;
  client_name: string;
  client_email?: string;
  project_type?: string;
  status: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
  start_date?: Date;
  target_end_date?: Date;
  budget_hours?: number;
  sprint_length_weeks: number;
  plan_metadata?: any; // JSONB field storing timeline, meetings, and risks
  created_at: Date;
  updated_at: Date;
}

export interface Story {
  id: string;
  project_id: string;
  story_key: string;
  title: string;
  description?: string;
  acceptance_criteria?: string;
  story_points?: number;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  story_type: 'feature' | 'bug' | 'technical' | 'design' | 'documentation';
  status: 'draft' | 'ready' | 'in_progress' | 'review' | 'on_hold' | 'done';
  sprint_id?: string;
  source?: string;
  estimated_hours?: number;
  dependencies?: string[];
  assigned_to?: string;
  assignment_group?: string;
  notes?: string | JournalEntry[];
  created_at: Date;
  updated_at: Date;
}

export interface Sprint {
  id: string;
  project_id: string;
  name: string;
  sprint_number: number;
  start_date: Date;
  end_date: Date;
  sprint_goal?: string;
  status: 'planned' | 'active' | 'completed';
  created_at: Date;
}

export interface Document {
  id: string;
  project_id: string;
  title: string;
  document_type: 'sow' | 'requirements' | 'meeting_notes' | 'email' | 'other';
  file_path?: string;
  content_text?: string;
  content_summary?: string;
  created_at: Date;
}

export interface KnowledgeEmbedding {
  id: string;
  project_id: string;
  source_type: 'document' | 'meeting' | 'email' | 'other';
  source_id?: string;
  content_chunk: string;
  chunk_index: number;
  embedding_id: string;
  created_at: Date;
}

// AI Planning Agent types
export interface PlanningContext {
  projectName: string;
  clientName: string;
  projectType?: string;
  documents: Array<{
    title: string;
    content: string;
    type: string;
  }>;
  relevantKnowledge?: string[];
}

export interface GeneratedStory {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string;
  storyPoints: number;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  type: 'feature' | 'bug' | 'technical' | 'design' | 'documentation';
  dependencies: string[];
  estimatedHours: number;
}

export interface GeneratedSprint {
  sprintNumber: number;
  name: string;
  startDate: string;
  endDate: string;
  goal: string;
  storyIds: string[];
}

export interface Milestone {
  name: string;
  date: string;
  deliverables: string[];
}

export interface Timeline {
  totalWeeks: number;
  startDate: string;
  endDate: string;
  milestones: Milestone[];
}

export interface Risk {
  description: string;
  probability: 'high' | 'medium' | 'low';
  impact: 'high' | 'medium' | 'low';
  mitigation: string;
}

// Meeting recommendation from AI (used in planning)
export interface MeetingRecommendation {
  type: string;
  frequency: string;
  duration: string;
  participants: string[];
  purpose: string;
}

// Actual meeting record (Phase 2)
export type MeetingType =
  | 'daily_scrum'
  | 'weekly_status'
  | 'design_review'
  | 'uat'
  | 'kickoff'
  | 'retrospective'
  | 'client_general';

export type MeetingStatus = 'scheduled' | 'completed' | 'cancelled';

export type TranscriptSource = 'manual' | 'zoom' | 'uploaded_file';

export interface MeetingAttendee {
  name: string;
  email?: string;
  role?: string;
}

export interface MeetingRecord {
  id: string;
  project_id: string;

  // Meeting details
  title: string;
  meeting_type: MeetingType;

  // Scheduling
  scheduled_start: Date;
  scheduled_end?: Date;
  actual_start?: Date;
  actual_end?: Date;

  // Participants
  attendees: MeetingAttendee[];

  // Content
  agenda?: string;
  meeting_notes?: string;

  // Transcript
  transcript_text?: string;
  transcript_source?: TranscriptSource;
  transcript_processed: boolean;

  // AI Analysis (Week 5-6)
  key_decisions?: any;
  action_items?: any;
  sentiment_score?: number;
  topics_discussed?: any;

  status: MeetingStatus;

  created_at: Date;
  updated_at: Date;
}

export interface StoryUpdate {
  id: string;
  story_id: string;
  field_changed: string;
  old_value?: string;
  new_value?: string;
  source: string;
  source_reference?: string;
  update_notes?: string;
  updated_by: string;
  created_at: Date;
}

export interface GeneratedPlan {
  stories: GeneratedStory[];
  sprints: GeneratedSprint[];
  timeline: Timeline;
  meetings?: MeetingRecommendation[];
  risks: Risk[];
}

// API Request/Response types
export interface CreateProjectRequest {
  name: string;
  client_name: string;
  client_email?: string;
  project_type?: string;
  budget_hours?: number;
  sprint_length_weeks?: number;
}

export interface UploadDocumentRequest {
  title: string;
  document_type: string;
}

export interface GeneratePlanResponse {
  success: boolean;
  plan?: GeneratedPlan;
  error?: string;
}

// Meeting API types (Phase 2)
export interface CreateMeetingRequest {
  title: string;
  meetingType: MeetingType;
  scheduledStart: string; // ISO timestamp
  scheduledEnd?: string; // ISO timestamp
  attendees: MeetingAttendee[];
  agenda?: string;
}

export interface UpdateMeetingRequest {
  title?: string;
  meetingType?: MeetingType;
  scheduledStart?: string;
  scheduledEnd?: string;
  attendees?: MeetingAttendee[];
  agenda?: string;
  status?: MeetingStatus;
}

export interface UploadTranscriptRequest {
  transcriptText: string;
  transcriptSource: TranscriptSource;
}

export interface MeetingListItem {
  id: string;
  title: string;
  meetingType: MeetingType;
  scheduledStart: Date;
  hasTranscript: boolean;
  transcriptProcessed: boolean;
  attendeeCount: number;
  status: MeetingStatus;
}

export interface MeetingsListResponse {
  meetings: MeetingListItem[];
  total: number;
}

// Execution Agent types (Phase 2 - Week 5)
export interface StoryUpdateDetection {
  storyId: string | null;
  storyKey: string;
  oldStatus: string;
  newStatus: string;
  notes: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface BlockerDetection {
  storyId: string | null;
  storyKey?: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  blockedSince: string;
  needsMeeting: boolean;
  stakeholders: string[];
}

export interface NewWorkDetection {
  description: string;
  context: string;
  likelyStoryPoints: number;
  shouldCreateStory: boolean;
}

export interface TimelineAssessment {
  sprintOnTrack: boolean;
  estimatedDelay: number;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  recommendation: string;
}

export interface DailyScrumAnalysis {
  storyUpdates: StoryUpdateDetection[];
  blockers: BlockerDetection[];
  newWorkMentioned: NewWorkDetection[];
  timelineAssessment: TimelineAssessment;
}

export interface ExecutionContext {
  projectId: string;
  sprintNumber: number;
  daysIntoSprint: number;
  totalDays: number;
  stories: Array<{
    id: string;
    key: string;
    title: string;
    status: string;
    storyPoints: number;
  }>;
}

export interface ProcessMeetingResponse {
  success: boolean;
  analysis?: DailyScrumAnalysis;
  appliedUpdates?: {
    storiesUpdated: number;
    blockersCreated: number;
    newWorkFlagged: number;
  };
  error?: string;
}

// Risk/Blocker database types
export interface RiskRecord {
  id: string;
  project_id: string;
  story_id?: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  risk_type: 'blocker' | 'dependency' | 'technical' | 'resource' | 'scope';
  source: string;
  source_reference?: string;
  status: 'open' | 'in_progress' | 'resolved' | 'mitigated';
  blocked_since?: Date;
  resolved_at?: Date;
  stakeholders?: string[];
  needs_meeting: boolean;
  estimated_delay_days?: number;
  resolution_notes?: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}
