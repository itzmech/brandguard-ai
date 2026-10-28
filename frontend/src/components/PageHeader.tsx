type PageHeaderProps = {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  backButton?: {
    label: string;
    onClick: () => void;
  };
  badge?: React.ReactNode;
};

export function PageHeader({
  title,
  subtitle,
  action,
  backButton,
  badge,
}: PageHeaderProps) {
  return (
    <div className="mb-6">
      {backButton && (
        <button
          onClick={backButton.onClick}
          className="text-xs font-semibold text-text-secondary hover:text-primary-blue mb-2.5 inline-flex items-center gap-1.5 transition-colors group cursor-pointer"
        >
          <svg
            className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>{backButton.label}</span>
        </button>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
              {title}
            </h1>
            {badge && <div className="shrink-0">{badge}</div>}
          </div>
          {subtitle && (
            <p className="text-sm text-text-secondary mt-1">{subtitle}</p>
          )}
        </div>

        {action && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {action}
          </div>
        )}
      </div>
    </div>
  );
}
