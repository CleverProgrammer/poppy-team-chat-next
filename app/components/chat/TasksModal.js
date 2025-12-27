'use client'

import { useEffect, useState } from 'react'
import { subscribeToTasksByChat, toggleTaskComplete, getDMId } from '../../lib/firestore'
import { formatDistanceToNow } from 'date-fns'

export default function TasksModal({ isOpen, onClose, user, currentChat }) {
  const [tasks, setTasks] = useState([])
  const [filter, setFilter] = useState('open')

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

  const getPriorityStyles = priority => {
    switch (priority) {
      case 'critical':
        return 'bg-red-500/10 text-red-400 border-red-500/20'
      case 'high':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/20'
      case 'low':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      default:
        return ''
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
      className='fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4'
      onClick={onClose}
    >
      <div
        className='bg-[#0a0a0f] border border-white/10 rounded-2xl w-full max-w-md max-h-[75vh] flex flex-col overflow-hidden'
        style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className='px-5 pt-5 pb-4'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-3'>
              <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-lg'>
                ✓
              </div>
              <div>
                <h2 className='text-base font-semibold text-white'>Tasks</h2>
                <p className='text-xs text-white/40'>
                  {currentChat.type === 'dm' ? currentChat.name : `#${currentChat.name}`}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className='w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all'
            >
              <svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
              </svg>
            </button>
          </div>

          {/* Filter tabs */}
          <div className='flex gap-1 mt-4 p-1 bg-white/5 rounded-lg'>
            {[
              { key: 'open', label: 'Open', count: openCount },
              { key: 'completed', label: 'Done', count: completedCount },
              { key: 'all', label: 'All', count: tasks.length },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-all ${
                  filter === tab.key
                    ? 'bg-white/10 text-white'
                    : 'text-white/40 hover:text-white/60'
                }`}
              >
                {tab.label}
                <span className='ml-1 opacity-50'>({tab.count})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tasks list */}
        <div className='flex-1 overflow-y-auto px-3 pb-3'>
          {filteredTasks.length === 0 ? (
            <div className='text-center py-16'>
              <div className='w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/5 flex items-center justify-center'>
                <span className='text-3xl'>
                  {filter === 'open' ? '🎉' : filter === 'completed' ? '📝' : '💬'}
                </span>
              </div>
              <p className='text-white/60 text-sm'>
                {filter === 'open'
                  ? 'All caught up!'
                  : filter === 'completed'
                  ? 'No completed tasks'
                  : 'No tasks yet'}
              </p>
              <p className='text-white/30 text-xs mt-1'>
                Tasks are auto-detected from messages
              </p>
            </div>
          ) : (
            <div className='space-y-1'>
              {filteredTasks.map(task => (
                <div
                  key={task.id}
                  className={`group flex items-start gap-3 p-3 rounded-xl transition-all cursor-pointer ${
                    task.completed
                      ? 'opacity-50 hover:opacity-70'
                      : 'hover:bg-white/5'
                  }`}
                  onClick={() => handleToggle(task.id)}
                >
                  {/* Checkbox */}
                  <div
                    className={`flex-shrink-0 w-5 h-5 mt-0.5 rounded-md border-2 flex items-center justify-center transition-all ${
                      task.completed
                        ? 'bg-emerald-500 border-emerald-500'
                        : 'border-white/20 group-hover:border-violet-400'
                    }`}
                  >
                    {task.completed && (
                      <svg className='w-3 h-3 text-white' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={3} d='M5 13l4 4L19 7' />
                      </svg>
                    )}
                  </div>

                  {/* Task content */}
                  <div className='flex-1 min-w-0'>
                    <p className={`text-sm leading-snug ${task.completed ? 'text-white/40 line-through' : 'text-white/90'}`}>
                      {task.title}
                    </p>
                    
                    <div className='flex flex-wrap items-center gap-1.5 mt-2'>
                      {/* Priority badge */}
                      {task.priority && task.priority !== 'medium' && (
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${getPriorityStyles(task.priority)}`}>
                          {task.priority}
                        </span>
                      )}
                      
                      {/* Assignee */}
                      {task.assignedTo && (
                        <span className='text-[10px] text-violet-400/70'>
                          → {task.assignedTo.split(' ')[0]}
                        </span>
                      )}
                      
                      {/* Due date */}
                      {task.dueDate && (
                        <span className='text-[10px] text-amber-400/70'>
                          {task.dueDate}
                        </span>
                      )}
                      
                      {/* Time */}
                      <span className='text-[10px] text-white/20'>
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
