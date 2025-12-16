import {create} from 'zustand'
import {immer} from 'zustand/middleware/immer'

type Reaction = {
  timestamp: number
  username: string
}

type ReactionDesc = {
  decorated: string
  users: Set<Reaction>
}

type Message = {
  reactions?: Map<string, ReactionDesc>
}

type Store = {
  messageMap: Map<number, Message>
  setMessage: (ordinal: number, message: Message) => void
  toggleLocalReaction: (p: {
    decorated: string
    emoji: string
    targetOrdinal: number
    username: string
  }) => void
}

const makeReaction = (m?: Partial<Reaction>): Reaction => ({
  timestamp: 0,
  username: '',
  ...m,
})

const isMessageWithReactions = (message: Message): boolean => {
  return true
}

export class ZStore {
  private store: ReturnType<typeof createStore>

  constructor() {
    this.store = createStore()
  }

  getState() {
    return this.store.getState()
  }

  setMessage(ordinal: number, message: Message) {
    this.store.getState().setMessage(ordinal, message)
  }

  toggleLocalReaction(p: {
    decorated: string
    emoji: string
    targetOrdinal: number
    username: string
  }) {
    this.store.getState().toggleLocalReaction(p)
  }
}

const createStore = () => {
  return create<Store>()(
    immer((set) => ({
      messageMap: new Map(),
      setMessage: (ordinal, message) => {
        set((s) => {
          s.messageMap.set(ordinal, message)
        })
      },
      toggleLocalReaction: (p) => {
        const {decorated, emoji, targetOrdinal, username} = p
        set((s) => {
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
            const existing = [...rs.users].find((r) => r.username === username)
            if (existing) {
              rs.users.delete(existing)
            }
            rs.users.add(makeReaction({timestamp: Date.now(), username}))
            if (rs.users.size === 0) {
              m.reactions.delete(emoji)
            }
          }
        })
      },
    }))
  )
}

