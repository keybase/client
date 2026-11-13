/** @jest-environment jsdom */
/// <reference types="jest" />
import {cleanup, fireEvent, render, screen} from '@testing-library/react'
import * as T from '@/constants/types'
import * as Tabs from '@/constants/tabs'
import {settingsArchiveTab} from '@/constants/settings'
import {navigationWrapper} from '@/test/navigation'
import {installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {flush} from '@/test/flush'
import {resetAllStores} from '@/util/zustand'
import Archive from '.'

// The Backup page's job controls, on the real page: what each sends the service, for the job it is
// on. The e2e flows back up small data that finishes at once, so a running or paused job's controls
// are covered here.

const chatList = 'chat.1.local.archiveChatList'
const chatPause = 'chat.1.local.archiveChatPause'
const chatResume = 'chat.1.local.archiveChatResume'
const chatDelete = 'chat.1.local.archiveChatDelete'
const kbfsStatus = 'keybase.1.SimpleFS.simpleFSGetArchiveStatus'
const kbfsFreshness = 'keybase.1.SimpleFS.simpleFSGetArchiveJobFreshness'
const kbfsCancel = 'keybase.1.SimpleFS.simpleFSArchiveCancelOrDismissJob'

const chatJob = (jobID: string, status: T.RPCChat.ArchiveChatJobStatus): T.RPCChat.ArchiveChatJob => ({
  checkpoints: undefined,
  err: '',
  matchingConvs: [
    {
      channel: '',
      convID: `conv-${jobID}`,
      name: 'testuser',
    } as T.RPCChat.InboxUIItem,
  ],
  messagesComplete: 1,
  messagesTotal: 4,
  request: {
    compress: true,
    identifyBehavior: T.RPCGen.TLFIdentifyBehavior.unset,
    jobID,
    outputPath: `/tmp/${jobID}`,
    query: {computeActiveList: false, readOnly: false, topicName: 'general', unreadOnly: false},
  },
  startedAt: 0,
  status,
})

const kbfsJob = (jobID: string, phase: T.RPCGen.SimpleFSArchiveJobPhase): T.RPCGen.SimpleFSArchiveJobStatus => ({
  bytesCopied: 10,
  bytesTotal: 100,
  bytesZipped: 0,
  completeCount: 0,
  desc: {
    gitRepo: undefined,
    jobID,
    kbfsPathWithRevision: {
      archivedParam: {KBFSArchivedType: T.RPCGen.KBFSArchivedType.revision, revision: 1},
      path: '/keybase/private/testuser/backup-me',
    },
    overwriteZip: false,
    stagingPath: `/tmp/staging-${jobID}`,
    startTime: 0,
    targetName: `${jobID}.zip`,
    zipFilePath: `/tmp/${jobID}.zip`,
  },
  error: undefined,
  inProgressCount: 1,
  phase,
  skippedCount: 0,
  todoCount: 1,
  totalCount: 2,
})

let fake: FakeEngine
let chatJobs: Array<T.RPCChat.ArchiveChatJob> = []
let kbfsJobs: Array<T.RPCGen.SimpleFSArchiveJobStatus> = []
let sent: Array<{method: string; params: object}> = []

const record = (method: string, after?: (params: {jobID: string}) => void) =>
  fake.answer(method, (all: {jobID: string; sessionID?: number}) => {
    const {sessionID: _, ...params} = all
    sent.push({method, params})
    after?.(params)
    return null
  })

const setStatus = (jobID: string, status: T.RPCChat.ArchiveChatJobStatus) => {
  chatJobs = chatJobs.map(j => (j.request.jobID === jobID ? {...j, status} : j))
}

beforeEach(() => {
  chatJobs = []
  kbfsJobs = []
  sent = []
  fake = installFakeEngine()
  fake.answer(chatList, () => ({jobs: chatJobs}))
  fake.answer(kbfsStatus, () => ({jobs: kbfsJobs, lastUpdated: 0}))
  fake.answer(kbfsFreshness, () => ({currentTLFRevision: 1}))
  record(chatPause, p => setStatus(p.jobID, T.RPCChat.ArchiveChatJobStatus.paused))
  record(chatResume)
  record(chatDelete, p => {
    chatJobs = chatJobs.filter(j => j.request.jobID !== p.jobID)
  })
  record(kbfsCancel)
})

afterEach(() => {
  cleanup()
  resetAllStores()
})

const renderPage = async () => {
  render(<Archive />, {wrapper: navigationWrapper({route: settingsArchiveTab, tab: Tabs.settingsTab}).wrapper})
  await flush()
}

const sentFor = (method: string) => sent.filter(s => s.method === method).map(s => s.params)

test("a running chat backup's Pause pauses that job, and the page then offers Resume", async () => {
  chatJobs = [chatJob('job-a', T.RPCChat.ArchiveChatJobStatus.running), chatJob('job-b', T.RPCChat.ArchiveChatJobStatus.running)]
  await renderPage()
  expect(screen.queryByText('Resume')).toBeNull()

  fireEvent.click(screen.getAllByText('Pause')[1]!)
  await flush()

  expect(sentFor(chatPause)).toEqual([{identifyBehavior: T.RPCGen.TLFIdentifyBehavior.unset, jobID: 'job-b'}])
  expect(screen.getAllByText('Pause')).toHaveLength(1)
  screen.getByText('Resume')
})

test("a paused chat backup's Resume resumes that job", async () => {
  chatJobs = [chatJob('job-a', T.RPCChat.ArchiveChatJobStatus.paused)]
  await renderPage()
  expect(screen.queryByText('Pause')).toBeNull()

  fireEvent.click(screen.getByText('Resume'))
  await flush()

  expect(sentFor(chatResume)).toEqual([{identifyBehavior: T.RPCGen.TLFIdentifyBehavior.unset, jobID: 'job-a'}])
})

test("a chat backup's Cancel deletes the job and its output, and the page drops its row", async () => {
  chatJobs = [chatJob('job-a', T.RPCChat.ArchiveChatJobStatus.running)]
  await renderPage()

  fireEvent.click(screen.getByText('Cancel'))
  await flush()

  expect(sentFor(chatDelete)).toEqual([
    {deleteOutputPath: true, identifyBehavior: T.RPCGen.TLFIdentifyBehavior.unset, jobID: 'job-a'},
  ])
  expect(screen.queryByText('Cancel')).toBeNull()
})

test("a running folder backup's Cancel cancels that job", async () => {
  kbfsJobs = [kbfsJob('kbfs-a', T.RPCGen.SimpleFSArchiveJobPhase.copying)]
  await renderPage()

  fireEvent.click(screen.getByText('Cancel'))
  await flush()

  expect(sentFor(kbfsCancel)).toEqual([{jobID: 'kbfs-a'}])
})
