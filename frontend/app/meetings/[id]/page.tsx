'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import TranscriptUpload from '../../components/TranscriptUpload';
import { MEETING_TYPES } from '../../components/MeetingTypeSelect';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface Attendee {
  name: string;
  email?: string;
  role?: string;
}

interface Meeting {
  id: string;
  projectId: string;
  title: string;
  meetingType: string;
  scheduledStart: string;
  scheduledEnd?: string;
  actualStart?: string;
  actualEnd?: string;
  attendees: Attendee[];
  agenda?: string;
  meetingNotes?: string;
  transcriptText?: string;
  transcriptSource?: string;
  transcriptProcessed: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export default function MeetingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const meetingId = params?.id as string;

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (meetingId) {
      fetchMeeting();
    }
  }, [meetingId]);

  const fetchMeeting = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_URL}/api/meetings/${meetingId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch meeting');
      }

      const data = await response.json();
      setMeeting(data.meeting);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTranscriptUploadSuccess = () => {
    // Refetch meeting data to show the transcript
    fetchMeeting();
  };

  const handleBackToProject = () => {
    if (meeting?.projectId) {
      router.push(`/projects/${meeting.projectId}/meetings`);
    } else {
      router.push('/');
    }
  };

  const getMeetingTypeLabel = (type: string): string => {
    const meetingType = MEETING_TYPES.find((t) => t.value === type);
    return meetingType?.label || type;
  };

  const formatDateTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading meeting...</p>
        </div>
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-2">Error</h2>
          <p className="text-gray-600">{error || 'Meeting not found'}</p>
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
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={handleBackToProject}
            className="text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Meetings
          </button>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{meeting.title}</h1>
              <div className="mt-2 flex items-center gap-4">
                <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-semibold rounded-full">
                  {getMeetingTypeLabel(meeting.meetingType)}
                </span>
                <span className="text-sm text-gray-600">{formatDateTime(meeting.scheduledStart)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Meeting Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Agenda */}
            {meeting.agenda && (
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Agenda</h2>
                <p className="text-gray-700 whitespace-pre-wrap">{meeting.agenda}</p>
              </div>
            )}

            {/* Transcript Section */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Transcript</h2>

              {meeting.transcriptText ? (
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-green-600 font-medium">✓ Transcript uploaded</span>
                      {meeting.transcriptSource && (
                        <span className="text-xs text-gray-500">
                          (Source: {meeting.transcriptSource.replace('_', ' ')})
                        </span>
                      )}
                    </div>
                    {meeting.transcriptProcessed && (
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded">
                        Processed
                      </span>
                    )}
                  </div>

                  <div className="border border-gray-300 rounded-lg p-4 bg-gray-50 max-h-96 overflow-y-auto">
                    <pre className="font-mono text-sm whitespace-pre-wrap text-gray-800">
                      {meeting.transcriptText}
                    </pre>
                  </div>

                  <div className="mt-4 text-sm text-gray-500">
                    {meeting.transcriptText.length.toLocaleString()} characters
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-gray-600 mb-4">
                    No transcript has been uploaded yet. Upload a transcript to enable AI processing.
                  </p>
                  <TranscriptUpload
                    meetingId={meeting.id}
                    onUploadSuccess={handleTranscriptUploadSuccess}
                    apiUrl={API_URL}
                  />
                </div>
              )}
            </div>

            {/* AI Analysis Section (Phase 2 - Week 5) */}
            {meeting.transcriptProcessed && (
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">AI Analysis</h2>
                <div className="text-gray-500 text-center py-8">
                  <p>AI analysis coming in Week 5!</p>
                  <p className="text-sm mt-2">This section will show key decisions, action items, and story updates.</p>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Status</h3>
              <div className="space-y-3">
                <div>
                  <span className="text-xs text-gray-500">Meeting Status</span>
                  <div className="mt-1">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        meeting.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : meeting.status === 'cancelled'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {meeting.status}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-xs text-gray-500">Transcript</span>
                  <div className="mt-1 text-sm text-gray-900">
                    {meeting.transcriptText ? '✓ Uploaded' : '○ Not uploaded'}
                  </div>
                </div>

                <div>
                  <span className="text-xs text-gray-500">AI Processing</span>
                  <div className="mt-1 text-sm text-gray-900">
                    {meeting.transcriptProcessed ? '✓ Processed' : '○ Not processed'}
                  </div>
                </div>
              </div>
            </div>

            {/* Attendees */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">
                Attendees ({meeting.attendees.length})
              </h3>
              <div className="space-y-3">
                {meeting.attendees.map((attendee, index) => (
                  <div key={index} className="border-b border-gray-200 pb-2 last:border-0">
                    <div className="font-medium text-gray-900">{attendee.name}</div>
                    {attendee.role && <div className="text-xs text-gray-500">{attendee.role}</div>}
                    {attendee.email && <div className="text-xs text-gray-600">{attendee.email}</div>}
                  </div>
                ))}
              </div>
            </div>

            {/* Timestamps */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Timestamps</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-500">Created:</span>
                  <div className="text-gray-900">
                    {new Date(meeting.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500">Last Updated:</span>
                  <div className="text-gray-900">
                    {new Date(meeting.updatedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
