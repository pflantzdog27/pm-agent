'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import 'react-quill/dist/quill.snow.css';

const ReactQuill = dynamic(() => import('react-quill'), { ssr: false });

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface JournalEntry {
  timestamp: string;
  author: string;
  content: string;
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
  notes?: string | JournalEntry[];
}

interface StoryModalProps {
  story: Story;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updatedStory: Story) => void;
}

export default function StoryModal({ story, isOpen, onClose, onUpdate }: StoryModalProps) {
  const [editedStory, setEditedStory] = useState<Story>(story);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newNote, setNewNote] = useState('');
  const [noteAuthor, setNoteAuthor] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);

  useEffect(() => {
    setEditedStory(story);

    // Parse journal entries
    if (story.notes) {
      if (typeof story.notes === 'string') {
        try {
          const parsed = JSON.parse(story.notes);
          setJournalEntries(Array.isArray(parsed) ? parsed : []);
        } catch {
          setJournalEntries([]);
        }
      } else if (Array.isArray(story.notes)) {
        setJournalEntries(story.notes);
      }
    } else {
      setJournalEntries([]);
    }
  }, [story]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const response = await fetch(`${API_URL}/api/stories/${editedStory.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editedStory),
      });

      const data = await response.json();

      if (data.success) {
        onUpdate(data.story);
        onClose();
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !noteAuthor.trim()) {
      setError('Please enter both author name and note content');
      return;
    }

    try {
      setAddingNote(true);
      setError(null);

      const response = await fetch(`${API_URL}/api/stories/${editedStory.id}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: newNote,
          author: noteAuthor,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Update journal entries
        const updatedStory = data.story;
        if (updatedStory.notes) {
          if (typeof updatedStory.notes === 'string') {
            try {
              const parsed = JSON.parse(updatedStory.notes);
              setJournalEntries(Array.isArray(parsed) ? parsed : []);
            } catch {
              setJournalEntries([]);
            }
          } else if (Array.isArray(updatedStory.notes)) {
            setJournalEntries(updatedStory.notes);
          }
        }
        setNewNote('');
        onUpdate(updatedStory);
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAddingNote(false);
    }
  };

  if (!isOpen) return null;

  const quillModules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['link'],
      ['clean'],
    ],
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{editedStory.storyKey}</h2>
            <p className="text-sm text-gray-600">Priority: {editedStory.priority}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title
            </label>
            <input
              type="text"
              value={editedStory.title}
              onChange={(e) => setEditedStory({ ...editedStory, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={editedStory.description || ''}
              onChange={(e) => setEditedStory({ ...editedStory, description: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Acceptance Criteria with Rich Text Editor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Acceptance Criteria
            </label>
            <div className="border border-gray-300 rounded-md" style={{ minHeight: '250px' }}>
              <ReactQuill
                theme="snow"
                value={editedStory.acceptanceCriteria || ''}
                onChange={(value) => setEditedStory({ ...editedStory, acceptanceCriteria: value })}
                modules={quillModules}
                className="bg-white"
                style={{ height: '200px' }}
              />
            </div>
          </div>

          {/* Priority, Story Points and Status Row */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority
              </label>
              <select
                value={editedStory.priority}
                onChange={(e) => setEditedStory({ ...editedStory, priority: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Story Points
              </label>
              <input
                type="number"
                value={editedStory.storyPoints || ''}
                onChange={(e) => setEditedStory({ ...editedStory, storyPoints: parseInt(e.target.value) || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={editedStory.status}
                onChange={(e) => setEditedStory({ ...editedStory, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="draft">Draft</option>
                <option value="ready">Ready</option>
                <option value="in_progress">In Progress</option>
                <option value="review">Review</option>
                <option value="on_hold">On Hold</option>
                <option value="done">Done</option>
              </select>
            </div>
          </div>

          {/* Assignment Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assigned To
              </label>
              <input
                type="text"
                value={editedStory.assignedTo || ''}
                onChange={(e) => setEditedStory({ ...editedStory, assignedTo: e.target.value })}
                placeholder="Enter name"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assignment Group
              </label>
              <input
                type="text"
                value={editedStory.assignmentGroup || ''}
                onChange={(e) => setEditedStory({ ...editedStory, assignmentGroup: e.target.value })}
                placeholder="Enter team/group"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Notes Journal */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes Journal
            </label>

            {/* Add New Note */}
            <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <input
                type="text"
                value={noteAuthor}
                onChange={(e) => setNoteAuthor(e.target.value)}
                placeholder="Your name"
                className="w-full px-3 py-2 mb-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={3}
                placeholder="Add a new note..."
                className="w-full px-3 py-2 mb-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <button
                onClick={handleAddNote}
                disabled={addingNote}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 text-sm"
              >
                {addingNote ? 'Adding...' : 'Add Note'}
              </button>
            </div>

            {/* Journal Entries */}
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {journalEntries.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No notes yet</p>
              ) : (
                journalEntries.map((entry, index) => (
                  <div key={index} className="p-3 bg-white border border-gray-200 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                          <span className="text-xs font-medium text-primary-700">
                            {entry.author.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{entry.author}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(entry.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{entry.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
