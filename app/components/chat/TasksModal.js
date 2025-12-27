'use client'

import { useEffect, useState } from 'react'
import { subscribeToTasksByChat, toggleTaskComplete, getDMId } from '../../lib/firestore'
import { formatDistanceToNow } from 'date-fns'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2 } from 'lucide-react'

export default function TasksModal({ isOpen, onClose, user, currentChat }) {
  const [tasks, setTasks] = useState([])
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    if (!isOpen || !user || !currentChat) return

    const chatId =
      currentChat.type === 'dm' ? getDMId(user.uid, currentChat.id) : currentChat.id

    const unsubscribe = subscribeToTasksByChat(chatId, currentChat.type, loadedTasks => {
      setTasks(loadedTasks)
    })

    return () => unsubscribe()
  }, [isOpen, user, currentChat])

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

  const filteredTasks = tasks.filter(task => {
    if (filter === 'open') return !task.completed
    if (filter === 'completed') return task.completed
    return true
  })

  const openCount = tasks.filter(t => !t.completed).length
  const completedCount = tasks.filter(t => t.completed).length

  const tabs = [
    { key: 'all', label: 'All', count: tasks.length },
    { key: 'open', label: 'Open', count: openCount },
    { key: 'completed', label: 'Done', count: completedCount },
  ]

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='max-w-md max-h-[75vh] flex flex-col p-0 gap-0'>
        <DialogHeader className='px-5 pt-5 pb-4 space-y-3'>
          <div className='flex items-center gap-3'>
            <div className='w-10 h-10 rounded-xl bg-linear-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center'>
              <CheckCircle2 className='w-5 h-5 text-white' />
            </div>
            <div>
              <DialogTitle className='text-base'>Tasks</DialogTitle>
              <DialogDescription className='text-xs'>
                {currentChat?.type === 'dm' ? currentChat.name : `#${currentChat?.name}`}
              </DialogDescription>
            </div>
          </div>

          {/* Filter tabs */}
          <div className='flex gap-1 p-1 bg-muted rounded-lg'>
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-all ${
                  filter === tab.key
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
                <span className='ml-1 opacity-50'>({tab.count})</span>
              </button>
            ))}
          </div>
        </DialogHeader>

        {/* Tasks list */}
        <div className='flex-1 overflow-y-auto px-3 pb-3'>
          {filteredTasks.length === 0 ? (
            <div className='text-center py-16'>
              <div className='w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center'>
                <span className='text-3xl'>
                  {filter === 'open' ? '🎉' : filter === 'completed' ? '📝' : '💬'}
                </span>
              </div>
              <p className='text-muted-foreground text-sm'>
                {filter === 'open'
                  ? 'All caught up!'
                  : filter === 'completed'
                  ? 'No completed tasks'
                  : 'No tasks yet'}
              </p>
              <p className='text-muted-foreground/50 text-xs mt-1'>
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
                      : 'hover:bg-muted'
                  }`}
                  onClick={() => handleToggle(task.id)}
                >
                  {/* Checkbox */}
                  <Checkbox
                    checked={task.completed}
                    onCheckedChange={() => handleToggle(task.id)}
                    onClick={e => e.stopPropagation()}
                    className='mt-0.5 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600'
                  />

                  {/* Task content */}
                  <div className='flex-1 min-w-0'>
                    <p
                      className={`text-sm leading-snug ${
                        task.completed ? 'text-muted-foreground line-through' : 'text-foreground'
                      }`}
                    >
                      {task.title}
                    </p>

                    <div className='flex flex-wrap items-center gap-1.5 mt-2'>
                      {/* Priority badge */}
                      {task.priority && task.priority !== 'medium' && (
                        <Badge
                          variant={task.priority === 'high' || task.priority === 'critical' ? 'destructive' : 'secondary'}
                          className='text-[10px] px-1.5 py-0 h-4'
                        >
                          {task.priority}
                        </Badge>
                      )}

                      {/* Assignee */}
                      {task.assignedTo && (
                        <span className='text-[10px] text-violet-400'>
                          → {task.assignedTo.split(' ')[0]}
                        </span>
                      )}

                      {/* Due date */}
                      {task.dueDate && (
                        <span className='text-[10px] text-amber-400'>
                          {task.dueDate}
                        </span>
                      )}

                      {/* Time */}
                      <span className='text-[10px] text-muted-foreground/50'>
                        {formatTimestamp(task.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
