import type { ChatMessage } from '@guess-the-word/shared'
import { useEffect, useRef, useState } from 'react'

interface UseChatNotificationsParams {
  roomCode: string | null
  messages: ChatMessage[]
  currentPlayerId: string | null
  reviewed: boolean
}

export function useChatNotifications({ roomCode, messages, currentPlayerId, reviewed }: UseChatNotificationsParams) {
  const [unreadCount, setUnreadCount] = useState(0)
  const previousRoomCodeRef = useRef<string | null>(null)
  const previousMessagesRef = useRef<ChatMessage[]>([])

  useEffect(() => {
    if (previousRoomCodeRef.current !== roomCode) {
      previousRoomCodeRef.current = roomCode
      previousMessagesRef.current = messages
      setUnreadCount(0)
      return
    }

    const previousMessages = previousMessagesRef.current

    if (messages.length > previousMessages.length) {
      const nextMessages = messages.slice(previousMessages.length)
      const foreignMessagesCount = nextMessages.filter((message) => message.senderPlayerId !== currentPlayerId).length

      if (!reviewed && foreignMessagesCount > 0) {
        setUnreadCount((currentCount) => currentCount + foreignMessagesCount)
      }
    }

    previousMessagesRef.current = messages
  }, [currentPlayerId, messages, reviewed, roomCode])

  useEffect(() => {
    if (!reviewed) {
      return
    }

    setUnreadCount(0)
  }, [messages.length, reviewed])

  return unreadCount
}
