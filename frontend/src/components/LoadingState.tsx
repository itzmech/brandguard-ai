type LoadingStateProps = {
  message?: string;
};

export function LoadingState({ message = 'Loading...' }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="w-12 h-12 border-4 border-primary-blue border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-text-secondary">{message}</p>
    </div>
  );
}