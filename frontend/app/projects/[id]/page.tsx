'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import StoryModal from '../../components/StoryModal';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface Project {
  id: string;
  name: string;
  clientName: string;
  status: string;
  startDate?: string;
  targetEndDate?: string;
}

interface Story {
  id: string;
  storyKey: string;
  title: string;
  description?: string;
  acceptanceCriteria?: string;
  storyPoints?: number;
  priority: string;
  storyType: string;
  status: string;
  sprintId?: string;
  estimatedHours?: number;
  assignedTo?: string;
  assignmentGroup?: string;
  notes?: string;
}

interface Sprint {
  id: string;
  name: string;
  sprintNumber: number;
  startDate: string;
  endDate: string;
  sprintGoal?: string;
  stories: Story[];
}

interface Milestone {
  name: string;
  date: string;
  deliverables: string[];
}

interface Timeline {
  totalWeeks: number;
  startDate: string;
  endDate: string;
  milestones: Milestone[];
}

interface Meeting {
  type: string;
  frequency: string;
  duration: string;
  participants: string[];
  purpose: string;
}

interface Risk {
  description: string;
  probability: 'high' | 'medium' | 'low';
  impact: 'high' | 'medium' | 'low';
  mitigation: string;
}

interface PlanData {
  timeline?: Timeline;
  meetings?: Meeting[];
  risks?: Risk[];
}

type TabType = 'overview' | 'sprints' | 'timeline' | 'meetings' | 'risks';

