/// <reference types="jest" />
import * as T from '@/constants/types'
import {formatTimeForPopup} from '@/util/timestamp'
import {mapChatJobs, mapKBFSJobs, updateChatProgress} from './job-state'

const noConversationCommands = {
  typ: T.RPCChat.ConversationCommandGroupsTyp.none,
} satisfies T.RPCChat.ConversationCommandGroups

const makeInboxQuery = (overrides: Partial<T.RPCChat.GetInboxLocalQuery> = {}): T.RPCChat.GetInboxLocalQuery => ({
  computeActiveList: false,
  readOnly: false,
  unreadOnly: false,
  ...overrides,
})

const makeArchiveChatJobRequest = (
  overrides: Partial<T.RPCChat.ArchiveChatJobRequest> = {}
): T.RPCChat.ArchiveChatJobRequest => ({
  compress: false,
  identifyBehavior: T.RPCGen.TLFIdentifyBehavior.unset,
  jobID: 'job',
  outputPath: '/tmp/job',
  query: undefined,
  ...overrides,
})

const makeInboxUIItem = (overrides: Partial<T.RPCChat.InboxUIItem> = {}): T.RPCChat.InboxUIItem => ({
  botAliases: undefined,
  botCommands: noConversationCommands,
  channel: '',
  commands: noConversationCommands,
  convID: 'conv-id',
  convRetention: undefined,
  convSettings: undefined,
  creatorInfo: undefined,
  draft: undefined,
  finalizeInfo: undefined,
  headline: '',
  headlineDecorated: '',
  isDefaultConv: false,
  isEmpty: false,
  isPublic: false,
  localVersion: 0,
  maxMsgID: 0,
  maxVisibleMsgID: 0,
  memberStatus: T.RPCChat.ConversationMemberStatus.active,
  membersType: T.RPCChat.ConversationMembersType.kbfs,
  name: '',
  notifications: undefined,
  participants: undefined,
  pinnedMsg: undefined,
  readMsgID: 0,
  resetParticipants: undefined,
  snippet: '',
  snippetDecorated: '',
  snippetDecoration: T.RPCChat.SnippetDecoration.none,
  status: T.RPCChat.ConversationStatus.unfiled,
  supersededBy: undefined,
  supersedes: undefined,
  teamRetention: undefined,
  teamType: T.RPCChat.TeamType.none,
  time: 0,
  tlfID: 'tlf-id',
  topicType: T.RPCChat.TopicType.chat,
  version: 0,
  visibility: T.RPCGen.TLFVisibility.private,
  ...overrides,
})

const makeArchiveChatJob = (overrides: Partial<T.RPCChat.ArchiveChatJob> = {}): T.RPCChat.ArchiveChatJob => ({
  checkpoints: undefined,
  err: '',
  matchingConvs: undefined,
  messagesComplete: 0,
  messagesTotal: 0,
  request: makeArchiveChatJobRequest(),
  startedAt: 0,
  status: T.RPCChat.ArchiveChatJobStatus.running,
  ...overrides,
})

const makeKBFSArchiveJobStatus = (
  overrides: Partial<T.RPCGen.SimpleFSArchiveJobStatus> = {}
): T.RPCGen.SimpleFSArchiveJobStatus => ({
  bytesCopied: 0,
  bytesTotal: 0,
  bytesZipped: 0,
  completeCount: 0,
  desc: {
    gitRepo: undefined,
    jobID: 'job',
    kbfsPathWithRevision: {
      archivedParam: {KBFSArchivedType: T.RPCGen.KBFSArchivedType.revision, revision: 0},
      path: '/keybase/private/alice',
    },
    overwriteZip: false,
    stagingPath: '/tmp/staging',
    startTime: 0,
    targetName: 'job.zip',
    zipFilePath: '/tmp/job.zip',
  },
  error: undefined,
  inProgressCount: 0,
  phase: T.RPCGen.SimpleFSArchiveJobPhase.queued,
  skippedCount: 0,
  todoCount: 0,
  totalCount: 0,
  ...overrides,
})

