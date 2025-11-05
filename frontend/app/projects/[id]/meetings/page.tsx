'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import MeetingsList from '../../../components/MeetingsList';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface Project {
  id: string;
  name: string;
  client_name: string;
}

interface Meeting {
  id: string;
  title: string;
  meetingType: string;
  scheduledStart: string;
  hasTranscript: boolean;
  transcriptProcessed: boolean;
  attendeeCount: number;
  status: string;
}

export default function ProjectMeetingsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (projectId) {
      fetchProjectAndMeetings();
    }
  }, [projectId]);

  const fetchProjectAndMeetings = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch project details
      const projectResponse = await fetch(`${API_URL}/api/projects/${projectId}`);
      if (!projectResponse.ok) {
        throw new Error('Failed to fetch project');
      }
      const projectData = await projectResponse.json();
      setProject(projectData.project);

      // Fetch meetings
      const meetingsResponse = await fetch(`${API_URL}/api/projects/${projectId}/meetings`);
      if (!meetingsResponse.ok) {
        throw new Error('Failed to fetch meetings');
      }
      const meetingsData = await meetingsResponse.json();
      setMeetings(meetingsData.meetings || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMeetingClick = (meetingId: string) => {
    router.push(`/meetings/${meetingId}`);
  };

  const handleNewMeeting = () => {
    router.push(`/projects/${projectId}/meetings/new`);
  };

  const handleBackToProject = () => {
    router.push(`/projects/${projectId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading meetings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-2">Error</h2>
          <p className="text-gray-600">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={handleBackToProject}
            className="text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Project
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Meetings</h1>
              {project && (
                <p className="mt-2 text-gray-600">
                  {project.name} - {project.client_name}
                </p>
              )}
            </div>
            <button
              onClick={handleNewMeeting}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Meeting
            </button>
          </div>
        </div>

        {/* Stats */}
        {meetings.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-3xl font-bold text-blue-600">{meetings.length}</div>
              <div className="text-sm text-gray-600 mt-1">Total Meetings</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-3xl font-bold text-green-600">
                {meetings.filter((m) => m.hasTranscript).length}
              </div>
              <div className="text-sm text-gray-600 mt-1">With Transcript</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-3xl font-bold text-purple-600">
                {meetings.filter((m) => m.transcriptProcessed).length}
              </div>
              <div className="text-sm text-gray-600 mt-1">Processed</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-3xl font-bold text-orange-600">
                {meetings.filter((m) => m.status === 'scheduled').length}
              </div>
              <div className="text-sm text-gray-600 mt-1">Scheduled</div>
            </div>
          </div>
        )}

        {/* Meetings List */}
        <MeetingsList meetings={meetings} onMeetingClick={handleMeetingClick} />
      </div>
    </div>
  );
}
