'use client';

interface MeetingTypeOption {
  value: string;
  label: string;
  description: string;
}

const MEETING_TYPES: MeetingTypeOption[] = [
  {
    value: 'daily_scrum',
    label: 'Daily Scrum',
    description: 'Daily standup meeting to sync on progress and blockers',
  },
  {
    value: 'weekly_status',
    label: 'Weekly Status Call',
    description: 'Weekly status update with client or stakeholders',
  },
  {
    value: 'design_review',
    label: 'Design Review',
    description: 'Review designs, wireframes, or technical architecture',
  },
  {
    value: 'uat',
    label: 'UAT Session',
    description: 'User acceptance testing with client',
  },
  {
    value: 'kickoff',
    label: 'Kickoff Meeting',
    description: 'Project or sprint kickoff meeting',
  },
  {
    value: 'retrospective',
    label: 'Sprint Retrospective',
    description: 'Team retrospective to discuss what went well and improvements',
  },
  {
    value: 'client_general',
    label: 'Client Meeting (General)',
    description: 'General meeting with client',
  },
];

interface MeetingTypeSelectProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}

export default function MeetingTypeSelect({ value, onChange, required = false }: MeetingTypeSelectProps) {
  return (
    <div className="space-y-2">
      <label htmlFor="meeting-type" className="block text-sm font-medium text-gray-700">
        Meeting Type {required && <span className="text-red-500">*</span>}
      </label>
      <select
        id="meeting-type"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
      >
        <option value="">Select a meeting type...</option>
        {MEETING_TYPES.map((type) => (
          <option key={type.value} value={type.value}>
            {type.label}
          </option>
        ))}
      </select>
      {value && (
        <p className="text-sm text-gray-500 mt-1">
          {MEETING_TYPES.find((t) => t.value === value)?.description}
        </p>
      )}
    </div>
  );
}

export { MEETING_TYPES };
export type { MeetingTypeOption };