test('mapKBFSJobs maps engine phases and archive metadata into UI jobs', () => {
  const jobs = mapKBFSJobs({
    jobs: [
      makeKBFSArchiveJobStatus({
        bytesCopied: 10,
        bytesTotal: 20,
        bytesZipped: 30,
        desc: {
          gitRepo: undefined,
          jobID: 'job-1',
          kbfsPathWithRevision: {
            archivedParam: {KBFSArchivedType: T.RPCGen.KBFSArchivedType.revision, revision: 7},
            path: '/keybase/private/alice',
          },
          overwriteZip: false,
          stagingPath: '/tmp/staging-1',
          startTime: 123,
          targetName: 'job-1.zip',
          zipFilePath: '/tmp/job-1.zip',
        },
        error: {error: 'retry later', nextRetry: 456},
        phase: T.RPCGen.SimpleFSArchiveJobPhase.done,
      }),
      makeKBFSArchiveJobStatus({
        bytesCopied: 0,
        bytesTotal: 99,
        bytesZipped: 0,
        desc: {
          gitRepo: 'keybase/client',
          jobID: 'job-2',
          kbfsPathWithRevision: {
            archivedParam: {KBFSArchivedType: T.RPCGen.KBFSArchivedType.time, time: 999},
            path: '/keybase/team/keybase',
          },
          overwriteZip: false,
          stagingPath: '/tmp/staging-2',
          startTime: 789,
          targetName: 'job-2.zip',
          zipFilePath: '/tmp/job-2.zip',
        },
        error: undefined,
        phase: T.RPCGen.SimpleFSArchiveJobPhase.indexing,
      }),
    ],
    lastUpdated: 0,
  })

  expect(jobs.get('job-1')).toMatchObject({
    bytesCopied: 10,
    bytesTotal: 20,
    bytesZipped: 30,
    error: 'retry later',
    kbfsPath: '/keybase/private/alice',
    kbfsRevision: 7,
    phase: 'Done',
    zipFilePath: '/tmp/job-1.zip',
  })
  expect(jobs.get('job-1')?.errorNextRetry).toBe(456)
  expect(jobs.get('job-1')?.started).toEqual(new Date(123))

  expect(jobs.get('job-2')).toMatchObject({
    gitRepo: 'keybase/client',
    kbfsRevision: 0,
    phase: 'Indexing',
  })
})

test('mapChatJobs derives UI context and progress from chat archive RPC jobs', () => {
  const jobs = mapChatJobs([
    makeArchiveChatJob({
      messagesComplete: 2,
      messagesTotal: 8,
      request: makeArchiveChatJobRequest({
        jobID: 'all-chat',
        outputPath: '/tmp/all-chat',
        query: undefined,
      }),
      startedAt: 111,
      status: T.RPCChat.ArchiveChatJobStatus.running,
    }),
    makeArchiveChatJob({
      matchingConvs: [makeInboxUIItem({channel: 'general', name: 'alice,bob'})],
      request: makeArchiveChatJobRequest({
        jobID: 'conv-chat',
        outputPath: '/tmp/conv-chat',
        query: makeInboxQuery({
          name: {membersType: T.RPCChat.ConversationMembersType.kbfs, name: 'alice,bob', tlfID: undefined},
          topicName: 'general',
        }),
      }),
      startedAt: 222,
      status: T.RPCChat.ArchiveChatJobStatus.queued,
    }),
    makeArchiveChatJob({
      request: makeArchiveChatJobRequest({
        jobID: 'pending-chat',
        outputPath: '/tmp/pending-chat',
        query: makeInboxQuery({
          name: {membersType: T.RPCChat.ConversationMembersType.kbfs, name: 'alice,bob', tlfID: undefined},
          topicName: '',
        }),
      }),
      startedAt: 333,
      status: T.RPCChat.ArchiveChatJobStatus.queued,
    }),
  ])

  expect(jobs.get('all-chat')).toMatchObject({
    context: '<all chat>',
    outPath: '/tmp/all-chat.tar.gzip',
    progress: 0.25,
    started: formatTimeForPopup(111),
    status: T.RPCChat.ArchiveChatJobStatus.running,
  })
  expect(jobs.get('conv-chat')).toMatchObject({
    context: 'alice,bob#general',
    progress: 0,
  })
  expect(jobs.get('pending-chat')).toMatchObject({
    context: '<pending>',
    progress: 0,
  })
})

test('updateChatProgress updates known jobs and requests reload for unknown jobs', () => {
  const initialJobs = new Map([
    [
      'job-1',
      {
        context: 'alice,bob',
        id: 'job-1',
        outPath: '/tmp/job-1.tar.gzip',
        progress: 0.1,
        started: 'now',
        status: T.RPCChat.ArchiveChatJobStatus.paused,
      },
    ],
  ])

  const next = updateChatProgress(initialJobs, {jobID: 'job-1', messagesComplete: 3, messagesTotal: 4})
  expect(next.reload).toBe(false)
  expect(next.chatJobs.get('job-1')).toMatchObject({
    progress: 0.75,
    status: T.RPCChat.ArchiveChatJobStatus.running,
  })
  expect(initialJobs.get('job-1')?.progress).toBe(0.1)

  const missing = updateChatProgress(initialJobs, {jobID: 'missing', messagesComplete: 1, messagesTotal: 2})
  expect(missing.reload).toBe(true)
  expect(missing.chatJobs).toBe(initialJobs)
})
