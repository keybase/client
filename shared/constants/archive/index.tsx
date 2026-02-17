import * as T from '../types'
import * as Z from '@/util/zustand'
import {ignorePromise} from '../utils'
import * as EngineGen from '@/actions/engine-gen-gen'
import * as FS from '@/constants/fs'
import {formatTimeForPopup} from '@/util/timestamp'
import {uint8ArrayToHex} from 'uint8array-extras'
import {storeRegistry} from '../store-registry'
import {isAndroid, isMobile} from '../platform'
import {fsCacheDir} from '../platform-specific'

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
  gitRepo?: string
  kbfsRevision: number
  zipFilePath: string

  bytesTotal: number
  bytesCopied: number
  bytesZipped: number

  error?: string
  errorNextRetry?: Date
}

type ArchiveAllFilesResponseWaiter =
  | {state: 'idle'}
  | {
      state: 'waiting'
    }
  | {
      errors: Map<string, string> // tlf -> error
      skipped: number
      started: number
      state: 'finished'
    }

type ArchiveAllGitResponseWaiter =
  | {state: 'idle'}
  | {
      state: 'waiting'
    }
  | {
      errors: Map<string, string> // gitRepo -> error
      started: number
      state: 'finished'
    }

type Store = T.Immutable<{
  archiveAllFilesResponseWaiter: ArchiveAllFilesResponseWaiter
  archiveAllGitResponseWaiter: ArchiveAllGitResponseWaiter
  chatJobs: Map<string, ChatJob>
  kbfsJobs: Map<string, KBFSJob> // id -> KBFSJob
  kbfsJobsFreshness: Map<string, number> // id -> KBFS TLF Revision
}>
const initialStore: Store = {
  archiveAllFilesResponseWaiter: {state: 'idle'},
  archiveAllGitResponseWaiter: {state: 'idle'},
  chatJobs: new Map(),
  kbfsJobs: new Map(),
  kbfsJobsFreshness: new Map(),
}

export interface State extends Store {
  dispatch: {
    start: (type: 'chatid' | 'chatname' | 'kbfs' | 'git', path: string, outPath: string) => void
    resetWaiters: () => void
    cancelChat: (id: string) => void
    pauseChat: (id: string) => void
    resumeChat: (id: string) => void
    clearCompleted: () => void
    load: () => void
    loadKBFSJobFreshness: (jobID: string) => void
    cancelOrDismissKBFS: (jobID: string) => Promise<void>
    onEngineIncomingImpl: (action: EngineGen.Actions) => void
    resetState: 'default'
  }
  chatIDToDisplayname: (id: string) => string
}

