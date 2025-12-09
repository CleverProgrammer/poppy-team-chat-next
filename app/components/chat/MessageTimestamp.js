'use client';

export default function MessageTimestamp({ timestamp }) {
  if (!timestamp) return null;

  const formatTimestamp = (ts) => {
    const date = ts?.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    // Less than 1 minute
    if (diffMins < 1) return 'Just now';

    // Less than 60 minutes
    if (diffMins < 60) return `${diffMins}m`;

    // Less than 24 hours
    if (diffHours < 24) {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    }

    // Less than 7 days
    if (diffDays < 7) {
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    }

    // Older than 7 days
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <span className="message-timestamp">
      {formatTimestamp(timestamp)}
    </span>
  );
}
