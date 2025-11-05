'use client';

import { useState, useRef } from 'react';

interface TranscriptUploadProps {
  meetingId: string;
  onUploadSuccess: () => void;
  apiUrl: string;
}

type UploadMode = 'paste' | 'file';

export default function TranscriptUpload({ meetingId, onUploadSuccess, apiUrl }: TranscriptUploadProps) {
  const [mode, setMode] = useState<UploadMode>('paste');
  const [transcriptText, setTranscriptText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.txt')) {
      setError('Only .txt files are supported');
      return;
    }

    // Read file content
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setTranscriptText(content);
      setError(null);
    };
    reader.onerror = () => {
      setError('Failed to read file');
    };
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    // Validation
    if (transcriptText.trim().length < 50) {
      setError('Transcript must be at least 50 characters long');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const response = await fetch(`${apiUrl}/api/meetings/${meetingId}/transcript`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcriptText: transcriptText.trim(),
          transcriptSource: mode === 'file' ? 'uploaded_file' : 'manual',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload transcript');
      }

      // Success!
      onUploadSuccess();
    } catch (err: any) {
      setError(err.message || 'An error occurred while uploading');
    } finally {
      setUploading(false);
    }
  };

  const charCount = transcriptText.length;
  const isValid = charCount >= 50;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Upload Transcript</h3>

        {/* Mode Tabs */}
        <div className="flex border border-gray-300 rounded-md overflow-hidden">
          <button
            onClick={() => setMode('paste')}
            className={`px-4 py-2 text-sm font-medium ${
              mode === 'paste'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Paste Text
          </button>
          <button
            onClick={() => setMode('file')}
            className={`px-4 py-2 text-sm font-medium border-l border-gray-300 ${
              mode === 'file'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Upload File
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Upload Interface */}
      {mode === 'paste' ? (
        <div className="space-y-2">
          <label htmlFor="transcript-text" className="block text-sm font-medium text-gray-700">
            Paste meeting transcript
          </label>
          <textarea
            id="transcript-text"
            value={transcriptText}
            onChange={(e) => setTranscriptText(e.target.value)}
            placeholder="Paste your meeting transcript here...&#10;&#10;Example:&#10;Adam: Yesterday I completed STORY-12, the Employee Center landing page.&#10;Today I'm working on STORY-15, the IT Services workspace. No blockers.&#10;&#10;Sarah: Great progress! Can you update the status on those stories?"
            rows={12}
            className="block w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 font-mono text-sm p-3"
          />
          <div className="flex items-center justify-between text-sm">
            <span className={`${isValid ? 'text-green-600' : 'text-gray-500'}`}>
              {charCount.toLocaleString()} characters {isValid && '✓'}
            </span>
            {!isValid && charCount > 0 && (
              <span className="text-orange-600">
                Need {50 - charCount} more characters (minimum 50)
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt"
              onChange={handleFileChange}
              className="hidden"
            />
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <button
              onClick={() => fileInputRef.current?.click()}
              type="button"
              className="mt-4 px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Choose .txt file
            </button>
            <p className="mt-2 text-xs text-gray-500">
              Upload a plain text file containing the meeting transcript
            </p>
          </div>

          {/* Preview */}
          {transcriptText && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Preview</label>
              <div className="border border-gray-300 rounded-md p-3 bg-gray-50 max-h-64 overflow-y-auto">
                <pre className="font-mono text-sm whitespace-pre-wrap text-gray-800">
                  {transcriptText}
                </pre>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className={`${isValid ? 'text-green-600' : 'text-gray-500'}`}>
                  {charCount.toLocaleString()} characters {isValid && '✓'}
                </span>
                {!isValid && (
                  <span className="text-orange-600">
                    Need {50 - charCount} more characters (minimum 50)
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Upload Button */}
      <div className="flex justify-end pt-4 border-t">
        <button
          onClick={handleUpload}
          disabled={!isValid || uploading}
          className={`px-6 py-2 rounded-md text-white font-medium ${
            !isValid || uploading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
          }`}
        >
          {uploading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Uploading...
            </span>
          ) : (
            'Upload Transcript'
          )}
        </button>
      </div>
    </div>
  );
}
