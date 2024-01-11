import * as Z from '@/util/zustand'
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
    start: (type: 'chat' | 'kbfs', path: string, outPath: string) => void
    cancel: (id: string) => void
    clearCompleted: () => void
    load: () => void
    resetState: 'default'
  }
}

export const _useState = Z.createZustand<State>(set => {
  const startMockTimer = () => {
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
      set(s => {
        if (s.jobs.size > 0) {
          return
        }
        startMockTimer()
        s.jobs = new Map([
          [
            '1',
            {
              context: 'chat/.',
              id: '1',
              outPath: `${downloadFolder}/allchat`,
              progress: 0.2,
              started: formatTimeForPopup(new Date().getTime() - 1000 * 60 * 60 * 24 * 3),
            },
          ],
          [
            '2',
            {
              context: 'fs/.',
              id: '2',
              outPath: `${downloadFolder}/allkbfs`,
              progress: 0.8,
              started: formatTimeForPopup(new Date().getTime() - 1000 * 60 * 60 * 24 * 8),
            },
          ],
          [
            '3',
            {
              context: 'chat/keybase',
              id: '3',
              outPath: `${downloadFolder}/archivetest`,
              progress: 1,
              started: formatTimeForPopup(new Date().getTime() - 1000 * 60 * 60 * 24 * 30),
            },
          ],
        ] as const)
      })
    },
    resetState: 'default',
    start: (type, path, outPath) => {
      set(s => {
        const nextKey = `${s.jobs.size + 1}`
        s.jobs.set(nextKey, {
          context: `${type}/${path}`,
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
    dispatch,
  }
})
