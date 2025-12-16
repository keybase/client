import {enableMapSet} from 'immer'
import {create} from 'zustand'
import {immer} from 'zustand/middleware/immer'
import * as T from '../constants/types'
import {stringToConversationIDKey} from '../constants/types/chat2/common'

enableMapSet()

type MinimalMessage = {
  conversationIDKey: T.Chat.ConversationIDKey
  ordinal: T.Chat.Ordinal
  reactions?: T.Chat.Reactions
  type: 'text'
}

type Store = {
  messageMap: Map<T.Chat.Ordinal, MinimalMessage>
}

type State = Store & {
  toggleLocalReaction: (p: {
    decorated: string
    emoji: string
    targetOrdinal: T.Chat.Ordinal
    username: string
  }) => void
}

const isMessageWithReactions = (message: MinimalMessage): boolean => {
  return (
    !(
      message.type === 'placeholder' ||
      message.type === 'deleted' ||
      message.type === 'systemJoined' ||
      message.type === 'systemLeft' ||
      message.type === 'journeycard'
    ) &&
    !(message as any).exploded &&
    !(message as any).errorReason
  )
}

const makeReaction = (m?: Partial<T.Chat.Reaction>): T.Chat.Reaction => ({
  timestamp: 0,
  username: '',
  ...m,
})

const initialOrdinal = T.Chat.numberToOrdinal(1)
const initialMessage: MinimalMessage = {
  conversationIDKey: stringToConversationIDKey('test-convo'),
  ordinal: initialOrdinal,
  type: 'text',
}

const initialMessageMap = new Map<T.Chat.Ordinal, MinimalMessage>()
initialMessageMap.set(initialOrdinal, initialMessage)

export const useStore = create<State>()(
  immer((set, get) => ({
    messageMap: initialMessageMap,
    toggleLocalReaction: (p: {
      decorated: string
      emoji: string
      targetOrdinal: T.Chat.Ordinal
      username: string
    }) => {
      const {decorated, emoji, targetOrdinal, username} = p
      set(s => {
        const m = s.messageMap.get(targetOrdinal)
        if (m && isMessageWithReactions(m)) {
          const rs = {
            decorated: m.reactions?.get(emoji)?.decorated ?? decorated,
            users: m.reactions?.get(emoji)?.users ?? new Set(),
          }
          if (!m.reactions) {
            m.reactions = new Map()
          }
          m.reactions.set(emoji, rs)
          const existing = [...rs.users].find(r => r.username === username)
          if (existing) {
            rs.users.delete(existing)
          }
          rs.users.add(makeReaction({timestamp: Date.now(), username}))
          if (rs.users.size === 0) {
            m.reactions.delete(emoji)
          }
        }
      })
      console.log('messageMap:', get().messageMap)
    },
  }))
)

