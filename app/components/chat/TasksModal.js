'use client'

import { useEffect, useState, useRef } from 'react'
import { subscribeToTasksByChat, toggleTaskComplete, getDMId } from '../../lib/firestore'
import { format } from 'date-fns'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { ChevronDown, ChevronUp } from 'lucide-react'

export default function TasksModal({ isOpen, onClose, user, currentChat, allUsers = [] }) {
  const [tasks, setTasks] = useState([])
  const [showCompleted, setShowCompleted] = useState(false)
  // Track tasks that were just completed (for animation)
  const [justCompletedIds, setJustCompletedIds] = useState(new Set())
  // Track tasks that are animating out
  const [animatingOutIds, setAnimatingOutIds] = useState(new Set())

  useEffect(() => {
    if (!isOpen || !user || !currentChat) return

    const chatId =
      currentChat.type === 'dm' ? getDMId(user.uid, currentChat.id) : currentChat.id

    const unsubscribe = subscribeToTasksByChat(chatId, currentChat.type, loadedTasks => {
      setTasks(loadedTasks)
    })

    return () => unsubscribe()
  }, [isOpen, user, currentChat])

  // Clean up animation states when modal closes
  useEffect(() => {
    if (!isOpen) {
      setJustCompletedIds(new Set())
      setAnimatingOutIds(new Set())
    }
  }, [isOpen])

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

  const handleToggle = async (e, taskId, isCurrentlyCompleted) => {
    e.stopPropagation()
    
    // If completing a task (not uncompleting), trigger the animation
    if (!isCurrentlyCompleted) {
      // Add to just completed
      setJustCompletedIds(prev => new Set([...prev, taskId]))
      
      // After 1.5 seconds, start the slide-out animation
      setTimeout(() => {
        setAnimatingOutIds(prev => new Set([...prev, taskId]))
        
        // After slide animation, remove from tracking
        setTimeout(() => {
          setJustCompletedIds(prev => {
            const next = new Set(prev)
            next.delete(taskId)
            return next
          })
          setAnimatingOutIds(prev => {
            const next = new Set(prev)
            next.delete(taskId)
            return next
          })
        }, 500)
      }, 1500)
    }
    
    try {
      await toggleTaskComplete(taskId, user.uid, user.displayName || user.email)
    } catch (error) {
      console.error('Error toggling task:', error)
    }
  }

  // Get assignee photo from allUsers
  const getAssigneePhoto = (task) => {
    if (!task.assignedToUserId) return null
    const assignee = allUsers.find(u => u.uid === task.assignedToUserId)
    return assignee?.photoURL || null
  }

  // Show "just completed" tasks in the open list until animation finishes
  const openTasks = tasks.filter(t => !t.completed || justCompletedIds.has(t.id))
  const completedTasks = tasks.filter(t => t.completed && !justCompletedIds.has(t.id))

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className='w-full max-w-[600px] p-0 gap-0 border-0 rounded-[28px] overflow-hidden shadow-2xl [&>button]:hidden'
        style={{ backgroundColor: '#1a1625' }}
      >
        {/* Simple header - just "Tasks" */}
        <div style={{ padding: '32px 40px 24px 40px' }}>
          <span className='text-white font-semibold text-xl'>Tasks</span>
        </div>

        {/* Tasks list */}
        <div style={{ padding: '0 40px 40px 40px', maxHeight: '70vh', overflowY: 'auto' }}>
          {openTasks.length === 0 && completedTasks.length === 0 ? (
            <div className='text-center' style={{ padding: '60px 0' }}>
              <div className='text-5xl mb-4'>✨</div>
              <p style={{ color: 'rgba(167,139,250,0.7)' }} className='text-lg'>No tasks yet</p>
              <p style={{ color: 'rgba(167,139,250,0.4)' }} className='text-sm mt-2'>Tasks are auto-detected from messages</p>
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
                  assigneePhoto={getAssigneePhoto(task)}
                  justCompleted={justCompletedIds.has(task.id)}
                  animatingOut={animatingOutIds.has(task.id)}
                />
              ))}

              {/* Hide/Show done toggle */}
              {completedTasks.length > 0 && (
                <>
                  <button
                    onClick={() => setShowCompleted(!showCompleted)}
                    className='flex items-center gap-2 transition-colors hover:opacity-80'
                    style={{ color: 'rgba(167,139,250,0.5)', padding: '20px 0' }}
                  >
                    {showCompleted ? (
                      <ChevronUp className='w-4 h-4' />
                    ) : (
                      <ChevronDown className='w-4 h-4' />
                    )}
                    <span className='text-[14px]'>
                      {showCompleted ? 'Hide' : 'Show'} {completedTasks.length} done
                    </span>
                  </button>

                  {/* Completed tasks */}
                  {showCompleted && completedTasks.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onToggle={handleToggle}
                      formatDueDate={formatDueDate}
                      assigneePhoto={getAssigneePhoto(task)}
                      justCompleted={false}
                      animatingOut={false}
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

function TaskItem({ task, onToggle, formatDueDate, assigneePhoto, justCompleted, animatingOut }) {
  const dueDate = formatDueDate(task.dueDate)
  const hasDueDate = !!dueDate && !task.completed

  return (
    <div
      className='flex items-start gap-5 cursor-pointer group relative transition-all duration-500'
      style={{ 
        padding: '14px 0',
        opacity: animatingOut ? 0 : 1,
        transform: animatingOut ? 'translateY(20px)' : 'translateY(0)',
      }}
      onClick={(e) => onToggle(e, task.id, task.completed)}
    >
      {/* Checkbox with animation */}
      <div className='flex-shrink-0 relative'>
        {(task.completed || justCompleted) ? (
          <div className='relative'>
            {/* The checkbox */}
            <div 
              className={`w-7 h-7 rounded-lg flex items-center justify-center ${justCompleted ? 'animate-check-pop' : ''}`}
              style={{ background: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)' }}
            >
              <svg
                className={`w-4 h-4 text-white ${justCompleted ? 'animate-check-draw' : ''}`}
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
                strokeWidth={3}
                strokeLinecap='round'
                strokeLinejoin='round'
              >
                <path d='M5 13l4 4L19 7' />
              </svg>
            </div>
            
            {/* Sparkle particles */}
            {justCompleted && (
              <>
                <span className='absolute animate-sparkle-1' style={{ top: '-8px', left: '50%', fontSize: '12px' }}>✨</span>
                <span className='absolute animate-sparkle-2' style={{ top: '0', right: '-12px', fontSize: '10px' }}>⭐</span>
                <span className='absolute animate-sparkle-3' style={{ bottom: '-6px', left: '-8px', fontSize: '11px' }}>✨</span>
                <span className='absolute animate-sparkle-4' style={{ top: '-4px', left: '-10px', fontSize: '9px' }}>💫</span>
              </>
            )}
          </div>
        ) : (
          <div 
            className='w-7 h-7 rounded-lg border-2 transition-colors group-hover:border-violet-400/60'
            style={{ borderColor: 'rgba(167,139,250,0.3)' }}
          />
        )}
      </div>

      {/* Task content */}
      <div className='flex-1 min-w-0 flex items-start justify-between gap-4'>
        <span
          className={`text-[16px] leading-relaxed transition-all duration-300 ${justCompleted ? 'text-violet-400/60' : ''}`}
          style={{
            color: (task.completed && !justCompleted) ? 'rgba(167,139,250,0.4)' : justCompleted ? undefined : 'rgba(255,255,255,0.95)',
          }}
        >
          {task.title}
        </span>

        <div className='flex items-center gap-3 flex-shrink-0'>
          {/* Assignee photo - subtle and semi-transparent */}
          {assigneePhoto && (
            <img 
              src={assigneePhoto} 
              alt=''
              className='w-6 h-6 rounded-full transition-opacity duration-300'
              style={{ opacity: (task.completed || justCompleted) ? 0.3 : 0.5 }}
            />
          )}

          {/* Due date pill */}
          {hasDueDate && !justCompleted && (
            <div 
              className='flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px]'
              style={{ 
                backgroundColor: 'rgba(167,139,250,0.1)',
                color: 'rgba(167,139,250,0.8)'
              }}
            >
              <span 
                className='w-1.5 h-1.5 rounded-full'
                style={{ backgroundColor: '#ef4444' }}
              />
              {dueDate}
            </div>
          )}
        </div>
      </div>

      {/* CSS for animations */}
      <style jsx>{`
        @keyframes check-pop {
          0% { transform: scale(1); }
          30% { transform: scale(1.3); }
          50% { transform: scale(0.9); }
          70% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
        
        @keyframes check-draw {
          0% { stroke-dashoffset: 24; opacity: 0; }
          30% { opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 1; }
        }
        
        @keyframes sparkle-1 {
          0% { opacity: 0; transform: translate(-50%, 0) scale(0); }
          30% { opacity: 1; transform: translate(-50%, -15px) scale(1.2); }
          100% { opacity: 0; transform: translate(-50%, -25px) scale(0); }
        }
        
        @keyframes sparkle-2 {
          0% { opacity: 0; transform: scale(0); }
          40% { opacity: 1; transform: translate(5px, -5px) scale(1.3); }
          100% { opacity: 0; transform: translate(15px, -10px) scale(0); }
        }
        
        @keyframes sparkle-3 {
          0% { opacity: 0; transform: scale(0); }
          35% { opacity: 1; transform: translate(-5px, 5px) scale(1.1); }
          100% { opacity: 0; transform: translate(-15px, 15px) scale(0); }
        }
        
        @keyframes sparkle-4 {
          0% { opacity: 0; transform: scale(0); }
          45% { opacity: 1; transform: translate(-8px, -8px) scale(1); }
          100% { opacity: 0; transform: translate(-18px, -18px) scale(0); }
        }
        
        .animate-check-pop {
          animation: check-pop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        
        .animate-check-draw {
          stroke-dasharray: 24;
          animation: check-draw 0.4s ease-out forwards;
        }
        
        .animate-sparkle-1 {
          animation: sparkle-1 0.8s ease-out forwards;
        }
        
        .animate-sparkle-2 {
          animation: sparkle-2 0.9s ease-out forwards;
          animation-delay: 0.1s;
        }
        
        .animate-sparkle-3 {
          animation: sparkle-3 0.7s ease-out forwards;
          animation-delay: 0.15s;
        }
        
        .animate-sparkle-4 {
          animation: sparkle-4 0.85s ease-out forwards;
          animation-delay: 0.05s;
        }
      `}</style>
    </div>
  )
}
