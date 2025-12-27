'use client'

import { useState, useEffect } from 'react'
import { subscribeToTasksByChat, toggleTaskComplete } from '../../lib/firestore'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ChevronDown } from 'lucide-react'

export default function TasksSection({ chatId, chatType, user }) {
  const [tasks, setTasks] = useState([])
  const [isOpen, setIsOpen] = useState(true)
  const [filter, setFilter] = useState('all')

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

  const filters = ['all', 'open', 'done']

  return (
    <div className='mx-3 mb-3'>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        {/* Header */}
        <div className='flex items-center justify-between mb-2'>
          <CollapsibleTrigger className='flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors'>
            <ChevronDown
              className={`h-3 w-3 transition-transform duration-200 ${
                isOpen ? '' : '-rotate-90'
              }`}
            />
            <span className='text-xs font-medium uppercase tracking-wider'>Tasks</span>
            <span className='text-[10px] text-muted-foreground/60'>{openTasks.length} open</span>
          </CollapsibleTrigger>

          {/* Filter Pills */}
          <div className='flex gap-1'>
            {filters.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-[10px] px-2 py-0.5 rounded-full transition-all capitalize ${
                  filter === f
                    ? 'bg-secondary text-secondary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Tasks List */}
        <CollapsibleContent>
          <div className='space-y-1'>
            {displayTasks.length === 0 ? (
              <p className='text-center py-3 text-muted-foreground text-xs'>
                {filter === 'done'
                  ? 'No completed tasks'
                  : filter === 'open'
                  ? 'All done! ✓'
                  : 'No tasks yet'}
              </p>
            ) : (
              displayTasks.map(task => (
                <div
                  key={task.id}
                  className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer ${
                    task.completed
                      ? 'bg-muted/30 hover:bg-muted/50'
                      : 'bg-muted/50 hover:bg-muted/70'
                  }`}
                  onClick={() => handleToggleComplete(task.id)}
                >
                  {/* Checkbox */}
                  <Checkbox
                    checked={task.completed}
                    onCheckedChange={() => handleToggleComplete(task.id)}
                    onClick={e => e.stopPropagation()}
                    className='data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600'
                  />

                  {/* Task Content */}
                  <div className='flex-1 min-w-0'>
                    <p
                      className={`text-sm truncate ${
                        task.completed
                          ? 'text-muted-foreground line-through'
                          : 'text-foreground'
                      }`}
                    >
                      {task.title}
                    </p>
                  </div>

                  {/* Assignee */}
                  {task.assignedTo && (
                    <span className='text-[10px] text-muted-foreground shrink-0'>
                      → {task.assignedTo.split(' ')[0]}
                    </span>
                  )}

                  {/* Priority Badge */}
                  {!task.completed && task.priority === 'high' && (
                    <Badge variant='destructive' className='text-[9px] px-1.5 py-0 h-4'>
                      high
                    </Badge>
                  )}
                </div>
              ))
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
