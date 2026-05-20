export default function StatusBadge({ status }) {
  if (status === 'Completed') {
    return (
      <span className="badge-completed">
        <span className="w-1.5 h-1.5 rounded-full bg-mac-green" />
        Completed
      </span>
    );
  }
  if (status === 'Pending') {
    return (
      <span className="badge-pending">
        <span className="w-1.5 h-1.5 rounded-full bg-mac-orange animate-pulse" />
        Processing
      </span>
    );
  }
  if (status === 'Failed') {
    return (
      <span className="badge bg-mac-red/15 text-mac-red border-mac-red/30">
        Failed
      </span>
    );
  }
  return <span className="badge-default">{status}</span>;
}
