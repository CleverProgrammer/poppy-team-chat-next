'use client';

import { formatDistanceToNow } from 'date-fns';

export default function TaskPreview({ task, onToggleComplete, onDelete }) {
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Just now';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return 'Just now';
    }
  };

  const getPriorityLabel = (priority) => {
    switch (priority) {
      case 'critical': return '🔴';
      case 'high': return '🟠';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  };

  const handleCheckboxClick = (e) => {
    e.stopPropagation();
    if (onToggleComplete) {
      onToggleComplete(task.id);
    }
  };

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    if (onDelete && window.confirm('Delete this task?')) {
      onDelete(task.id);
    }
  };

  return (
    <div className={`
      flex items-start gap-3 p-3 rounded-xl transition-all duration-200
      ${task.completed 
        ? 'bg-white/5 opacity-60' 
        : 'bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20'
      }
      hover:bg-white/10
    `}>
      {/* Checkbox */}
      <button 
        onClick={handleCheckboxClick}
        className={`
          flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center
          transition-all duration-200 mt-0.5
          ${task.completed 
            ? 'bg-green-500 border-green-500 text-white' 
            : 'border-purple-400/50 hover:border-purple-400 hover:bg-purple-500/20'
          }
        `}
      >
        {task.completed && (
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
          <span>📋 Task</span>
          <span title={task.priority}>{getPriorityLabel(task.priority)}</span>
          {task.assignee && (
            <span className="text-purple-400">@{task.assignee}</span>
          )}
        </div>
        
        <div className={`text-sm text-white font-medium ${task.completed ? 'line-through text-gray-500' : ''}`}>
          {task.title}
        </div>
        
        <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
          <span>from {task.assigner}</span>
          <span>•</span>
          <span>{formatTimestamp(task.createdAt)}</span>
          {task.completed && task.completedBy && (
            <>
              <span>•</span>
              <span className="text-green-500">✓ {task.completedBy}</span>
            </>
          )}
        </div>
      </div>
      
      {/* Delete button */}
      <button 
        onClick={handleDeleteClick}
        className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center
          text-gray-500 hover:text-red-400 hover:bg-red-500/20 transition-all"
        title="Delete task"
      >
        ×
      </button>
    </div>
  );
}
