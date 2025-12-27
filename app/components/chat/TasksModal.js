'use client'

import { useEffect, useState } from 'react'
import { subscribeToTasksByChat, toggleTaskComplete, getDMId } from '../../lib/firestore'
import { format } from 'date-fns'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { ChevronDown, ChevronUp, MoreHorizontal } from 'lucide-react'

export default function TasksModal({ isOpen, onClose, user, currentChat }) {
  const [tasks, setTasks] = useState([])
  const [showCompleted, setShowCompleted] = useState(true)

  useEffect(() => {
    if (!isOpen || !user || !currentChat) return

    const chatId =
      currentChat.type === 'dm' ? getDMId(user.uid, currentChat.id) : currentChat.id

    const unsubscribe = subscribeToTasksByChat(chatId, currentChat.type, loadedTasks => {
      setTasks(loadedTasks)
    })

    return () => unsubscribe()
  }, [isOpen, user, currentChat])

  const formatDueDate = (dueDate) => {
    if (!dueDate) return null
    try {
      if (typeof dueDate === 'string' && !dueDate.includes('-') && !dueDate.includes('/')) {
        return dueDate
      }
      const date = new Date(dueDate)
      if (isNaN(date.getTime())) return dueDate
      return format(date, 'd MMM, h:mm a')
    } catch {
      return dueDate
    }
  }

  const handleToggle = async (e, taskId) => {
    e.stopPropagation()
    try {
      await toggleTaskComplete(taskId, user.uid, user.displayName || user.email)
    } catch (error) {
      console.error('Error toggling task:', error)
    }
  }

  const openTasks = tasks.filter(t => !t.completed)
  const completedTasks = tasks.filter(t => t.completed)

  const chatName = currentChat?.type === 'dm' ? currentChat.name : `#${currentChat?.name}`

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className='w-full max-w-[440px] p-0 gap-0 border-0 rounded-[32px] overflow-hidden shadow-2xl'
        style={{ backgroundColor: '#141414' }}
      >
        {/* Header */}
        <div className='px-8 pt-8 pb-6'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-4'>
              <div 
                className='w-11 h-11 rounded-2xl flex items-center justify-center text-white text-xl'
                style={{ background: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)' }}
              >
                ✓
              </div>
              <div className='flex items-center gap-2.5'>
                <span className='text-white font-semibold text-xl'>{chatName}</span>
                <span style={{ color: 'rgba(255,255,255,0.4)' }} className='text-lg'>{openTasks.length}</span>
                <ChevronDown className='w-4 h-4' style={{ color: 'rgba(255,255,255,0.4)' }} />
              </div>
            </div>
            <button 
              className='w-9 h-9 rounded-full flex items-center justify-center transition-colors hover:bg-white/10'
              style={{ color: 'rgba(255,255,255,0.5)' }}
            >
              <MoreHorizontal className='w-5 h-5' />
            </button>
          </div>
        </div>

        {/* Tasks list */}
        <div className='px-8 pb-10 max-h-[65vh] overflow-y-auto'>
          {openTasks.length === 0 && completedTasks.length === 0 ? (
            <div className='text-center py-20'>
              <div className='text-5xl mb-4'>🎉</div>
              <p style={{ color: 'rgba(255,255,255,0.5)' }} className='text-base'>No tasks yet</p>
              <p style={{ color: 'rgba(255,255,255,0.25)' }} className='text-sm mt-2'>Tasks are auto-detected from messages</p>
            </div>
          ) : (
            <div className='space-y-2'>
              {/* Open tasks */}
              {openTasks.map(task => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onToggle={handleToggle}
                  formatDueDate={formatDueDate}
                />
              ))}

              {/* Hide/Show done toggle */}
              {completedTasks.length > 0 && (
                <>
                  <button
                    onClick={() => setShowCompleted(!showCompleted)}
                    className='flex items-center gap-2 py-5 transition-colors'
                    style={{ color: 'rgba(255,255,255,0.4)' }}
                  >
                    {showCompleted ? (
                      <>
                        <ChevronUp className='w-4 h-4' />
                        <span className='text-[15px]'>Hide {completedTasks.length} done</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className='w-4 h-4' />
                        <span className='text-[15px]'>Show {completedTasks.length} done</span>
                      </>
                    )}
                  </button>

                  {/* Completed tasks */}
                  {showCompleted && completedTasks.map(task => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onToggle={handleToggle}
                      formatDueDate={formatDueDate}
                    />
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function TaskItem({ task, onToggle, formatDueDate }) {
  const dueDate = formatDueDate(task.dueDate)
  const hasDueDate = !!dueDate && !task.completed

  return (
    <div
      className='flex items-start gap-4 py-3 cursor-pointer group'
      onClick={(e) => onToggle(e, task.id)}
    >
      {/* Checkbox */}
      <div className='flex-shrink-0 mt-0.5'>
        {task.completed ? (
          <div 
            className='w-7 h-7 rounded-full flex items-center justify-center'
            style={{ background: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)' }}
          >
            <svg
              className='w-4 h-4 text-white'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
              strokeWidth={3}
            >
              <path strokeLinecap='round' strokeLinejoin='round' d='M5 13l4 4L19 7' />
            </svg>
          </div>
        ) : (
          <div 
            className='w-7 h-7 rounded-full border-2 transition-colors group-hover:border-white/40'
            style={{ borderColor: 'rgba(255,255,255,0.25)' }}
          />
        )}
      </div>

      {/* Task content */}
      <div className='flex-1 min-w-0 flex items-start justify-between gap-4'>
        <span
          className='text-[17px] leading-relaxed pt-0.5'
          style={{
            color: task.completed ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.95)',
            textDecoration: task.completed ? 'line-through' : 'none',
          }}
        >
          {task.title}
        </span>

        {/* Due date pill */}
        {hasDueDate && (
          <div 
            className='flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full text-[13px] mt-0.5'
            style={{ 
              backgroundColor: 'rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.6)'
            }}
          >
            <span 
              className='w-2 h-2 rounded-full'
              style={{ backgroundColor: '#ef4444' }}
            />
            {dueDate}
          </div>
        )}
      </div>
    </div>
  )
}
