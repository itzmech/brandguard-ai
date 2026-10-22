/**
 * Content editor component
 * Allows users to input content and select samples for analysis
 */
import { sampleContents } from '../sampleContent';

interface ContentEditorProps {
  content: string;
  onContentChange: (content: string) => void;
  onAnalyze: () => void;
  loading: boolean;
  error: string;
  onRetry: () => void;
}

function ContentEditor({ content, onContentChange, onAnalyze, loading, error, onRetry }: ContentEditorProps) {
  // Character count: current length / 5000 max
  const charCount = content.length;
  const maxChars = 5000;

  const textareaClassName = 'w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500';
  const buttonClass = content.trim() === '' || loading
    ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
    : 'bg-indigo-600 text-white hover:bg-indigo-700';

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Content to Review</label>
        <textarea
          className={textareaClassName}
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          placeholder="Enter your content here..."
        />
        <p className="text-xs text-gray-500 mt-1">
          {charCount} / {maxChars} characters
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Load Sample Content</label>
        <div className="flex flex-wrap gap-2">
          {sampleContents.map((sample) => (
            <button
              key={sample.id}
              onClick={() => onContentChange(sample.content)}
              className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              type="button"
            >
              {sample.title}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={onAnalyze}
        disabled={content.trim() === '' || loading}
        className={`px-4 py-2 rounded font-medium ${buttonClass}`}
        type="button"
      >
        {loading ? 'Analyzing...' : 'Run brand review'}
      </button>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p className="mb-2">{error}</p>
          <button onClick={onRetry} className="text-sm underline hover:no-underline" type="button">
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

export default ContentEditor;
