/**
 * Finding card component
 * Displays a single finding with severity badge, evidence, and action buttons
 */
import { Finding } from '../types';

interface FindingCardProps {
  finding: Finding;
  onApply: () => void;
  onReject: () => void;
  isApplied?: boolean;
  isRejected?: boolean;
}

function FindingCard({ finding, onApply, onReject, isApplied, isRejected }: FindingCardProps) {
  // Determine decision state from props passed down from App
  const isAppliedProp = isApplied === true;
  const isRejectedProp = isRejected === true;

  // Decision is made if either prop indicates a decision
  const hasDecision = isAppliedProp || isRejectedProp;
  const decision = isAppliedProp ? 'applied' : isRejectedProp ? 'rejected' : undefined;

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-4">
      {/* Summary/decision at top */}
      {hasDecision && (
        <div className="mb-4 p-3 rounded">
          {decision === 'applied' && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-3 py-2 rounded">
              <p className="font-medium">Applied</p>
              <p className="text-sm">{finding.suggestion}</p>
            </div>
          )}
          {decision === 'rejected' && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded">
              <p className="font-medium">Rejected</p>
              <p className="text-sm text-red-600 opacity-80">— original text preserved</p>
            </div>
          )}
        </div>
      )}

      {/* Severity badge */}
      <div className="mb-4">
        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mr-2 ${finding.severity === 'high' ? 'bg-red-100 text-red-800' : finding.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>
          {finding.severity}
        </span>
      </div>

      {/* Evidence quote block */}
      <blockquote className="border-l-4 border-indigo-500 pl-4 mb-4 rounded">
        <p className="text-gray-700 mb-2">{finding.evidence}</p>
      </blockquote>

      {/* Why it matters / explanation */}
      <div className="mb-4">
        <p className="text-sm font-medium text-gray-600 mb-1">Why it matters</p>
        <p className="text-gray-700">{finding.explanation}</p>
      </div>

      {/* Suggested rewrite box */}
      <div className="bg-green-50 border border-green-200 rounded p-4 mb-5">
        <p className="text-sm font-medium text-green-700 mb-1">Suggested rewrite</p>
        <p className="text-gray-800 whitespace-pre-wrap">{finding.suggestion}</p>
      </div>

      {/* Action buttons */}
      <div>
        {/* Buttons only show when no decision has been made */}
        {!hasDecision && (
          <>
            <button
              onClick={onApply}
              disabled={isAppliedProp || isRejectedProp}
              className={`px-3 py-1 rounded font-medium mr-2 ${finding.severity === 'high' ? 'bg-red-200 text-red-700' : finding.severity === 'medium' ? 'bg-yellow-200 text-yellow-700' : 'bg-blue-200 text-blue-700'}`}
            >
              Apply
            </button>
            <button
              onClick={onReject}
              disabled={isAppliedProp || isRejectedProp}
              className={`px-3 py-1 rounded font-medium ${finding.severity === 'high' ? 'bg-red-200 text-red-700' : finding.severity === 'medium' ? 'bg-yellow-200 text-yellow-700' : 'bg-blue-200 text-blue-700'}`}
            >
              Reject
            </button>
          </>
        )}

        {/* After a decision shows the result */}
        {hasDecision && (
          <span className="text-xs text-gray-500">
            {decision === 'applied' ? 'Applied' : 'Rejected'}
          </span>
        )}
      </div>
    </div>
  );
}

export default FindingCard;