export default function ProjectDetail() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [planData, setPlanData] = useState<PlanData>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPlan, setHasPlan] = useState(false);
  const [activeStory, setActiveStory] = useState<Story | null>(null);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    if (projectId) {
      fetchProjectPlan();
    }
  }, [projectId]);

  const fetchProjectPlan = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/projects/${projectId}/plan`);
      const data = await response.json();

      if (data.success) {
        setProject(data.project);
        setSprints(data.sprints);
        setHasPlan(data.stories.length > 0);

        // Store timeline, meetings, risks if available
        if (data.plan) {
          setPlanData({
            timeline: data.plan.timeline,
            meetings: data.plan.meetings,
            risks: data.plan.risks,
          });
        }
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generatePlan = async () => {
    try {
      setGenerating(true);
      setError(null);

      console.log('🚀 Generating plan for project:', projectId);
      console.log('API URL:', `${API_URL}/api/projects/${projectId}/generate-plan`);

      const response = await fetch(
        `${API_URL}/api/projects/${projectId}/generate-plan`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('Response data:', data);

      if (data.success) {
        // Store the complete plan data
        if (data.plan) {
          setPlanData({
            timeline: data.plan.timeline,
            meetings: data.plan.meetings,
            risks: data.plan.risks,
          });
        }
        await fetchProjectPlan();
      } else {
        setError(data.error || 'Unknown error occurred');
      }
    } catch (err: any) {
      console.error('Plan generation error:', err);
      setError(`Failed to generate plan: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const story = sprints
      .flatMap((s) => s.stories)
      .find((st) => st.id === active.id);
    setActiveStory(story || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveStory(null);

    if (!over) return;

    const storyId = active.id as string;
    const newSprintId = over.id as string;

    const story = sprints.flatMap((s) => s.stories).find((st) => st.id === storyId);
    if (!story || story.sprintId === newSprintId) return;

    try {
      const response = await fetch(`${API_URL}/api/stories/${storyId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sprintId: newSprintId }),
      });

      const data = await response.json();

      if (data.success) {
        await fetchProjectPlan();
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleStoryClick = (story: Story) => {
    setSelectedStory(story);
    setIsModalOpen(true);
  };

  const handleStoryUpdate = (updatedStory: Story) => {
    fetchProjectPlan();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-600">Project not found</p>
        <button onClick={() => router.push('/')} className="btn btn-primary mt-4">
          Back to Dashboard
        </button>
      </div>
    );
  }

  const totalStories = sprints.reduce((sum, s) => sum + s.stories.length, 0);
  const totalPoints = sprints.reduce(
    (sum, s) => sum + s.stories.reduce((pts, story) => pts + (story.storyPoints || 0), 0),
    0
  );
  const completedStories = sprints.reduce(
    (sum, s) => sum + s.stories.filter((st) => st.status === 'done').length,
    0
  );
  const completedPoints = sprints.reduce(
    (sum, s) =>
      sum + s.stories.filter((st) => st.status === 'done').reduce((pts, story) => pts + (story.storyPoints || 0), 0),
    0
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push('/')}
          className="text-primary-600 hover:text-primary-700 mb-4 flex items-center gap-2"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{project.name}</h1>
            <p className="text-gray-600">Client: {project.clientName}</p>
          </div>

          <button
            onClick={generatePlan}
            disabled={generating}
            className={`${
              hasPlan ? 'btn btn-secondary' : 'btn btn-primary'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {generating ? (
              <>
                <svg className="animate-spin h-5 w-5 mr-2 inline" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Generating Plan...
              </>
            ) : hasPlan ? (
              '🔄 Regenerate Plan'
            ) : (
              '✨ Generate Plan'
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">Error: {error}</p>
        </div>
      )}

      {generating && (
        <div className="mb-6 p-6 bg-primary-50 border border-primary-200 rounded-lg">
          <div className="flex items-center gap-3">
            <svg className="animate-spin h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <div>
              <p className="font-medium text-primary-900">AI is analyzing your documents...</p>
              <p className="text-sm text-primary-700">
                This may take 30-60 seconds. Claude is creating your comprehensive project plan with timeline, meetings, and risks.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* No Plan Yet */}
      {!hasPlan && !generating && (
        <div className="card text-center py-12">
          <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
            />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No plan generated yet</h3>
          <p className="text-gray-600 mb-6">
            Click the button above to generate an AI-powered project plan with timeline, sprints, meetings, and risk assessment
          </p>
        </div>
      )}

      {/* Tabbed Interface */}
      {hasPlan && sprints.length > 0 && (
        <div>
          {/* Tab Navigation */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="-mb-px flex space-x-8">
              <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon="📊">
                Overview
              </TabButton>
              <TabButton active={activeTab === 'sprints'} onClick={() => setActiveTab('sprints')} icon="🏃">
                Sprint Board
              </TabButton>
              {planData.timeline && (
                <TabButton active={activeTab === 'timeline'} onClick={() => setActiveTab('timeline')} icon="📅">
                  Timeline
                </TabButton>
              )}
              {planData.meetings && planData.meetings.length > 0 && (
                <TabButton active={activeTab === 'meetings'} onClick={() => setActiveTab('meetings')} icon="🤝">
                  Meetings
                </TabButton>
              )}
              {planData.risks && planData.risks.length > 0 && (
                <TabButton active={activeTab === 'risks'} onClick={() => setActiveTab('risks')} icon="⚠️">
                  Risks
                </TabButton>
              )}
            </nav>
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <OverviewTab
              project={project}
              sprints={sprints}
              totalStories={totalStories}
              totalPoints={totalPoints}
              completedStories={completedStories}
              completedPoints={completedPoints}
              timeline={planData.timeline}
            />
          )}

          {activeTab === 'sprints' && (
            <SprintsTab
              sprints={sprints}
              sensors={sensors}
              handleDragStart={handleDragStart}
              handleDragEnd={handleDragEnd}
              handleStoryClick={handleStoryClick}
              activeStory={activeStory}
            />
          )}

          {activeTab === 'timeline' && planData.timeline && (
            <TimelineTab timeline={planData.timeline} />
          )}

          {activeTab === 'meetings' && planData.meetings && (
            <MeetingsTab meetings={planData.meetings} />
          )}

          {activeTab === 'risks' && planData.risks && (
            <RisksTab risks={planData.risks} />
          )}
        </div>
      )}

      {/* Story Detail Modal */}
      {selectedStory && (
        <StoryModal
          story={selectedStory}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedStory(null);
          }}
          onUpdate={handleStoryUpdate}
        />
      )}
    </div>
  );
}

