import { ErrorState, LoadingBlock } from './Feedback.jsx';

export default function QueryContent({ query, children, className = '' }) {
  return <div aria-busy={query.isFetching} className={className}>
    {query.isPending ? <LoadingBlock /> : query.error ? <ErrorState message={query.error.message} onRetry={query.refetch} /> : children}
  </div>;
}
