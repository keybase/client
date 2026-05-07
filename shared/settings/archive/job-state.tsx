import * as T from '@/constants/types'
import {formatTimeForPopup} from '@/util/timestamp'

export type ChatArchiveJob = {
  id: string
  context: string
  started: string
  progress: number
  outPath: string
  error?: string
  status: T.RPCChat.ArchiveChatJobStatus
}

export type KBFSJobPhase = 'Queued' | 'Indexing' | 'Indexed' | 'Copying' | 'Copied' | 'Zipping' | 'Done'

export type KBFSArchiveJob = {
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
  errorNextRetry?: number
}

const kbfsJobPhaseToLabel: Record<T.RPCGen.SimpleFSArchiveJobPhase, KBFSJobPhase> = {
  [T.RPCGen.SimpleFSArchiveJobPhase.queued]: 'Queued',
  [T.RPCGen.SimpleFSArchiveJobPhase.indexing]: 'Indexing',
  [T.RPCGen.SimpleFSArchiveJobPhase.indexed]: 'Indexed',
  [T.RPCGen.SimpleFSArchiveJobPhase.copying]: 'Copying',
  [T.RPCGen.SimpleFSArchiveJobPhase.copied]: 'Copied',
  [T.RPCGen.SimpleFSArchiveJobPhase.zipping]: 'Zipping',
  [T.RPCGen.SimpleFSArchiveJobPhase.done]: 'Done',
}

const getChatJobContext = (job: T.RPCChat.ArchiveChatJob) => {
  if (!job.request.query?.name && !job.request.query?.topicName && !job.request.query?.convIDs?.length) {
    return '<all chat>'
  }
  if (!job.matchingConvs?.length) {
    return '<pending>'
  }
  const conv = job.matchingConvs.find(mc => mc.name)
  if (!conv?.name) {
    return ''
  }
  return conv.channel ? `${conv.name}#${conv.channel}` : conv.name
}

export const mapChatJobs = (jobs?: ReadonlyArray<T.RPCChat.ArchiveChatJob> | null) => {
  const chatJobs = new Map<string, ChatArchiveJob>()
  jobs?.forEach(job => {
    const id = job.request.jobID
    chatJobs.set(id, {
      context: getChatJobContext(job),
      error: job.err,
      id,
      outPath: `${job.request.outputPath}.tar.gzip`,
      progress: job.messagesTotal ? job.messagesComplete / job.messagesTotal : 0,
      started: formatTimeForPopup(job.startedAt),
      status: job.status,
    })
  })
  return chatJobs
}

export const mapKBFSJobs = (status: T.RPCGen.SimpleFSArchiveStatus) =>
  new Map<string, KBFSArchiveJob>(
    (status.jobs ?? []).map(job => [
      job.desc.jobID,
      {
        bytesCopied: job.bytesCopied,
        bytesTotal: job.bytesTotal,
        bytesZipped: job.bytesZipped,
        error: job.error?.error,
        errorNextRetry: job.error?.nextRetry,
        gitRepo: job.desc.gitRepo ?? undefined,
        id: job.desc.jobID,
        kbfsPath: job.desc.kbfsPathWithRevision.path,
        kbfsRevision:
          job.desc.kbfsPathWithRevision.archivedParam.KBFSArchivedType === T.RPCGen.KBFSArchivedType.revision
            ? job.desc.kbfsPathWithRevision.archivedParam.revision
            : 0,
        phase: kbfsJobPhaseToLabel[job.phase],
        started: new Date(job.desc.startTime),
        zipFilePath: job.desc.zipFilePath,
      },
    ])
  )

export const updateChatProgress = (
  chatJobs: Map<string, ChatArchiveJob>,
  p: {jobID: string; messagesComplete: number; messagesTotal: number}
) => {
  const job = chatJobs.get(p.jobID)
  if (!job) {
    return {chatJobs, reload: true}
  }
  return {
    chatJobs: new Map(chatJobs).set(p.jobID, {
      ...job,
      progress: p.messagesTotal ? p.messagesComplete / p.messagesTotal : 0,
      status: T.RPCChat.ArchiveChatJobStatus.running,
    }),
    reload: false,
  }
}