// Tab Button Component
function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`${
        active
          ? 'border-primary-500 text-primary-600'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
    >
      <span>{icon}</span>
      {children}
    </button>
  );
}

// Overview Tab Component
function OverviewTab({
  project,
  sprints,
  totalStories,
  totalPoints,
  completedStories,
  completedPoints,
  timeline,
}: {
  project: Project;
  sprints: Sprint[];
  totalStories: number;
  totalPoints: number;
  completedStories: number;
  completedPoints: number;
  timeline?: Timeline;
}) {
  const progress = totalPoints > 0 ? (completedPoints / totalPoints) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Stories"
          value={totalStories}
          subValue={`${completedStories} completed`}
          icon="📝"
          color="blue"
        />
        <StatCard
          label="Story Points"
          value={totalPoints}
          subValue={`${completedPoints} completed`}
          icon="🎯"
          color="green"
        />
        <StatCard
          label="Sprints"
          value={sprints.length}
          subValue={`${timeline?.totalWeeks || 0} weeks total`}
          icon="🏃"
          color="purple"
        />
        <StatCard
          label="Progress"
          value={`${Math.round(progress)}%`}
          subValue={`${completedStories}/${totalStories} stories`}
          icon="📊"
          color="orange"
        />
      </div>

      {/* Progress Bar */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Progress</h3>
        <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
          <div
            className="bg-gradient-to-r from-primary-500 to-primary-600 h-4 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <p className="text-sm text-gray-600">
          {completedPoints} of {totalPoints} story points completed
        </p>
      </div>

      {/* Timeline Summary */}
      {timeline && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Timeline Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Start Date</p>
              <p className="text-lg font-medium text-gray-900">
                {new Date(timeline.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">End Date</p>
              <p className="text-lg font-medium text-gray-900">
                {new Date(timeline.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Duration</p>
              <p className="text-lg font-medium text-gray-900">{timeline.totalWeeks} weeks</p>
            </div>
          </div>
        </div>
      )}

      {/* Sprint Summary */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Sprint Summary</h3>
        <div className="space-y-3">
          {sprints.map((sprint) => {
            const sprintPoints = sprint.stories.reduce((sum, story) => sum + (story.storyPoints || 0), 0);
            const sprintCompleted = sprint.stories.filter((st) => st.status === 'done').length;
            return (
              <div key={sprint.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{sprint.name}</p>
                  <p className="text-sm text-gray-600">
                    {new Date(sprint.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} -{' '}
                    {new Date(sprint.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{sprintPoints} pts</p>
                  <p className="text-xs text-gray-600">
                    {sprintCompleted}/{sprint.stories.length} stories
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({
  label,
  value,
  subValue,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  subValue: string;
  icon: string;
  color: 'blue' | 'green' | 'purple' | 'orange';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-gray-600">{label}</p>
        <span className={`text-2xl ${colorClasses[color]} p-2 rounded-lg`}>{icon}</span>
      </div>
      <p className="text-3xl font-bold text-gray-900 mb-1">{value}</p>
      <p className="text-sm text-gray-500">{subValue}</p>
    </div>
  );
}

// Sprints Tab Component
function SprintsTab({
  sprints,
  sensors,
  handleDragStart,
  handleDragEnd,
  handleStoryClick,
  activeStory,
}: {
  sprints: Sprint[];
  sensors: any;
  handleDragStart: (event: DragStartEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  handleStoryClick: (story: Story) => void;
  activeStory: Story | null;
}) {
  const getStoryTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      feature: 'bg-blue-100 text-blue-800',
      bug: 'bg-red-100 text-red-800',
      technical: 'bg-purple-100 text-purple-800',
      design: 'bg-pink-100 text-pink-800',
      documentation: 'bg-gray-100 text-gray-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      ready: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      review: 'bg-purple-100 text-purple-800',
      on_hold: 'bg-orange-100 text-orange-800',
      done: 'bg-green-100 text-green-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Sprint Board</h2>
        <div className="text-sm text-gray-600">
          {sprints.reduce((sum, s) => sum + s.stories.length, 0)} stories across {sprints.length} sprints
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sprints.map((sprint) => (
            <SprintColumn
              key={sprint.id}
              sprint={sprint}
              onStoryClick={handleStoryClick}
              getStoryTypeColor={getStoryTypeColor}
              getStatusColor={getStatusColor}
            />
          ))}
        </div>

        <DragOverlay>
          {activeStory ? (
            <div className="p-4 bg-white rounded-lg shadow-lg border-2 border-primary-500 cursor-grabbing">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-mono text-gray-500">{activeStory.storyKey}</span>
                <span className={`px-2 py-0.5 text-xs font-medium rounded ${getStoryTypeColor(activeStory.storyType)}`}>
                  {activeStory.storyType}
                </span>
              </div>
              <p className="text-sm font-medium text-gray-900">{activeStory.title}</p>
              {activeStory.storyPoints && (
                <div className="mt-2 inline-flex items-center justify-center w-6 h-6 bg-primary-100 text-primary-700 rounded-full text-xs font-bold">
                  {activeStory.storyPoints}
                </div>
              )}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

// Sprint Column Component
function SprintColumn({
  sprint,
  onStoryClick,
  getStoryTypeColor,
  getStatusColor,
}: {
  sprint: Sprint;
  onStoryClick: (story: Story) => void;
  getStoryTypeColor: (type: string) => string;
  getStatusColor: (status: string) => string;
}) {
  const { setNodeRef } = useDroppable({ id: sprint.id });

  const totalPoints = sprint.stories.reduce((sum, story) => sum + (story.storyPoints || 0), 0);

  return (
    <div className="flex flex-col bg-gray-50 rounded-lg border-2 border-gray-200 min-h-[400px]">
      <div className="p-4 border-b border-gray-200 bg-white rounded-t-lg">
        <h3 className="font-semibold text-gray-900 mb-1">{sprint.name}</h3>
        <p className="text-xs text-gray-600 mb-2">
          {new Date(sprint.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} -{' '}
          {new Date(sprint.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </p>
        {sprint.sprintGoal && (
          <p className="text-xs text-gray-600 italic line-clamp-2">{sprint.sprintGoal}</p>
        )}
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-gray-600">{sprint.stories.length} stories</span>
          <span className="font-medium text-gray-900">{totalPoints} pts</span>
        </div>
      </div>

      <div ref={setNodeRef} className="flex-1 p-3 space-y-2 overflow-y-auto">
        {sprint.stories.map((story) => (
          <DraggableStory
            key={story.id}
            story={story}
            onClick={() => onStoryClick(story)}
            getStoryTypeColor={getStoryTypeColor}
            getStatusColor={getStatusColor}
          />
        ))}
        {sprint.stories.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">Drop stories here</div>
        )}
      </div>
    </div>
  );
}

// Draggable Story Card Component
function DraggableStory({
  story,
  onClick,
  getStoryTypeColor,
  getStatusColor,
}: {
  story: Story;
  onClick: () => void;
  getStoryTypeColor: (type: string) => string;
  getStatusColor: (status: string) => string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: story.id,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`p-3 bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <div className="flex flex-wrap items-center gap-1 mb-2">
        <span className="text-xs font-mono text-gray-500">{story.storyKey}</span>
        <span
          className={`px-2 py-0.5 text-xs font-medium rounded ${
            story.priority === 'Critical'
              ? 'bg-red-100 text-red-800'
              : story.priority === 'High'
              ? 'bg-orange-100 text-orange-800'
              : story.priority === 'Medium'
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-green-100 text-green-800'
          }`}
        >
          {story.priority}
        </span>
        <span className={`px-2 py-0.5 text-xs font-medium rounded ${getStoryTypeColor(story.storyType)}`}>
          {story.storyType}
        </span>
      </div>
      <p className="text-sm font-medium text-gray-900 mb-2 line-clamp-2">{story.title}</p>
      <div className="flex items-center justify-between">
        <span className={`px-2 py-0.5 text-xs font-medium rounded ${getStatusColor(story.status)}`}>
          {story.status}
        </span>
        {story.storyPoints && (
          <div className="w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-bold">
            {story.storyPoints}
          </div>
        )}
      </div>
      {story.assignedTo && (
        <div className="mt-2 text-xs text-gray-600 flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          {story.assignedTo}
        </div>
      )}
    </div>
  );
}

