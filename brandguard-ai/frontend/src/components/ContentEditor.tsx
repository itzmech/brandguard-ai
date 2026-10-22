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

function ContentEditor({ 
  content, 
  onContentChange, 
  onAnalyze, 
  loading, 
  error,
  onRetry 
}: ContentEditorProps) {
  /**
   * Load a sample content into the editor
   */
  const loadSample = (sampleContent: string) => {
    onContentChange(sampleContent);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Content to Review
        </label>
        <textarea
          className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          placeholder="Enter your content here..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Load Sample Content
        </label>
        <div className="flex flex-wrap gap-2">
          {sampleContents.map((sample) => (
            <button
              key={sample.id}
              onClick={() => loadSample(sample.content)}
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
        className={`px-4 py-2 rounded font-medium ${
          content.trim() === '' || loading
            ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
        type="button"
      >
        {loading ? 'Analyzing...' : 'Run brand review'}
      </button>

      {error && (
        <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          <p className="mb-2">{error}</p>
          <button
            onClick={onRetry}
            className="text-sm underline hover:no-underline"
            type="button"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

export default ContentEditor;
