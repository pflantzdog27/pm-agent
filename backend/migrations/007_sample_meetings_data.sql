-- Sample Meetings Data for Testing (Phase 2 - Week 4)
-- This creates 3 sample meetings: daily scrum with transcript, weekly status with transcript, and design review without transcript

-- Get the first project ID (adjust if needed)
DO $$
DECLARE
  v_project_id UUID;
  v_meeting_id_1 UUID;
  v_meeting_id_2 UUID;
  v_meeting_id_3 UUID;
BEGIN
  -- Get first project
  SELECT id INTO v_project_id FROM projects LIMIT 1;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'No projects found. Please create a project first.';
  END IF;

  -- Meeting 1: Daily Scrum (completed with transcript)
  v_meeting_id_1 := gen_random_uuid();
  INSERT INTO meetings (
    id, project_id, title, meeting_type,
    scheduled_start, scheduled_end, actual_start, actual_end,
    attendees,
    transcript_text, transcript_source, status
  ) VALUES (
    v_meeting_id_1,
    v_project_id,
    'Daily Standup - Sprint 3 Day 5',
    'daily_scrum',
    NOW() - INTERVAL '1 day' + INTERVAL '9 hours',
    NOW() - INTERVAL '1 day' + INTERVAL '9 hours 15 minutes',
    NOW() - INTERVAL '1 day' + INTERVAL '9 hours',
    NOW() - INTERVAL '1 day' + INTERVAL '9 hours 15 minutes',
    '[
      {"name": "Adam", "role": "Developer"}
    ]'::jsonb,
    E'Adam: Good morning team! Here''s my update for today.\n\nYesterday I completed STORY-12, the Employee Center landing page. The design is finalized and I''ve pushed the code to the dev environment. Everything looks good in testing.\n\nToday I''m working on STORY-15, the IT Services workspace. This involves setting up the service catalog views and configuring the request forms. I should have the basic structure done by end of day.\n\nNo blockers at the moment. The APIs are working as expected and the ServiceNow instance is stable.',
    'manual',
    'completed'
  );

  -- Meeting 2: Weekly Status (completed with transcript)
  v_meeting_id_2 := gen_random_uuid();
  INSERT INTO meetings (
    id, project_id, title, meeting_type,
    scheduled_start, scheduled_end, actual_start, actual_end,
    attendees,
    agenda,
    transcript_text, transcript_source, status
  ) VALUES (
    v_meeting_id_2,
    v_project_id,
    'Weekly Status with Client',
    'weekly_status',
    NOW() - INTERVAL '3 days' + INTERVAL '14 hours',
    NOW() - INTERVAL '3 days' + INTERVAL '15 hours',
    NOW() - INTERVAL '3 days' + INTERVAL '14 hours 5 minutes',
    NOW() - INTERVAL '3 days' + INTERVAL '14 hours 55 minutes',
    '[
      {"name": "Adam", "role": "Consultant", "email": "adam@consulting.com"},
      {"name": "Sarah", "role": "Client PM", "email": "sarah@client.com"},
      {"name": "Mike", "role": "Stakeholder", "email": "mike@client.com"}
    ]'::jsonb,
    'Review sprint progress, discuss upcoming milestones, address any concerns',
    E'Adam: Thanks everyone for joining. Let me start with a quick update on our progress this week.\n\nWe completed 4 stories this sprint, including the Employee Center landing page design which is now live in the dev environment. The feedback from the initial testing has been very positive.\n\nSarah: That''s great to hear, Adam! The designs look excellent. I shared them with the executive team and they''re impressed with the modern look.\n\nAdam: Glad to hear that! We''re on track to complete the remaining 3 stories by the end of this sprint. That will give us a complete Employee Center module ready for UAT.\n\nMike: One question - can we add a mobile view to the Employee Center? Our field staff primarily access ServiceNow from mobile devices.\n\nAdam: That''s a good point, Mike. Mobile responsiveness wasn''t in the original scope, but it''s definitely important. Let me assess the impact and effort required. This would likely be a scope change that we''d need to plan for a future sprint.\n\nSarah: Yes, let''s get an estimate on that, Adam. It could be critical for adoption with our field teams.\n\nMike: Agreed. Also, when do you think we can start UAT?\n\nAdam: Based on our current velocity, we should be ready to start UAT in about 2 weeks, right at the beginning of Sprint 4. I''ll send out a detailed timeline later today.\n\nSarah: Perfect. I''ll start coordinating with the UAT team on our side.\n\nAdam: Great! Any other questions or concerns?\n\nMike: No, I think we''re good. Thanks for the update.\n\nAdam: Thank you both. I''ll follow up with that mobile impact assessment by tomorrow.',
    'manual',
    'completed'
  );

  -- Meeting 3: Design Review (scheduled, no transcript yet)
  v_meeting_id_3 := gen_random_uuid();
  INSERT INTO meetings (
    id, project_id, title, meeting_type,
    scheduled_start, scheduled_end,
    attendees,
    agenda,
    status
  ) VALUES (
    v_meeting_id_3,
    v_project_id,
    'Design Review - HR Workspace',
    'design_review',
    NOW() + INTERVAL '2 days' + INTERVAL '10 hours',
    NOW() + INTERVAL '2 days' + INTERVAL '11 hours',
    '[
      {"name": "Adam", "email": "adam@consulting.com"},
      {"name": "Sarah", "role": "Client PM", "email": "sarah@client.com"},
      {"name": "Jennifer", "role": "HR Lead", "email": "jennifer@client.com"}
    ]'::jsonb,
    E'Agenda:\n1. Review wireframes for HR Services workspace\n2. Discuss information architecture and navigation\n3. Review employee onboarding workflow\n4. Feedback and next steps',
    'scheduled'
  );

  RAISE NOTICE 'Sample meetings created successfully!';
  RAISE NOTICE 'Meeting 1 (Daily Scrum): %', v_meeting_id_1;
  RAISE NOTICE 'Meeting 2 (Weekly Status): %', v_meeting_id_2;
  RAISE NOTICE 'Meeting 3 (Design Review): %', v_meeting_id_3;

END $$;
