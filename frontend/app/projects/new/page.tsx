'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function NewProject() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    client_name: '',
    client_email: '',
    project_type: 'Employee Center',
    budget_hours: '',
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Step 1: Create project
      const projectResponse = await fetch(`${API_URL}/api/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          client_name: formData.client_name,
          client_email: formData.client_email || undefined,
          project_type: formData.project_type,
          budget_hours: formData.budget_hours
            ? parseFloat(formData.budget_hours)
            : undefined,
        }),
      });

      const projectData = await projectResponse.json();

      if (!projectData.success) {
        throw new Error(projectData.error || 'Failed to create project');
      }

      const projectId = projectData.project.id;

      // Step 2: Upload documents if any
      if (files.length > 0) {
        const formData = new FormData();
        files.forEach((file) => {
          formData.append('files', file);
        });

        const uploadResponse = await fetch(
          `${API_URL}/api/projects/${projectId}/documents/bulk`,
          {
            method: 'POST',
            body: formData,
          }
        );

        const uploadData = await uploadResponse.json();

        if (!uploadData.success) {
          console.warn('Document upload failed:', uploadData.error);
        }
      }

      // Redirect to project page
      router.push(`/projects/${projectId}`);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Create New Project
        </h1>
        <p className="text-gray-600">
          Set up a new ServiceNow consulting project with AI-powered planning
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">Error: {error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card">
        {/* Project Details */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Project Details
          </h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="label">
                Project Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                value={formData.name}
                onChange={handleInputChange}
                className="input"
                placeholder="Employee Center Implementation"
              />
            </div>

            <div>
              <label htmlFor="client_name" className="label">
                Client Name *
              </label>
              <input
                type="text"
                id="client_name"
                name="client_name"
                required
                value={formData.client_name}
                onChange={handleInputChange}
                className="input"
                placeholder="ABC Corporation"
              />
            </div>

            <div>
              <label htmlFor="client_email" className="label">
                Client Email
              </label>
              <input
                type="email"
                id="client_email"
                name="client_email"
                value={formData.client_email}
                onChange={handleInputChange}
                className="input"
                placeholder="client@example.com"
              />
            </div>

            <div>
              <label htmlFor="project_type" className="label">
                Project Type
              </label>
              <select
                id="project_type"
                name="project_type"
                value={formData.project_type}
                onChange={handleInputChange}
                className="input"
              >
                <option value="Employee Center">Employee Center</option>
                <option value="Service Portal">Service Portal</option>
                <option value="Virtual Agent">Virtual Agent</option>
                <option value="UI Builder">UI Builder</option>
                <option value="Workflow">Workflow</option>
                <option value="Integration">Integration</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label htmlFor="budget_hours" className="label">
                Budget (Hours)
              </label>
              <input
                type="number"
                id="budget_hours"
                name="budget_hours"
                value={formData.budget_hours}
                onChange={handleInputChange}
                className="input"
                placeholder="240"
                min="0"
                step="0.5"
              />
            </div>
          </div>
        </div>

        {/* Document Upload */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Project Documents
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Upload SOW, requirements, or any relevant documents. The AI will
            analyze these to generate your project plan.
          </p>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary-500 transition-colors">
            <input
              type="file"
              id="files"
              multiple
              accept=".pdf,.docx,.doc,.txt,.md"
              onChange={handleFileChange}
              className="hidden"
            />
            <label
              htmlFor="files"
              className="cursor-pointer flex flex-col items-center"
            >
              <svg
                className="h-12 w-12 text-gray-400 mb-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <span className="text-sm font-medium text-gray-700">
                Click to upload documents
              </span>
              <span className="text-xs text-gray-500 mt-1">
                PDF, DOCX, DOC, TXT, MD (max 10MB each)
              </span>
            </label>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="mt-4 space-y-2">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <svg
                      className="h-5 w-5 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(file.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating...' : 'Create Project'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="btn btn-secondary"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
