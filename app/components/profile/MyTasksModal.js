'use client'

import { useState, useEffect } from 'react'
import { subscribeToMyDMTasks, toggleTaskComplete, getDMId } from '../../lib/firestore'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow } from 'date-fns'

export default function MyTasksModal({ user, allUsers, onClose, onSelectChat }) {
  const [tasks, setTasks] = useState([])
  const [filter, setFilter] = useState('open')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.uid) return

    const unsubscribe = subscribeToMyDMTasks(user.uid, loadedTasks => {
      setTasks(loadedTasks)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [user?.uid])

  const handleToggleComplete = async (e, taskId) => {
    e.stopPropagation()
    try {
      await toggleTaskComplete(taskId, user.uid, user.displayName || user.email)
    } catch (error) {
      console.error('Error toggling task:', error)
    }
  }

  const handleTaskClick = (task) => {
    // Navigate to the DM where this task exists
    // Extract the other user's ID from the chatId
    const [uid1, uid2] = task.chatId.split('_')
    const otherUserId = uid1 === user.uid ? uid2 : uid1
    const otherUser = allUsers.find(u => u.uid === otherUserId)
    
    if (otherUser) {
      onSelectChat({
        type: 'dm',
        id: otherUserId,
        name: otherUser.displayName || otherUser.email
      })
      onClose()
    }
  }

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Just now'
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
      return formatDistanceToNow(date, { addSuffix: true })
    } catch {
      return 'Just now'
    }
  }

  const getOtherUserName = (chatId) => {
    if (!chatId) return 'Unknown'
    const [uid1, uid2] = chatId.split('_')
    const otherUserId = uid1 === user.uid ? uid2 : uid1
    const otherUser = allUsers.find(u => u.uid === otherUserId)
    return otherUser?.displayName?.split(' ')[0] || otherUser?.email?.split('@')[0] || 'Unknown'
  }

  // Filter tasks
  const openTasks = tasks.filter(t => !t.completed)
  const completedTasks = tasks.filter(t => t.completed)
  const displayTasks = filter === 'all' ? tasks : filter === 'open' ? openTasks : completedTasks

  const filters = ['all', 'open', 'done']

  return (
    <div className="my-tasks-modal-overlay" onClick={onClose}>
      <div className="my-tasks-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="my-tasks-header">
          <div className="my-tasks-title">
            <span>📋 My Tasks</span>
            <span className="my-tasks-count">{openTasks.length} open</span>
          </div>
          <button className="my-tasks-close" onClick={onClose}>×</button>
        </div>

        {/* Filter Pills */}
        <div className="my-tasks-filters">
          {filters.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`my-tasks-filter-pill ${filter === f ? 'active' : ''}`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Tasks List */}
        <div className="my-tasks-list">
          {loading ? (
            <div className="my-tasks-empty">Loading tasks...</div>
          ) : displayTasks.length === 0 ? (
            <div className="my-tasks-empty">
              {filter === 'done'
                ? 'No completed tasks'
                : filter === 'open'
                ? 'All caught up! ✨'
                : 'No tasks yet'}
            </div>
          ) : (
            displayTasks.map(task => (
              <div
                key={task.id}
                className={`my-task-item ${task.completed ? 'completed' : ''}`}
                onClick={() => handleTaskClick(task)}
              >
                {/* Checkbox */}
                <Checkbox
                  checked={task.completed}
                  onCheckedChange={(e) => handleToggleComplete({ stopPropagation: () => {} }, task.id)}
                  onClick={e => e.stopPropagation()}
                  className='my-task-checkbox data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600'
                />

                {/* Task Content */}
                <div className='my-task-content'>
                  <p className={`my-task-title ${task.completed ? 'line-through' : ''}`}>
                    {task.title}
                  </p>
                  <div className="my-task-meta">
                    <span className="my-task-dm">with {getOtherUserName(task.chatId)}</span>
                    <span className="my-task-time">{formatTimestamp(task.createdAt)}</span>
                  </div>
                </div>

                {/* Assignee indicator */}
                {task.assignedTo && (
                  <span className='my-task-assignee'>
                    → {task.assignedTo.split(' ')[0]}
                  </span>
                )}

                {/* Priority Badge */}
                {!task.completed && task.priority === 'high' && (
                  <Badge variant='destructive' className='my-task-priority'>
                    high
                  </Badge>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

