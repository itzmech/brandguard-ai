/**
 * Finding card component
 * Displays individual brand findings with severity and Apply/Reject actions
 */
import { Finding } from '../types';

interface FindingCardProps {
  finding: Finding;
  onApply: () => void;
  onReject: () => void;
  isApplied: boolean;
  isRejected: boolean;
}

function FindingCard({ 
  finding, 
  onApply, 
  onReject, 
  isApplied,
  isRejected
}: FindingCardProps) {
  /**
   * Apply the suggestion - replace first occurrence of evidence with suggestion
   */
  const handleApply = () => {
    onApply();
  };

  /**
   * Reject the suggestion - mark as rejected, don't modify content
   */
  const handleReject = () => {
    onReject();
  };

  /**
   * Get severity badge class
   */
  const getSeverityClass = (): string => {
    switch (finding.severity) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  /**
   * Get severity text
   */
  const getSeverityText = (): string => {
    switch (finding.severity) {
      case 'high':
        return 'High';
      case 'medium':
        return 'Medium';
      case 'low':
        return 'Low';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-5 border border-gray-200 mb-3">
      <div className="flex items-start justify-between">
        <div className="flex-1 pr-4">
          {/* Summary line */}
          <p className="text-sm text-gray-600 mb-2 line-clamp-1">
            {finding.id}: {getSeverityText()} issue
          </p>

          {/* Severity badge */}
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getSeverityClass()}`}>
            {getSeverityText()}
          </span>

          {/* Evidence quote block */}
          <blockquote className="mt-3 pl-3 border-l-4 border-gray-300 bg-gray-50 rounded-md">
            <p className="text-sm text-gray-700 break-normal">{finding.evidence}</p>
          </blockquote>

          {/* Explanation */}
          <p className="mt-2 text-sm text-gray-600 break-normal">
            {finding.explanation}
          </p>

          {/* Suggested rewrite */}
          <p className="mt-2 text-sm text-gray-700 break-normal">
            Suggested rewrite: {finding.suggestion}
          </p>
        </div>

        {/* Apply/Reject actions */}
        <div className="flex flex-col items-end space-y-1">
          {isApplied ? (
            <span className="text-green-600 text-xs font-medium">
              Applied
            </span>
          ) : (
            <button
              onClick={handleApply}
              disabled={isRejected || isApplied}
              className={`px-3 py-1 rounded text-xs font-medium ${
                isApplied || isRejected
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
              type="button"
            >
              Apply
            </button>
          )}

          {isRejected ? (
            <span className="text-red-600 text-xs font-medium">
              Rejected
            </span>
          ) : (
            <button
              onClick={handleReject}
              disabled={isApplied}
              className={`px-3 py-1 rounded text-xs font-medium ${
                isApplied
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-red-600 text-white hover:bg-red-700'}
              }`}
              type="button"
            >
              Reject
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default FindingCard;
