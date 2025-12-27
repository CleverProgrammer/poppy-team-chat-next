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
        className='w-full max-w-[520px] p-0 gap-0 border-0 rounded-[32px] overflow-hidden shadow-2xl [&>button]:hidden'
        style={{ backgroundColor: '#1a1625' }}
      >
        {/* Header - centered with lots of padding */}
        <div className='px-16 pt-14 pb-10'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-3'>
              <span className='text-white font-semibold text-xl'>{chatName}</span>
              <span style={{ color: 'rgba(167,139,250,0.6)' }} className='text-lg'>{openTasks.length}</span>
              <ChevronDown className='w-4 h-4' style={{ color: 'rgba(167,139,250,0.5)' }} />
            </div>
            <button 
              className='w-10 h-10 rounded-full flex items-center justify-center transition-colors hover:bg-white/10'
              style={{ color: 'rgba(167,139,250,0.6)' }}
            >
              <MoreHorizontal className='w-6 h-6' />
            </button>
          </div>
        </div>

        {/* Tasks list - generous padding */}
        <div className='px-16 pb-20 max-h-[60vh] overflow-y-auto'>
          {openTasks.length === 0 && completedTasks.length === 0 ? (
            <div className='text-center py-24'>
              <div className='text-6xl mb-5'>🎉</div>
              <p style={{ color: 'rgba(167,139,250,0.7)' }} className='text-lg'>No tasks yet</p>
              <p style={{ color: 'rgba(167,139,250,0.4)' }} className='text-base mt-2'>Tasks are auto-detected from messages</p>
            </div>
          ) : (
            <div>
              {/* Open tasks */}
              {openTasks.map((task) => (
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
                    className='flex items-center gap-2 py-10 transition-colors hover:opacity-80'
                    style={{ color: 'rgba(167,139,250,0.5)' }}
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
                  {showCompleted && completedTasks.map((task) => (
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
      className='flex items-start gap-6 cursor-pointer group'
      style={{ paddingTop: '12px', paddingBottom: '12px' }}
      onClick={(e) => onToggle(e, task.id)}
    >
      {/* Checkbox - rounded square */}
      <div className='flex-shrink-0 mt-1'>
        {task.completed ? (
          <div 
            className='w-8 h-8 rounded-lg flex items-center justify-center'
            style={{ background: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)' }}
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
            className='w-8 h-8 rounded-lg border-2 transition-colors group-hover:border-violet-400/60'
            style={{ borderColor: 'rgba(167,139,250,0.3)' }}
          />
        )}
      </div>

      {/* Task content */}
      <div className='flex-1 min-w-0 flex items-start justify-between gap-6'>
        <span
          className='text-[17px] leading-relaxed pt-1'
          style={{
            color: task.completed ? 'rgba(167,139,250,0.4)' : 'rgba(255,255,255,0.95)',
          }}
        >
          {task.title}
        </span>

        {/* Due date pill */}
        {hasDueDate && (
          <div 
            className='flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-[13px] mt-1'
            style={{ 
              backgroundColor: 'rgba(167,139,250,0.1)',
              color: 'rgba(167,139,250,0.8)'
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
