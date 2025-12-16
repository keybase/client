import {enableMapSet} from 'immer'
import {create} from 'zustand'
import {immer} from 'zustand/middleware/immer'
enableMapSet()

type Reaction = {
  timestamp: number
  username: string
}
type ReactionDesc = {
  users: Set<Reaction>
}
type Reactions = ReadonlyMap<string, ReactionDesc>

type MinimalMessage = {
  conversationIDKey: string
  ordinal: number
  reactions?: Reactions
  type: 'text'
}

type Store = {
  messageMap: Map<number, MinimalMessage>
}

type State = Store & {
  toggleLocalReaction: (p: {
    decorated: string
    emoji: string
    targetOrdinal: number
    username: string
  }) => void
}

const initialOrdinal = 1
const initialMessage: MinimalMessage = {
  conversationIDKey: 'test-convo',
  ordinal: initialOrdinal,
  type: 'text',
}

const initialMessageMap = new Map<number, MinimalMessage>()
initialMessageMap.set(initialOrdinal, initialMessage)

export const useStore = create<State>()(
  immer((set, get) => ({
    messageMap: initialMessageMap,
    toggleLocalReaction: (p: {decorated: string; emoji: string; targetOrdinal: number; username: string}) => {
      const {emoji, targetOrdinal, username} = p
      set(s => {
        const m = s.messageMap.get(targetOrdinal)
        if (m) {
          const rs = {
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
          rs.users.add({timestamp: Date.now(), username})
        }
      })
    },
  }))
)
