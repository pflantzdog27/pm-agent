'use client';

import React from 'react';

interface StoryUpdate {
  storyKey: string;
  oldStatus: string;
  newStatus: string;
  notes: string;
  confidence: 'high' | 'medium' | 'low';
}

interface Blocker {
  storyKey?: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  blockedSince: string;
  needsMeeting: boolean;
  stakeholders: string[];
}

interface NewWork {
  description: string;
  context: string;
  likelyStoryPoints: number;
  shouldCreateStory: boolean;
}

interface TimelineAssessment {
  sprintOnTrack: boolean;
  estimatedDelay: number;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  recommendation: string;
}

interface MeetingAnalysisProps {
  analysis: {
    storyUpdates: StoryUpdate[];
    blockers: Blocker[];
    newWorkMentioned: NewWork[];
    timelineAssessment: TimelineAssessment;
  };
  appliedUpdates?: {
    storiesUpdated: number;
    blockersCreated: number;
    newWorkFlagged: number;
  };
}

const getSeverityColor = (severity: string) => {
  const colors: Record<string, string> = {
    critical: 'bg-red-100 text-red-800 border-red-300',
    high: 'bg-orange-100 text-orange-800 border-orange-300',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    low: 'bg-blue-100 text-blue-800 border-blue-300',
  };
  return colors[severity] || 'bg-gray-100 text-gray-800 border-gray-300';
};

const getConfidenceIcon = (confidence: string) => {
  if (confidence === 'high') return '✓✓';
  if (confidence === 'medium') return '✓';
  return '?';
};

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    done: 'bg-green-100 text-green-800',
    in_progress: 'bg-blue-100 text-blue-800',
    review: 'bg-purple-100 text-purple-800',
    ready: 'bg-cyan-100 text-cyan-800',
    draft: 'bg-gray-100 text-gray-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
};

const formatStatus = (status: string) => {
  return status
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export default function MeetingAnalysis({ analysis, appliedUpdates }: MeetingAnalysisProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          AI Meeting Analysis
        </h2>
        {appliedUpdates && (
          <div className="flex gap-4 text-sm text-gray-600">
            <span>✅ {appliedUpdates.storiesUpdated} stories updated</span>
            <span>⚠️ {appliedUpdates.blockersCreated} blockers created</span>
            <span>🆕 {appliedUpdates.newWorkFlagged} new work items flagged</span>
          </div>
        )}
      </div>

      {/* Timeline Assessment */}
      <div className={`rounded-lg border-2 p-6 ${
        analysis.timelineAssessment.sprintOnTrack
          ? 'bg-green-50 border-green-300'
          : 'bg-red-50 border-red-300'
      }`}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              📊 Timeline Assessment
            </h3>
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                analysis.timelineAssessment.sprintOnTrack
                  ? 'bg-green-200 text-green-900'
                  : 'bg-red-200 text-red-900'
              }`}>
                {analysis.timelineAssessment.sprintOnTrack ? '✓ On Track' : '⚠ At Risk'}
              </span>
              {analysis.timelineAssessment.estimatedDelay > 0 && (
                <span className="text-sm font-medium text-red-800">
                  {analysis.timelineAssessment.estimatedDelay} day delay estimated
                </span>
              )}
              <span className="text-xs text-gray-500">
                Confidence: {analysis.timelineAssessment.confidence}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">Reasoning:</p>
            <p className="text-sm text-gray-900">{analysis.timelineAssessment.reasoning}</p>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">Recommendation:</p>
            <p className="text-sm text-gray-900 font-medium">{analysis.timelineAssessment.recommendation}</p>
          </div>
        </div>
      </div>

      {/* Story Updates */}
      {analysis.storyUpdates.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            ✅ Story Updates ({analysis.storyUpdates.length})
          </h3>
          <div className="space-y-3">
            {analysis.storyUpdates.map((update, idx) => (
              <div key={idx} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-blue-600">
                      {update.storyKey}
                    </span>
                    <span className="text-xs text-gray-500">
                      {getConfidenceIcon(update.confidence)} {update.confidence} confidence
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(update.oldStatus)}`}>
                    {formatStatus(update.oldStatus)}
                  </span>
                  <span className="text-gray-400">→</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(update.newStatus)}`}>
                    {formatStatus(update.newStatus)}
                  </span>
                </div>

                <p className="text-sm text-gray-700">{update.notes}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Blockers */}
      {analysis.blockers.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            ⚠️ Blockers Identified ({analysis.blockers.length})
          </h3>
          <div className="space-y-3">
            {analysis.blockers.map((blocker, idx) => (
              <div key={idx} className={`border-2 rounded-lg p-4 ${getSeverityColor(blocker.severity)}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {blocker.storyKey && (
                      <span className="font-mono text-sm font-bold">
                        {blocker.storyKey}
                      </span>
                    )}
                    <span className="px-2 py-1 rounded text-xs font-bold uppercase">
                      {blocker.severity}
                    </span>
                  </div>
                  {blocker.needsMeeting && (
                    <span className="px-2 py-1 bg-red-200 text-red-900 rounded text-xs font-medium">
                      Needs Meeting
                    </span>
                  )}
                </div>

                <p className="text-sm font-medium mb-2">{blocker.description}</p>

                <div className="flex items-center gap-4 text-xs">
                  <span className="text-gray-700">
                    Blocked: {blocker.blockedSince}
                  </span>
                  <span className="text-gray-700">
                    Stakeholders: {blocker.stakeholders.join(', ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New Work Mentioned */}
      {analysis.newWorkMentioned.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            🆕 New Work Mentioned ({analysis.newWorkMentioned.length})
          </h3>
          <div className="space-y-3">
            {analysis.newWorkMentioned.map((work, idx) => (
              <div key={idx} className="border border-purple-200 rounded-lg p-4 bg-purple-50">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-sm font-medium text-gray-900">{work.description}</p>
                  <span className="px-2 py-1 bg-purple-200 text-purple-900 rounded text-xs font-medium whitespace-nowrap ml-2">
                    ~{work.likelyStoryPoints} pts
                  </span>
                </div>
                <p className="text-sm text-gray-700 mb-2">{work.context}</p>
                <div className="flex items-center gap-2">
                  {work.shouldCreateStory ? (
                    <span className="text-xs text-green-700 font-medium">
                      ✓ Recommended for creation
                    </span>
                  ) : (
                    <span className="text-xs text-orange-700 font-medium">
                      ⚠ Needs review before creating story
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
