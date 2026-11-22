import { ErrorState, LoadingBlock } from './Feedback.jsx';

export default function QueryContent({ query, children, className = '', loading }) {
  return <div aria-busy={query.isFetching} className={className}>
    {query.isPending ? (loading || <LoadingBlock />) : query.error ? <ErrorState message={query.error.message} onRetry={query.refetch} /> : children}
  </div>;
}
