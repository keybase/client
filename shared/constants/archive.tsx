import * as Z from '@/util/zustand'
import * as C from '.'
import {formatTimeForPopup} from '@/util/timestamp'
import {downloadFolder} from '@/constants/platform'

type Job = {
  id: string
  context: string
  started: string
  progress: number
  outPath: string
  error?: string
}

type Store = {
  jobs: Map<string, Job>
}
const initialStore: Store = {
  jobs: new Map(),
}

type State = Store & {
  dispatch: {
    start: (type: 'chatid' | 'chatname' | 'kbfs', path: string, outPath: string) => void
    cancel: (id: string) => void
    clearCompleted: () => void
    load: () => void
    resetState: 'default'
  }
  chatIDToDisplayname: (id: string) => string
}

export const _useState = Z.createZustand<State>((set, get) => {
  let startedMockTimer = false
  const startMockTimer = () => {
    if (startedMockTimer) return
    startedMockTimer = true
    setInterval(() => {
      set(s => {
        for (const value of s.jobs.values()) {
          if (Math.random() > 0.2) {
            value.progress = Math.min(value.progress + Math.random() * 0.1, 1)
          }
        }
      })
    }, 1000)
  }

  const dispatch: State['dispatch'] = {
    cancel: id => {
      // TODO
      set(s => {
        s.jobs.delete(id)
      })
    },
    clearCompleted: () => {
      // TODO
      set(s => {
        for (const [key, value] of s.jobs.entries()) {
          if (value.progress === 1) {
            s.jobs.delete(key)
          }
        }
      })
    },
    load: () => {
      // TODO
      startMockTimer()
      if (get().jobs.size > 0) {
        return
      }
      get().dispatch.start('chatname', '.', `${downloadFolder}/allchat`)
      get().dispatch.start('chatname', 'keybasefriends#general', `${downloadFolder}/friends`)
      get().dispatch.start('kbfs', '.', `${downloadFolder}/allkbfs`)
      get().dispatch.start('kbfs', 'cnojima/vacation', `${downloadFolder}/vacation`)
    },
    resetState: 'default',
    start: (type, path, outPath) => {
      let context = ''
      switch (type) {
        case 'chatid':
          context = C.useArchiveState.getState().chatIDToDisplayname(path)
          break
        case 'chatname':
          if (path === '.') {
            context = 'all chat'
          } else {
            context = `chat/${path}`
          }
          break
        case 'kbfs':
          if (path === '.') {
            context = 'all kbfs'
          } else {
            context = `kbfs/${path}`
          }
          break
      }
      set(s => {
        const nextKey = `${s.jobs.size + 1}`
        s.jobs.set(nextKey, {
          context,
          id: nextKey,
          outPath,
          progress: 0,
          started: formatTimeForPopup(new Date().getTime()),
        })
      })
    },
  }
  return {
    ...initialStore,
    chatIDToDisplayname: (conversationIDKey: string) => {
      const you = C.useCurrentUserState.getState().username
      const cs = C.getConvoState(conversationIDKey)
      const m = cs.meta
      if (m.teamname) {
        return m.teamname
      }

      const participants = cs.participants.name
      if (participants.length === 1) {
        return participants[0] ?? ''
      }
      return participants.filter(username => username !== you).join(',')
    },
    dispatch,
  }
})
