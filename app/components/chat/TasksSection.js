'use client';

import { useState, useEffect } from 'react';
import TaskPreview from './TaskPreview';
import { subscribeToTasksByChat, toggleTaskComplete, deleteTask } from '../../lib/firestore';

export default function TasksSection({ chatId, chatType, user }) {
  const [tasks, setTasks] = useState([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    if (!chatId || !chatType) return;

    const unsubscribe = subscribeToTasksByChat(chatId, chatType, (loadedTasks) => {
      setTasks(loadedTasks);
    });

    return () => unsubscribe();
  }, [chatId, chatType]);

  const handleToggleComplete = async (taskId) => {
    try {
      await toggleTaskComplete(taskId, user.uid, user.displayName || user.email);
    } catch (error) {
      console.error('Error toggling task:', error);
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      await deleteTask(taskId);
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  // Filter tasks
  const openTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);
  const displayTasks = showCompleted ? tasks : openTasks;

  // Don't render if no tasks
  if (tasks.length === 0) {
    return null;
  }

  return (
    <div className="mx-3 mb-3 rounded-2xl bg-black/20 border border-white/10 overflow-hidden">
      {/* Header */}
      <button 
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">📋</span>
          <span className="text-sm font-medium text-white">
            {openTasks.length} open task{openTasks.length !== 1 ? 's' : ''}
          </span>
          {completedTasks.length > 0 && (
            <span className="text-xs text-gray-500">
              ({completedTasks.length} done)
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {completedTasks.length > 0 && (
            <button
              className="text-xs text-purple-400 hover:text-purple-300 px-2 py-1 rounded-lg hover:bg-purple-500/20 transition-all"
              onClick={(e) => {
                e.stopPropagation();
                setShowCompleted(!showCompleted);
              }}
            >
              {showCompleted ? 'Hide done' : 'Show done'}
            </button>
          )}
          <span className={`text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-0' : '-rotate-90'}`}>
            ▼
          </span>
        </div>
      </button>
      
      {/* Tasks List */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-2">
          {displayTasks.length === 0 ? (
            <div className="text-center py-4 text-gray-500 text-sm">
              All tasks completed! 🎉
            </div>
          ) : (
            displayTasks.map(task => (
              <TaskPreview
                key={task.id}
                task={task}
                onToggleComplete={handleToggleComplete}
                onDelete={handleDeleteTask}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