export const useArchiveState = Z.createZustand<State>((set, get) => {
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
    set(s => {
      const job = s.chatJobs.get(jobID)
      if (!job) {
        loadChat()
        return
      }
      job.progress = messagesTotal ? messagesComplete / messagesTotal : 0
      job.status = T.RPCChat.ArchiveChatJobStatus.running
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
      const actualOutPath = outPath || (isAndroid && fsCacheDir ? `${fsCacheDir}/kbchat-${id}` : '')
      try {
        await T.RPCChat.localArchiveChatRpcPromise({
          req: {
            compress: true,
            identifyBehavior: T.RPCGen.TLFIdentifyBehavior.unset,
            jobID: id,
            outputPath: actualOutPath,
            query,
          },
        })
        loadChat()
      } catch (e) {
        set(s => {
          const old = s.chatJobs.get(id)
          if (old) {
            old.error = String(e)
          }
        })
      }
    }
    ignorePromise(f())
  }

  const clearCompletedChat = () => {
    ignorePromise(
      Promise.allSettled(
        [...get().chatJobs.values()].map(async job => {
          if (job.status === T.RPCChat.ArchiveChatJobStatus.complete) {
            await T.RPCChat.localArchiveChatDeleteRpcPromise({
              deleteOutputPath: isMobile,
              identifyBehavior: T.RPCGen.TLFIdentifyBehavior.unset,
              jobID: job.id,
            })
          }
        })
      )
    )
    loadChat()
  }

  const clearCompletedKBFS = () => {
    ignorePromise(
      Promise.allSettled(
        [...get().kbfsJobs.values()].map(async job => {
          if (job.phase === 'Done') {
            return get().dispatch.cancelOrDismissKBFS(job.id)
          }
        })
      )
    )
    loadKBFS()
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

  const startFSArchive = (path: string, outPath: string) => {
    const f = async () => {
      const actualPath = outPath || (isAndroid && fsCacheDir ? `${fsCacheDir}/kbfs-backup-${Date.now()}` : '')
      await T.RPCGen.SimpleFSSimpleFSArchiveStartRpcPromise({
        archiveJobStartPath: {
          archiveJobStartPathType: T.RPCGen.ArchiveJobStartPathType.kbfs,
          kbfs: FS.pathToRPCPath(path).kbfs,
        },
        outputPath: actualPath,
        overwriteZip: true,
      })
    }
    ignorePromise(f())
  }

  const startFSArchiveAll = (outputDir: string) => {
    set(s => {
      s.archiveAllFilesResponseWaiter.state = 'waiting'
    })
    const f = async () => {
      const actualDir = outputDir || (isAndroid && fsCacheDir ? fsCacheDir : '')
      const response = await T.RPCGen.SimpleFSSimpleFSArchiveAllFilesRpcPromise({
        includePublicReadonly: false,
        outputDir: actualDir,
        overwriteZip: false,
      })
      set(s => {
        if (s.archiveAllFilesResponseWaiter.state !== 'waiting') {
          return
        }
        s.archiveAllFilesResponseWaiter = {
          errors: new Map(Object.entries(response.tlfPathToError ?? {})),
          skipped: (response.skippedTLFPaths ?? []).length,
          started: Object.keys(response.tlfPathToJobDesc ?? {}).length,
          state: 'finished',
        }
      })
    }
    ignorePromise(f())
  }

  const startGitArchive = (gitRepo: string, outPath: string) => {
    const f = async () => {
      const actualPath =
        outPath || (isAndroid && fsCacheDir ? `${fsCacheDir}/git-backup-${Date.now()}` : '')
      await T.RPCGen.SimpleFSSimpleFSArchiveStartRpcPromise({
        archiveJobStartPath: {
          archiveJobStartPathType: T.RPCGen.ArchiveJobStartPathType.git,
          git: gitRepo,
        },
        outputPath: actualPath,
        overwriteZip: true,
      })
    }
    ignorePromise(f())
  }

  const startGitArchiveAll = (outputDir: string) => {
    set(s => {
      s.archiveAllGitResponseWaiter.state = 'waiting'
    })
    const f = async () => {
      const actualDir = outputDir || (isAndroid && fsCacheDir ? fsCacheDir : '')
      const response = await T.RPCGen.SimpleFSSimpleFSArchiveAllGitReposRpcPromise({
        outputDir: actualDir,
        overwriteZip: false,
      })
      set(s => {
        if (s.archiveAllGitResponseWaiter.state !== 'waiting') {
          return
        }
        s.archiveAllGitResponseWaiter = {
          errors: new Map(Object.entries(response.gitRepoToError ?? {})),
          started: Object.keys(response.gitRepoToJobDesc ?? {}).length,
          state: 'finished',
        }
      })
    }
    ignorePromise(f())
  }

  const dispatch: State['dispatch'] = {
    cancelChat: jobID => {
      const f = async () => {
        await T.RPCChat.localArchiveChatDeleteRpcPromise({
          deleteOutputPath: true,
          identifyBehavior: T.RPCGen.TLFIdentifyBehavior.unset,
          jobID,
        })
        loadChat()
      }
      ignorePromise(f())
    },
    cancelOrDismissKBFS: async (jobID: string) => {
      await T.RPCGen.SimpleFSSimpleFSArchiveCancelOrDismissJobRpcPromise({jobID})
    },
    clearCompleted: () => {
      clearCompletedChat()
      clearCompletedKBFS()
    },
    load: () => {
      loadChat()
      loadKBFS()
    },
    loadKBFSJobFreshness: (jobID: string) => {
      const f = async () => {
        const resp = await T.RPCGen.SimpleFSSimpleFSGetArchiveJobFreshnessRpcPromise({jobID})
        set(s => {
          // ordering doesn't matter here
          s.kbfsJobsFreshness.set(jobID, resp.currentTLFRevision)
        })
      }
      ignorePromise(f())
    },
    onEngineIncomingImpl: action => {
      switch (action.type) {
        case EngineGen.keybase1NotifySimpleFSSimpleFSArchiveStatusChanged:
          setKBFSJobStatus(action.payload.params.status)
          break
        case EngineGen.chat1NotifyChatChatArchiveComplete:
          loadChat()
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
        loadChat()
      }
      ignorePromise(f())
    },
    resetState: 'default',
    resetWaiters: () =>
      set(s => {
        s.archiveAllFilesResponseWaiter = {state: 'idle'}
        s.archiveAllGitResponseWaiter = {state: 'idle'}
      }),
    resumeChat: jobID => {
      const f = async () => {
        await T.RPCChat.localArchiveChatResumeRpcPromise({
          identifyBehavior: T.RPCGen.TLFIdentifyBehavior.unset,
          jobID,
        })
        // don't reload here, resume doesn't block for the job to actually restart
      }
      ignorePromise(f())
    },
    start: (type, target, outPath) => {
      switch (type) {
        case 'chatid':
          startChatArchiveCID(target, outPath)
          return
        case 'chatname':
          if (target === '.') {
            startChatArchiveAll(outPath)
          } else {
            startChatArchiveTeam(target, outPath)
          }
          break
        case 'kbfs':
          target === '/keybase' ? startFSArchiveAll(outPath) : startFSArchive(target, outPath)
          return
        case 'git':
          target === '.' ? startGitArchiveAll(outPath) : startGitArchive(target, outPath)
          return
      }
    },
  }
  return {
    ...initialStore,
    chatIDToDisplayname: (conversationIDKey: string) => {
      const you = storeRegistry.getState('current-user').username
      const cs = storeRegistry.getConvoState(conversationIDKey)
      const m = cs.meta
      if (m.teamname) {
        if (m.channelname) {
          return `${m.teamname}#${m.channelname}`
        }
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
