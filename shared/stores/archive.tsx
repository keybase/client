import * as T from '@/constants/types'
import * as Z from '@/util/zustand'
import {ignorePromise} from '@/constants/utils'
import type * as EngineGen from '@/constants/rpc'
import {formatTimeForPopup} from '@/util/timestamp'

type ChatJob = {
  id: string
  context: string
  started: string
  progress: number
  outPath: string
  error?: string
  status: T.RPCChat.ArchiveChatJobStatus
}

type KBFSJobPhase = 'Queued' | 'Indexing' | 'Indexed' | 'Copying' | 'Copied' | 'Zipping' | 'Done'

type KBFSJob = {
  id: string
  started: Date
  phase: KBFSJobPhase
  kbfsPath: string
  gitRepo?: string
  kbfsRevision: number
  zipFilePath: string

  bytesTotal: number
  bytesCopied: number
  bytesZipped: number

  error?: string
  errorNextRetry?: Date
}

type Store = T.Immutable<{
  chatJobs: Map<string, ChatJob>
  kbfsJobs: Map<string, KBFSJob> // id -> KBFSJob
}>
const initialStore: Store = {
  chatJobs: new Map(),
  kbfsJobs: new Map(),
}

export type State = Store & {
  dispatch: {
    load: () => void
    onEngineIncomingImpl: (action: EngineGen.Actions) => void
    resetState: () => void
  }
}

export const useArchiveState = Z.createZustand<State>('archive', (set, get) => {
  const setKBFSJobStatus = (status: T.RPCGen.SimpleFSArchiveStatus) => {
    set(s => {
      s.kbfsJobs = new Map(
        // order is retained
        (status.jobs ?? []).map(job => [
          job.desc.jobID,
          {
            bytesCopied: job.bytesCopied,
            bytesTotal: job.bytesTotal,
            bytesZipped: job.bytesZipped,
            error: job.error?.error,
            errorNextRetry: job.error?.nextRetry,
            gitRepo: job.desc.gitRepo,
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
  }

  const setChatProgress = (p: {jobID: string; messagesComplete: number; messagesTotal: number}) => {
    const {jobID, messagesComplete, messagesTotal} = p
    if (!get().chatJobs.has(jobID)) {
      loadChat()
      return
    }
    set(s => {
      const job = s.chatJobs.get(jobID)
      if (job) {
        job.progress = messagesTotal ? messagesComplete / messagesTotal : 0
        job.status = T.RPCChat.ArchiveChatJobStatus.running
      }
    })
  }

  const loadChat = () => {
    const f = async () => {
      const res = await T.RPCChat.localArchiveChatListRpcPromise({
        identifyBehavior: T.RPCGen.TLFIdentifyBehavior.unset,
      })

      set(s => {
        s.chatJobs.clear()
        res.jobs?.forEach(job => {
          const id = job.request.jobID
          let context = ''
          if (
            !job.request.query?.name &&
            !job.request.query?.topicName &&
            !job.request.query?.convIDs?.length
          ) {
            context = '<all chat>'
          } else if (job.matchingConvs?.length) {
            const conv = job.matchingConvs.find(mc => mc.name)
            context = conv?.name ?? ''
            if (conv?.channel) {
              context += `#${conv.channel}`
            }
          } else {
            context = '<pending>' // TODO replace with spinner?
          }
          s.chatJobs.set(id, {
            context,
            error: job.err,
            id,
            outPath: `${job.request.outputPath}.tar.gzip`,
            progress: job.messagesTotal ? job.messagesComplete / job.messagesTotal : 0,
            started: formatTimeForPopup(job.startedAt),
            status: job.status,
          })
        })
      })
    }
    ignorePromise(f())
  }
  const loadKBFS = () => {
    const f = async () => {
      const status = await T.RPCGen.SimpleFSSimpleFSGetArchiveStatusRpcPromise()
      setKBFSJobStatus(status)
    }
    ignorePromise(f())
  }

  const dispatch: State['dispatch'] = {
    load: () => {
      loadChat()
      loadKBFS()
    },
    onEngineIncomingImpl: action => {
      switch (action.type) {
        case 'keybase.1.NotifySimpleFS.simpleFSArchiveStatusChanged':
          setKBFSJobStatus(action.payload.params.status)
          break
        case 'chat.1.NotifyChat.ChatArchiveComplete':
          loadChat()
          break
        case 'chat.1.NotifyChat.ChatArchiveProgress':
          setChatProgress(action.payload.params)
          break
        default:
          break
      }
    },
    resetState: Z.defaultReset,
  }
  return {
    ...initialStore,
    dispatch,
  }
})
