/**
 * Approval panel component
 * Handles approval workflow actions
 */
function ApprovalPanel({
  status,
  isApproverMode,
  onSubmit,
  onApprove,
  onRequestChanges
}: {
  status: string;
  isApproverMode: boolean;
  onSubmit: () => void;
  onApprove: () => void;
  onRequestChanges: () => void;
}) {
  // Submit for approval button - only available for draft or changes_requested
  const showSubmit = status === 'draft' || status === 'changes_requested';

  return (
    <div>
      {isApproverMode && status === 'pending_approval' && (
        <>
          <button
            onClick={onApprove}
            disabled={!showSubmit}
            className="bg-green-600 text-white hover:bg-green-700 px-4 py-2 rounded font-medium mr-2"
          >
            Approve
          </button>
          <button
            onClick={onRequestChanges}
            disabled={!showSubmit}
            className="bg-red-600 text-white hover:bg-red-700 px-4 py-2 rounded font-medium"
          >
            Request changes
          </button>
        </>
      )}
      {showSubmit && (
        <button
          onClick={onSubmit}
          disabled={!isApproverMode}
          className="bg-orange-600 text-white hover:bg-orange-700 px-4 py-2 rounded font-medium"
        >
          Submit for approval
        </button>
      )}
    </div>
  );
}

export default ApprovalPanel;
