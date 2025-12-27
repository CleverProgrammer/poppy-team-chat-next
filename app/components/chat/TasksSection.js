'use client'

import { useState, useEffect } from 'react'
import { subscribeToTasksByChat, toggleTaskComplete } from '../../lib/firestore'

export default function TasksSection({ chatId, chatType, user }) {
  const [tasks, setTasks] = useState([])
  const [isExpanded, setIsExpanded] = useState(true)
  const [filter, setFilter] = useState('all') // 'all', 'open', 'done'

  useEffect(() => {
    if (!chatId || !chatType) return

    const unsubscribe = subscribeToTasksByChat(chatId, chatType, loadedTasks => {
      setTasks(loadedTasks)
    })

    return () => unsubscribe()
  }, [chatId, chatType])

  const handleToggleComplete = async taskId => {
    try {
      await toggleTaskComplete(taskId, user.uid, user.displayName || user.email)
    } catch (error) {
      console.error('Error toggling task:', error)
    }
  }

  // Filter tasks
  const openTasks = tasks.filter(t => !t.completed)
  const completedTasks = tasks.filter(t => t.completed)
  const displayTasks = filter === 'all' ? tasks : filter === 'open' ? openTasks : completedTasks

  // Don't render if no tasks
  if (tasks.length === 0) {
    return null
  }

  return (
    <div className='mx-3 mb-3'>
      {/* Minimal Header */}
      <div className='flex items-center justify-between mb-2 px-1'>
        <div
          className='flex items-center gap-2 cursor-pointer select-none'
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span
            className={`text-[10px] text-gray-500 transition-transform duration-150 ${
              isExpanded ? 'rotate-0' : '-rotate-90'
            }`}
          >
            ▼
          </span>
          <span className='text-xs font-medium text-gray-400 tracking-wide uppercase'>Tasks</span>
          <span className='text-[10px] text-gray-600'>{openTasks.length} open</span>
        </div>

        {/* Filter Pills */}
        <div className='flex gap-1'>
          {['all', 'open', 'done'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-[10px] px-2 py-0.5 rounded-full transition-all ${
                filter === f ? 'bg-white/10 text-gray-300' : 'text-gray-600 hover:text-gray-400'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Tasks List */}
      {isExpanded && (
        <div className='space-y-1'>
          {displayTasks.length === 0 ? (
            <div className='text-center py-3 text-gray-600 text-xs'>
              {filter === 'done'
                ? 'No completed tasks'
                : filter === 'open'
                ? 'All done! ✓'
                : 'No tasks yet'}
            </div>
          ) : (
            displayTasks.map(task => (
              <div
                key={task.id}
                onClick={() => handleToggleComplete(task.id)}
                className={`group flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all ${
                  task.completed ? 'bg-white/2 hover:bg-white/4' : 'bg-white/3 hover:bg-white/6'
                }`}
              >
                {/* Checkbox */}
                <div
                  className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-all ${
                    task.completed
                      ? 'bg-green-500/20 border-green-500/50'
                      : 'border-gray-600 group-hover:border-gray-500'
                  }`}
                >
                  {task.completed && (
                    <svg
                      className='w-2.5 h-2.5 text-green-400'
                      fill='none'
                      viewBox='0 0 24 24'
                      stroke='currentColor'
                      strokeWidth={3}
                    >
                      <path strokeLinecap='round' strokeLinejoin='round' d='M5 13l4 4L19 7' />
                    </svg>
                  )}
                </div>

                {/* Task Content */}
                <div className='flex-1 min-w-0'>
                  <p
                    className={`text-sm truncate ${
                      task.completed ? 'text-gray-500 line-through' : 'text-gray-300'
                    }`}
                  >
                    {task.title}
                  </p>
                </div>

                {/* Assignee */}
                {task.assignedTo && (
                  <span className='text-[10px] text-gray-600 shrink-0'>
                    → {task.assignedTo.split(' ')[0]}
                  </span>
                )}

                {/* Priority dot */}
                {!task.completed && task.priority === 'high' && (
                  <div className='w-1.5 h-1.5 rounded-full bg-red-500/70 shrink-0' />
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
