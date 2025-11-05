'use client';

import { useState } from 'react';
import { MEETING_TYPES } from './MeetingTypeSelect';

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

interface MeetingsListProps {
  meetings: Meeting[];
  onMeetingClick: (meetingId: string) => void;
}

const getMeetingTypeLabel = (type: string): string => {
  const meetingType = MEETING_TYPES.find((t) => t.value === type);
  return meetingType?.label || type;
};

const getMeetingTypeBadgeColor = (type: string): string => {
  const colors: Record<string, string> = {
    daily_scrum: 'bg-blue-100 text-blue-800',
    weekly_status: 'bg-purple-100 text-purple-800',
    design_review: 'bg-green-100 text-green-800',
    uat: 'bg-yellow-100 text-yellow-800',
    kickoff: 'bg-indigo-100 text-indigo-800',
    retrospective: 'bg-pink-100 text-pink-800',
    client_general: 'bg-gray-100 text-gray-800',
  };
  return colors[type] || 'bg-gray-100 text-gray-800';
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) {
    return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  }
};

const formatDateTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export default function MeetingsList({ meetings, onMeetingClick }: MeetingsListProps) {
  const [typeFilter, setTypeFilter] = useState<string>('');

  const filteredMeetings = typeFilter
    ? meetings.filter((m) => m.meetingType === typeFilter)
    : meetings;

  if (meetings.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No meetings</h3>
        <p className="mt-1 text-sm text-gray-500">Get started by creating a new meeting.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex items-center gap-4">
        <label htmlFor="type-filter" className="text-sm font-medium text-gray-700">
          Filter by type:
        </label>
        <select
          id="type-filter"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="block pl-3 pr-10 py-2 text-sm border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
        >
          <option value="">All Types</option>
          {MEETING_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
        {typeFilter && (
          <button
            onClick={() => setTypeFilter('')}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Clear filter
          </button>
        )}
      </div>

      {/* Meetings Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Date & Time
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Meeting
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Type
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Attendees
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredMeetings.map((meeting) => (
              <tr
                key={meeting.id}
                onClick={() => onMeetingClick(meeting.id)}
                className="hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <div className="text-gray-900">{formatDateTime(meeting.scheduledStart)}</div>
                  <div className="text-gray-500">{formatDate(meeting.scheduledStart)}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-gray-900">{meeting.title}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getMeetingTypeBadgeColor(
                      meeting.meetingType
                    )}`}
                  >
                    {getMeetingTypeLabel(meeting.meetingType)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {meeting.attendeeCount} {meeting.attendeeCount === 1 ? 'person' : 'people'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    {meeting.hasTranscript ? (
                      meeting.transcriptProcessed ? (
                        <span className="text-green-600" title="Transcript processed">
                          ⏳
                        </span>
                      ) : (
                        <span className="text-blue-600" title="Has transcript">
                          📝
                        </span>
                      )
                    ) : (
                      <span className="text-gray-400" title="No transcript">
                        ○
                      </span>
                    )}
                    <span
                      className={`text-xs ${
                        meeting.status === 'completed'
                          ? 'text-green-600'
                          : meeting.status === 'cancelled'
                          ? 'text-red-600'
                          : 'text-gray-600'
                      }`}
                    >
                      {meeting.status}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredMeetings.length === 0 && meetings.length > 0 && (
        <div className="text-center py-8 text-gray-500">
          No meetings found for selected filter.
        </div>
      )}
    </div>
  );
}
