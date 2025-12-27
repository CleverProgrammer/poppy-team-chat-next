'use client'

import { useEffect, useState } from 'react'
import { subscribeToTasksByChat, toggleTaskComplete, getDMId } from '../../lib/firestore'
import { formatDistanceToNow } from 'date-fns'

export default function TasksModal({ isOpen, onClose, user, currentChat }) {
  const [tasks, setTasks] = useState([])
  const [filter, setFilter] = useState('open') // 'open', 'completed', 'all'

  useEffect(() => {
    if (!isOpen || !user || !currentChat) return

    const chatId =
      currentChat.type === 'dm' ? getDMId(user.uid, currentChat.id) : currentChat.id

    const unsubscribe = subscribeToTasksByChat(chatId, currentChat.type, loadedTasks => {
      setTasks(loadedTasks)
    })

    return () => unsubscribe()
  }, [isOpen, user, currentChat])

  if (!isOpen) return null

  const formatTimestamp = timestamp => {
    if (!timestamp) return ''
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
      return formatDistanceToNow(date, { addSuffix: true })
    } catch {
      return ''
    }
  }

  const handleToggle = async taskId => {
    try {
      await toggleTaskComplete(taskId, user.uid, user.displayName || user.email)
    } catch (error) {
      console.error('Error toggling task:', error)
    }
  }

  const getPriorityColor = priority => {
    switch (priority) {
      case 'critical':
        return 'text-red-400'
      case 'high':
        return 'text-orange-400'
      case 'medium':
        return 'text-yellow-400'
      case 'low':
        return 'text-green-400'
      default:
        return 'text-gray-400'
    }
  }

  const filteredTasks = tasks.filter(task => {
    if (filter === 'open') return !task.completed
    if (filter === 'completed') return task.completed
    return true
  })

  const openCount = tasks.filter(t => !t.completed).length
  const completedCount = tasks.filter(t => t.completed).length

  return (
    <div
      className='fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4'
      onClick={onClose}
    >
      <div
        className='bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl'
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className='flex items-center justify-between p-4 border-b border-gray-800'>
          <div>
            <h2 className='text-lg font-semibold text-white'>📋 Tasks</h2>
            <p className='text-xs text-gray-400'>
              {currentChat.type === 'dm' ? `With ${currentChat.name}` : `#${currentChat.name}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className='text-gray-400 hover:text-white transition-colors text-xl'
          >
            ✕
          </button>
        </div>

        {/* Filter tabs */}
        <div className='flex gap-1 p-3 border-b border-gray-800'>
          <button
            onClick={() => setFilter('open')}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              filter === 'open'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            Open ({openCount})
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              filter === 'completed'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            Completed ({completedCount})
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              filter === 'all'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            All ({tasks.length})
          </button>
        </div>

        {/* Tasks list */}
        <div className='flex-1 overflow-y-auto p-3'>
          {filteredTasks.length === 0 ? (
            <div className='text-center py-12'>
              <div className='text-4xl mb-3'>✨</div>
              <p className='text-gray-400'>
                {filter === 'open'
                  ? 'No open tasks!'
                  : filter === 'completed'
                  ? 'No completed tasks yet'
                  : 'No tasks in this conversation'}
              </p>
              <p className='text-xs text-gray-500 mt-1'>
                Tasks are auto-detected from your messages
              </p>
            </div>
          ) : (
            <div className='space-y-2'>
              {filteredTasks.map(task => (
                <div
                  key={task.id}
                  className={`flex items-start gap-3 p-3 rounded-xl transition-all ${
                    task.completed
                      ? 'bg-gray-800/50 opacity-60'
                      : 'bg-gray-800 hover:bg-gray-750'
                  }`}
                >
                  {/* Checkbox */}
                  <button
                    onClick={() => handleToggle(task.id)}
                    className={`flex-shrink-0 w-5 h-5 mt-0.5 rounded-full border-2 flex items-center justify-center transition-all ${
                      task.completed
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'border-gray-500 hover:border-indigo-500'
                    }`}
                  >
                    {task.completed && (
                      <svg className='w-3 h-3' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={3} d='M5 13l4 4L19 7' />
                      </svg>
                    )}
                  </button>

                  {/* Task content */}
                  <div className='flex-1 min-w-0'>
                    <p
                      className={`text-sm ${
                        task.completed ? 'text-gray-500 line-through' : 'text-white'
                      }`}
                    >
                      {task.title}
                    </p>
                    <div className='flex flex-wrap items-center gap-2 mt-1'>
                      {/* Assignee */}
                      {task.assignedTo && (
                        <span className='text-xs text-purple-400'>
                          @{task.assignedTo}
                        </span>
                      )}
                      {/* Priority */}
                      {task.priority && task.priority !== 'medium' && (
                        <span className={`text-xs font-medium ${getPriorityColor(task.priority)}`}>
                          {task.priority}
                        </span>
                      )}
                      {/* Due date */}
                      {task.dueDate && (
                        <span className='text-xs text-yellow-400'>
                          📅 {task.dueDate}
                        </span>
                      )}
                      {/* Created time */}
                      <span className='text-xs text-gray-500'>
                        {formatTimestamp(task.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

