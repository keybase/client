import * as T from './types'
import * as Z from '@/util/zustand'
import * as C from '.'
import * as EngineGen from '@/actions/engine-gen-gen'
import {formatTimeForPopup} from '@/util/timestamp'
import * as FS from '@/constants/fs'
import {uint8ArrayToHex} from 'uint8array-extras'

type ChatJob = {
  id: string
  context: string
  started: string
  progress: number
  outPath: string
  error?: string
  status: T.RPCChat.ArchiveChatJobStatus
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
  chatJobs: Map<string, ChatJob>
  kbfsJobs: Map<string, KBFSJob> // id -> KBFSJob
  kbfsJobsFreshness: Map<string, number> // id -> KBFS TLF Revision
}>
const initialStore: Store = {
  chatJobs: new Map(),
  kbfsJobs: new Map(),
  kbfsJobsFreshness: new Map(),
}

interface State extends Store {
  dispatch: {
    start: (type: 'chatid' | 'chatname' | 'kbfs', path: string, outPath: string) => void
    cancelChat: (id: string) => void
    pauseChat: (id: string) => void
    resumeChat: (id: string) => void
    clearCompletedChat: () => void
    loadChat: () => void
    loadKBFS: () => void
    loadKBFSJobFreshness: (jobID: string) => void
    cancelOrDismissKBFS: (jobID: string) => void
    onEngineIncoming: (action: EngineGen.Actions) => void
    resetState: 'default'
  }
  chatIDToDisplayname: (id: string) => string
}

export const _useState = Z.createZustand<State>((set, get) => {
  const setKBFSJobStatus = (status: T.RPCGen.SimpleFSArchiveStatus) => {
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
  }

  const setChatComplete = (jobID: string) => {
    set(s => {
      const job = s.chatJobs.get(jobID)
      if (!job) return
      job.progress = 1
    })
  }
  const setChatProgress = (p: {jobID: string; messagesComplete: number; messagesTotal: number}) => {
    const {jobID, messagesComplete, messagesTotal} = p
    set(s => {
      const job = s.chatJobs.get(jobID)
      if (!job) return
      job.progress = messagesTotal ? messagesComplete / messagesTotal : 0
    })
  }

  const startChatArchiveAll = (outPath: string) => {
    startChatArchive(null, outPath)
  }
  const startChatArchiveTeam = (team: string, outPath: string) => {
    startChatArchive(
      {
        computeActiveList: false,
        name: {membersType: T.RPCChat.ConversationMembersType.team, name: team},
        readOnly: false,
        unreadOnly: false,
      },
      outPath
    )
  }
  const startChatArchiveCID = (conversationIDKey: T.Chat.ConversationIDKey, outPath: string) => {
    startChatArchive(
      {
        computeActiveList: false,
        convIDs: [T.Chat.keyToConversationID(conversationIDKey)],
        readOnly: false,
        unreadOnly: false,
      },
      outPath
    )
  }

  const startChatArchive = (query: T.RPCChat.GetInboxLocalQuery | null, outPath: string) => {
    const f = async () => {
      const jobID = Uint8Array.from([...Array<number>(8)], () => Math.floor(Math.random() * 256))
      const id = uint8ArrayToHex(jobID)
      try {
        await T.RPCChat.localArchiveChatRpcPromise({
          req: {
            compress: true,
            identifyBehavior: T.RPCGen.TLFIdentifyBehavior.unset,
            jobID: id,
            outputPath: outPath,
            query,
          },
        })
        get().dispatch.loadChat()
      } catch (e) {
        set(s => {
          const old = s.chatJobs.get(id)
          if (old) {
            old.error = String(e)
          }
        })
      }
    }
    C.ignorePromise(f())
  }

  const dispatch: State['dispatch'] = {
    cancelChat: jobID => {
      const f = async () => {
        await T.RPCChat.localArchiveChatDeleteRpcPromise({
          deleteOutputPath: true,
          identifyBehavior: T.RPCGen.TLFIdentifyBehavior.unset,
          jobID,
        })
      }
      C.ignorePromise(f())
    },
    cancelOrDismissKBFS: (jobID: string) => {
      const f = async () => {
        await T.RPCGen.SimpleFSSimpleFSArchiveCancelOrDismissJobRpcPromise({jobID})
      }
      C.ignorePromise(f())
    },
    clearCompletedChat: () => {
      C.ignorePromise(
        Promise.allSettled(
          [...get().chatJobs.values()].map(async job => {
            if (job.status === T.RPCChat.ArchiveChatJobStatus.complete) {
              await T.RPCChat.localArchiveChatDeleteRpcPromise({
                deleteOutputPath: C.isMobile,
                identifyBehavior: T.RPCGen.TLFIdentifyBehavior.unset,
                jobID: job.id,
              })
            }
          })
        )
      )
      get().dispatch.loadChat()
    },
    loadChat: () => {
      const f = async () => {
        const res = await T.RPCChat.localArchiveChatListRpcPromise({
          identifyBehavior: T.RPCGen.TLFIdentifyBehavior.unset,
        })

        set(s => {
          s.chatJobs.clear()
          res.jobs?.forEach(job => {
            const id = job.request.jobID
            const context = job.matchingConvs?.find(mc => mc.name)?.name ?? ''
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
      C.ignorePromise(f())
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
        case EngineGen.chat1NotifyChatChatArchiveComplete:
          setChatComplete(action.payload.params.jobID)
          break
        case EngineGen.chat1NotifyChatChatArchiveProgress:
          setChatProgress(action.payload.params)
          break
        default:
          break
      }
    },
    pauseChat: jobID => {
      const f = async () => {
        await T.RPCChat.localArchiveChatPauseRpcPromise({
          identifyBehavior: T.RPCGen.TLFIdentifyBehavior.unset,
          jobID,
        })
        get().dispatch.loadChat()
      }
      C.ignorePromise(f())
    },
    resetState: 'default',
    resumeChat: jobID => {
      const f = async () => {
        await T.RPCChat.localArchiveChatResumeRpcPromise({
          identifyBehavior: T.RPCGen.TLFIdentifyBehavior.unset,
          jobID,
        })
        get().dispatch.loadChat()
      }
      C.ignorePromise(f())
    },
    start: (type, path, outPath) => {
      switch (type) {
        case 'chatid':
          startChatArchiveCID(path, outPath)
          return
        case 'chatname':
          if (path === '.') {
            startChatArchiveAll(outPath)
          } else {
            startChatArchiveTeam(path, outPath)
          }
          break
        case 'kbfs':
          C.ignorePromise(startFSArchive(path, outPath))
          return
      }
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
