'use client'

import { useState, useCallback, useMemo } from 'react'
import Frecency from 'frecency/dist/browser/index.js'

// Create frecency instance for mention menu - persists to localStorage
const createMentionFrecency = () => {
  if (typeof window === 'undefined') return null
  return new Frecency({
    key: 'poppy_mention_frecency',
    idAttribute: '_frecencyId',
  })
}

export function useMentionMenu({
  inputRef,
  allUsers,
  user,
  updateTypingIndicator,
  setInsertPosition,
  openAiModal,
}) {
  const [mentionMenu, setMentionMenu] = useState(null)
  const [mentionMenuIndex, setMentionMenuIndex] = useState(0)
  
  // Initialize frecency instance (memoized to avoid recreating)
  const frecency = useMemo(() => createMentionFrecency(), [])

  const handleTextareaChange = useCallback(
    e => {
      // Auto-expand textarea
      const textarea = e.target
      textarea.style.height = 'auto'
      // Allow expansion up to ~12-15 lines
      textarea.style.height = Math.min(textarea.scrollHeight, 300) + 'px'

      const value = textarea.value
      const cursorPos = textarea.selectionStart

      // Update typing indicator (DMs only)
      updateTypingIndicator()

      // Find / command before cursor (look backwards from cursor)
      let slashPos = -1
      for (let i = cursorPos - 1; i >= 0; i--) {
        if (value[i] === '/') {
          slashPos = i
          break
        }
        // Stop if we hit a space or newline (/ command can't span these)
        if (value[i] === ' ' || value[i] === '\n') {
          break
        }
      }

      if (slashPos !== -1) {
        // Only trigger if / is at start or after a space (not in middle of URL)
        const charBeforeSlash = slashPos > 0 ? value[slashPos - 1] : ' '
        const isCommandContext =
          charBeforeSlash === ' ' || charBeforeSlash === '\n' || slashPos === 0

        if (isCommandContext) {
          // Get text between / and cursor
          const query = value.substring(slashPos + 1, cursorPos)
          // Only show if no space in query
          if (!query.includes(' ') && !query.includes('\n')) {
            setMentionMenu({
              type: 'command',
              position: slashPos,
              query: query.toLowerCase(),
            })
            setMentionMenuIndex(0)
            return
          }
        }
      }

      // Find @ before cursor (look backwards from cursor)
      let atPos = -1
      for (let i = cursorPos - 1; i >= 0; i--) {
        if (value[i] === '@') {
          atPos = i
          break
        }
        // Stop if we hit a space or newline (@ mention can't span these)
        if (value[i] === ' ' || value[i] === '\n') {
          break
        }
      }

      if (atPos !== -1) {
        // Get text between @ and cursor
        const query = value.substring(atPos + 1, cursorPos)
        // Only show if no space in query
        if (!query.includes(' ') && !query.includes('\n')) {
          setMentionMenu({
            type: 'mention',
            position: atPos,
            query: query.toLowerCase(),
          })
          setMentionMenuIndex(0)
          return
        }
      }

      // Close menu if no match
      setMentionMenu(null)
    },
    [updateTypingIndicator]
  )

  const getMentionMenuItems = useCallback(() => {
    if (!mentionMenu) return []

    // For commands, show /ai
    if (mentionMenu.type === 'command') {
      if ('ai'.includes(mentionMenu.query)) {
        return [
          {
            type: 'ai-command',
            name: '/ai',
            description: 'Ask Poppy AI anything',
            _frecencyId: 'command:ai',
          },
        ]
      }
      return []
    }

    // For mentions, filter ALL items including Poppy based on query
    let items = []

    // Only show Poppy if query matches
    if (!mentionMenu.query || 'poppy'.includes(mentionMenu.query)) {
      items.push({
        type: 'ai',
        name: 'Poppy',
        uid: 'poppy-ai',
        description: 'AI Assistant',
        icon: '/poppy-icon.png',
        _frecencyId: 'ai:poppy',
      })
    }

    // Add users that match the query - search by name only, not email
    const filteredUsers = allUsers.filter(
      u =>
        u.uid !== user?.uid &&
        u.displayName?.toLowerCase().includes(mentionMenu.query)
    )

    filteredUsers.forEach(u => {
      items.push({
        type: 'user',
        name: u.displayName || u.email,
        uid: u.uid,
        photoURL: u.photoURL,
        description: u.email,
        _frecencyId: `user:${u.uid}`,
      })
    })

    // Sort by frecency (most frequently/recently mentioned first)
    if (frecency && items.length > 0) {
      items = frecency.sort({
        searchQuery: mentionMenu.query,
        results: items
      })
    }

    return items
  }, [mentionMenu, allUsers, user, frecency])

  const selectMentionItem = useCallback(
    item => {
      if (!mentionMenu || !inputRef.current) return

      // Record selection for frecency ranking (learns from usage)
      if (frecency && item._frecencyId) {
        frecency.save({
          searchQuery: mentionMenu.query,
          selectedId: item._frecencyId
        })
      }

      const textarea = inputRef.current
      const value = textarea.value
      const { position } = mentionMenu

      // If it's /ai command, open the AI modal
      if (item.type === 'ai-command') {
        setMentionMenu(null)
        // Save position where /ai was (this is where AI response will be inserted)
        setInsertPosition(position)
        // Remove the /ai command from the text
        const beforeCommand = value.substring(0, position)
        const afterCursor = value.substring(textarea.selectionStart)
        textarea.value = beforeCommand + afterCursor
        // Set cursor at the position where /ai was
        textarea.setSelectionRange(position, position)
        // Open modal
        openAiModal()
        return
      }

      // Replace @query with @name
      const beforeMention = value.substring(0, position)
      const afterCursor = value.substring(textarea.selectionStart)
      const mentionText = item.type === 'ai' ? '@poppy ' : `@${item.name} `

      textarea.value = beforeMention + mentionText + afterCursor
      const newCursorPos = position + mentionText.length
      textarea.setSelectionRange(newCursorPos, newCursorPos)

      setMentionMenu(null)
      textarea.focus()

      // Trigger change to update height
      const event = new Event('input', { bubbles: true })
      textarea.dispatchEvent(event)
    },
    [mentionMenu, inputRef, setInsertPosition, openAiModal, frecency]
  )

  // Handle keyboard navigation for mention menu
  const handleMentionKeyDown = useCallback(
    e => {
      if (!mentionMenu) return false

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const items = getMentionMenuItems()
        setMentionMenuIndex(prev => (prev + 1) % items.length)
        return true
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        const items = getMentionMenuItems()
        setMentionMenuIndex(prev => (prev - 1 + items.length) % items.length)
        return true
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        const items = getMentionMenuItems()
        if (items[mentionMenuIndex]) {
          selectMentionItem(items[mentionMenuIndex])
        }
        return true
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setMentionMenu(null)
        return true
      }

      return false
    },
    [mentionMenu, mentionMenuIndex, getMentionMenuItems, selectMentionItem]
  )

  return {
    mentionMenu,
    mentionMenuIndex,
    setMentionMenu,
    setMentionMenuIndex,
    handleTextareaChange,
    getMentionMenuItems,
    selectMentionItem,
    handleMentionKeyDown,
  }
}