// Timeline Tab Component
function TimelineTab({ timeline }: { timeline: Timeline }) {
  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Project Timeline</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="text-center p-4 bg-primary-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Duration</p>
            <p className="text-3xl font-bold text-primary-600">{timeline.totalWeeks}</p>
            <p className="text-sm text-gray-600">weeks</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Start Date</p>
            <p className="text-xl font-bold text-green-600">
              {new Date(timeline.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">End Date</p>
            <p className="text-xl font-bold text-blue-600">
              {new Date(timeline.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        </div>

        <h3 className="text-lg font-semibold text-gray-900 mb-4">Milestones</h3>
        <div className="space-y-4">
          {timeline.milestones.map((milestone, index) => (
            <div key={index} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-bold text-sm">
                  {index + 1}
                </div>
                {index < timeline.milestones.length - 1 && <div className="w-0.5 flex-1 bg-primary-200 mt-2"></div>}
              </div>
              <div className="flex-1 pb-8">
                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-gray-900">{milestone.name}</h4>
                    <span className="text-sm text-gray-600">
                      {new Date(milestone.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-700">Deliverables:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {milestone.deliverables.map((deliverable, idx) => (
                        <li key={idx} className="text-sm text-gray-600">
                          {deliverable}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Meetings Tab Component
function MeetingsTab({ meetings }: { meetings: Meeting[] }) {
  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Meeting Cadence & Governance</h2>
        <p className="text-gray-600 mb-6">
          Regular meetings and ceremonies to ensure project success and stakeholder alignment
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {meetings.map((meeting, index) => (
            <div key={index} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-primary-100 text-primary-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  🤝
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-2">{meeting.type}</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">📅 Frequency:</span>
                      <span className="text-gray-700">{meeting.frequency}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">⏱️ Duration:</span>
                      <span className="text-gray-700">{meeting.duration}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">👥 Participants:</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {meeting.participants.map((participant, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                            {participant}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500">🎯 Purpose:</span>
                      <p className="text-gray-700 mt-1">{meeting.purpose}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Risks Tab Component
function RisksTab({ risks }: { risks: Risk[] }) {
  const getRiskColor = (probability: string, impact: string) => {
    const score = (probability === 'high' ? 3 : probability === 'medium' ? 2 : 1) * (impact === 'high' ? 3 : impact === 'medium' ? 2 : 1);
    if (score >= 6) return 'border-red-300 bg-red-50';
    if (score >= 4) return 'border-orange-300 bg-orange-50';
    return 'border-yellow-300 bg-yellow-50';
  };

  const getRiskBadgeColor = (level: string) => {
    if (level === 'high') return 'bg-red-100 text-red-800';
    if (level === 'medium') return 'bg-orange-100 text-orange-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Risk Assessment & Mitigation</h2>
        <p className="text-gray-600 mb-6">Identified risks with probability, impact, and mitigation strategies</p>

        <div className="space-y-4">
          {risks.map((risk, index) => (
            <div key={index} className={`border-2 rounded-lg p-4 ${getRiskColor(risk.probability, risk.impact)}`}>
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-gray-900 flex-1">{risk.description}</h3>
                <div className="flex gap-2 ml-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getRiskBadgeColor(risk.probability)}`}>
                    {risk.probability} probability
                  </span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getRiskBadgeColor(risk.impact)}`}>
                    {risk.impact} impact
                  </span>
                </div>
              </div>
              <div className="bg-white bg-opacity-80 rounded-lg p-3 border border-gray-200">
                <p className="text-sm font-medium text-gray-700 mb-1">Mitigation Strategy:</p>
                <p className="text-sm text-gray-600">{risk.mitigation}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
