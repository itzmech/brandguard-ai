/**
 * Main application component
 * Root component that renders the BrandGuard AI application
 */
import { useState } from 'react';
import ContentEditor from './components/ContentEditor';
import { analyze } from './api';
import { Finding } from './types';

function App() {
  // Main state as specified
  const [content, setContent] = useState<string>('');
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Timer for "Server is waking up" message
  const [showWakingMessage, setShowWakingMessage] = useState<boolean>(false);

  /**
   * Handle analysis request
   */
  const handleAnalyze = async () => {
    // Reset state
    setError('');
    setFindings([]);
    setLoading(true);
    setShowWakingMessage(false);

    // Set timer for 5 seconds
    const wakingTimer = setTimeout(() => {
      setShowWakingMessage(true);
    }, 5000);

    try {
      const result = await analyze(content);
      setFindings(result.findings);
    } catch (err) {
      // Display useful error message
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An error occurred during analysis');
      }
    } finally {
      // Clear timer and reset loading state
      clearTimeout(wakingTimer);
      setShowWakingMessage(false);
      setLoading(false);
    }
  };

  /**
   * Handle retry of failed analysis
   */
  const handleRetry = () => {
    handleAnalyze();
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-4xl font-bold text-gray-900 mb-8 text-center">BrandGuard AI</h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <ContentEditor
            content={content}
            onContentChange={setContent}
            onAnalyze={handleAnalyze}
            loading={loading}
            error={error}
            onRetry={handleRetry}
          />
        </div>

        {loading && showWakingMessage && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-6">
            Server is waking up, please wait...
          </div>
        )}

        {findings.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Analysis Results</h2>
            <p className="text-gray-600">{findings.length} finding(s) found</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
