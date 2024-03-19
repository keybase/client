import * as T from './types'
import * as Z from '@/util/zustand'
import * as C from '.'
import * as EngineGen from '@/actions/engine-gen-gen'
import {formatTimeForPopup} from '@/util/timestamp'
import {downloadFolder} from '@/constants/platform'
import * as FS from '@/constants/fs'

type Job = {
  id: string
  context: string
  started: string
  progress: number
  outPath: string
  error?: string
}

type KBFSJobPhase = 'Queued' | 'Indexing' | 'Indexed' | 'Copying' | 'Copyied' | 'Zipping' | 'Done'

type KBFSJob = {
  id: string
  started: Date
  phase: KBFSJobPhase
  kbfsPath: string
  kbfsRevision: number
  zipFilePath: string

  bytesTotal: number
  bytesCopied: number
  bytesZipped: number

  error?: string
  errorNextRetry?: Date
}

type Store = T.Immutable<{
  jobs: Map<string, Job>
  kbfsJobs: Map<string, KBFSJob> // id -> KBFSJob
  kbfsJobsFreshness: Map<string, number> // id -> KBFS TLF Revision
}>
const initialStore: Store = {
  jobs: new Map(),
  kbfsJobs: new Map(),
  kbfsJobsFreshness: new Map(),
}

type State = Store & {
  dispatch: {
    start: (type: 'chatid' | 'chatname' | 'kbfs', path: string, outPath: string) => void
    cancel: (id: string) => void
    clearCompleted: () => void
    load: () => void
    loadKBFS: () => void
    loadKBFSJobFreshness: (jobID: string) => void
    cancelOrDismissKBFS: (jobID: string) => void
    onEngineIncoming: (action: EngineGen.Actions) => void
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

  const setKBFSJobStatus = (status: T.RPCGen.SimpleFSArchiveStatus) =>
    set(s => {
      s.kbfsJobs = new Map(
        // order is retained
        (status.jobs || []).map(job => [
          job.desc.jobID,
          {
            bytesCopied: job.bytesCopied,
            bytesTotal: job.bytesTotal,
            bytesZipped: job.bytesZipped,
            error: job.error?.error,
            errorNextRetry: job.error?.nextRetry,
            id: job.desc.jobID,
            kbfsPath: job.desc.kbfsPathWithRevision.path,
            kbfsRevision:
              job.desc.kbfsPathWithRevision.archivedParam.KBFSArchivedType ===
              T.RPCGen.KBFSArchivedType.revision
                ? job.desc.kbfsPathWithRevision.archivedParam.revision
                : 0,
            phase: {
              [T.RPCGen.SimpleFSArchiveJobPhase.queued]: 'Queued',
              [T.RPCGen.SimpleFSArchiveJobPhase.indexing]: 'Indexing',
              [T.RPCGen.SimpleFSArchiveJobPhase.indexed]: 'Indexed',
              [T.RPCGen.SimpleFSArchiveJobPhase.copying]: 'Copying',
              [T.RPCGen.SimpleFSArchiveJobPhase.copied]: 'Copied',
              [T.RPCGen.SimpleFSArchiveJobPhase.zipping]: 'Zipping',
              [T.RPCGen.SimpleFSArchiveJobPhase.done]: 'Done',
            }[job.phase],
            started: new Date(job.desc.startTime),
            zipFilePath: job.desc.zipFilePath,
          } as KBFSJob,
        ])
      )
    })

  const dispatch: State['dispatch'] = {
    cancel: id => {
      // TODO
      set(s => {
        s.jobs.delete(id)
      })
    },
    cancelOrDismissKBFS: (jobID: string) => {
      const f = async () => {
        await T.RPCGen.SimpleFSSimpleFSArchiveCancelOrDismissJobRpcPromise({jobID})
      }
      C.ignorePromise(f())
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
      set(s => {
        const old = s.jobs.get('1')
        if (old) {
          s.jobs.set('1', {
            ...old,
            progress: 0.8,
          })
        }
      })
    },
    loadKBFS: () => {
      const f = async () => {
        const status = await T.RPCGen.SimpleFSSimpleFSGetArchiveStatusRpcPromise()
        setKBFSJobStatus(status)
      }
      C.ignorePromise(f())
    },
    loadKBFSJobFreshness: (jobID: string) => {
      const f = async () => {
        const resp = await T.RPCGen.SimpleFSSimpleFSGetArchiveJobFreshnessRpcPromise({jobID})
        set(s => {
          // ordering doesn't matter here
          s.kbfsJobsFreshness.set(jobID, resp.currentTLFRevision)
        })
      }
      C.ignorePromise(f())
    },
    onEngineIncoming: action => {
      switch (action.type) {
        case EngineGen.keybase1NotifySimpleFSSimpleFSArchiveStatusChanged:
          setKBFSJobStatus(action.payload.params.status)
          break
        default:
          break
      }
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
          C.ignorePromise(startFSArchive(path, outPath))
          return
      }
      // TODO outpath on mobile set by service
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

const startFSArchive = async (path: string, outPath: string) => {
  await T.RPCGen.SimpleFSSimpleFSArchiveStartRpcPromise({
    kbfsPath: FS.pathToRPCPath(path).kbfs,
    outputPath: outPath,
    overwriteZip: true,
  })
}
