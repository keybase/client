/** @jest-environment jsdom */
/// <reference types="jest" />
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {act, cleanup, render, screen} from '@testing-library/react'
import {useConfigState} from '@/stores/config'
import {useDaemonState} from '@/stores/daemon'
import {installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {flush} from '@/test/flush'
import {_onEngineIncoming} from '@/constants/init/shared'
import {resetAllStores} from '@/util/zustand'
import {clientID} from './client'
import {FsStatusProvider, useFsUploadStatus} from './status'
import UploadContainer from '../footer/upload-container'

const syncStatus = 'keybase.1.SimpleFS.simpleFSSyncStatus'

let fake: FakeEngine
// what the journal holds now, as the service reports it
let journal: T.RPCGen.FSSyncStatus

const UploadStatus = () => {
  const {syncingPaths, totalSyncingBytes} = useFsUploadStatus()
  return <Kb.Text type="Body">{`${syncingPaths.size} paths, ${totalSyncingBytes} bytes`}</Kb.Text>
}

const notifyJournalStatus = async () => {
  await fake.push(
    'keybase.1.NotifyFS.FSSubscriptionNotify',
    {clientID, topic: T.RPCGen.SubscriptionTopic.journalStatus},
    {oneway: true}
  )
  await flush()
}

const syncStatusCalls = () => fake.calls.filter(c => c.method === syncStatus).length

beforeEach(() => {
  journal = {endEstimate: null, syncingPaths: null, totalSyncingBytes: 0}
  fake = installFakeEngine({onEngineIncoming: _onEngineIncoming})
  useConfigState.setState({loggedIn: true})
  useDaemonState.setState({handshakeState: 'done'})
  fake.answer('keybase.1.config.waitForClient', () => true)
  fake.answer('keybase.1.SimpleFS.simpleFSSubscribeNonPath', () => null)
  fake.answer('keybase.1.SimpleFS.simpleFSUnsubscribe', () => null)
  fake.answer('keybase.1.SimpleFS.simpleFSSettings', () => ({spaceAvailableNotificationThreshold: 0}))
  fake.answer('keybase.1.SimpleFS.simpleFSGetUploadStatus', () => null)
  fake.answer(syncStatus, () => journal)
})

afterEach(() => {
  cleanup()
  resetAllStores()
})

const renderStatus = async () => {
  render(
    <FsStatusProvider>
      <UploadStatus />
    </FsStatusProvider>
  )
  await flush()
}

test('a journal status notification refetches the sync status', async () => {
  await renderStatus()
  screen.getByText('0 paths, 0 bytes')

  journal = {
    endEstimate: Date.now() + 5000,
    syncingPaths: ['/keybase/private/testuser/a.pdf'],
    totalSyncingBytes: 585,
  }
  await notifyJournalStatus()
  screen.getByText('1 paths, 585 bytes')

  journal = {endEstimate: null, syncingPaths: null, totalSyncingBytes: 0}
  await notifyJournalStatus()
  screen.getByText('0 paths, 0 bytes')
})

// The service publishes the journal status whenever it changes, including when the last MD
// flushes, so an unflushed journal is not read again until it says so.
test('an unflushed journal is not polled', async () => {
  journal = {endEstimate: Date.now(), syncingPaths: ['/keybase/private/testuser/a.pdf'], totalSyncingBytes: 585}
  await renderStatus()
  screen.getByText('1 paths, 585 bytes')
  const calls = syncStatusCalls()

  await act(async () => new Promise(resolve => setTimeout(resolve, 300)))
  await flush()

  expect(syncStatusCalls()).toBe(calls)
})

// Under a steady stream of notifications, one read is in flight at a time, each answer is
// shown, and notices that came in during a read get one more read after it.
test('notifications during a slow read coalesce into one more read', async () => {
  await renderStatus()
  const held = fake.hold(syncStatus)
  await notifyJournalStatus()
  await notifyJournalStatus()
  await notifyJournalStatus()
  expect(held).toHaveLength(1)

  held[0]?.reply({endEstimate: null, syncingPaths: ['/keybase/private/testuser/a.pdf'], totalSyncingBytes: 585})
  await flush()
  screen.getByText('1 paths, 585 bytes')
  expect(held).toHaveLength(2)

  held[1]?.reply({endEstimate: null, syncingPaths: null, totalSyncingBytes: 0})
  await flush()
  screen.getByText('0 paths, 0 bytes')
  expect(held).toHaveLength(2)
})

const renderUploadFooter = async () => {
  render(
    <FsStatusProvider>
      <UploadContainer />
    </FsStatusProvider>
  )
  await flush()
}

// The service leaves folders out of syncingFilePaths, so a new file in a folder reads as one file.
test('the upload footer counts the files the service reports, not the folders', async () => {
  journal = {
    endEstimate: Date.now() + 5000,
    syncingFilePaths: ['/keybase/private/testuser/dir/a.pdf', '/keybase/private/testuser/dir/b.pdf'],
    syncingPaths: [
      '/keybase/private/testuser/dir',
      '/keybase/private/testuser/dir/a.pdf',
      '/keybase/private/testuser/dir/b.pdf',
    ],
    totalSyncingBytes: 585,
  }
  await renderUploadFooter()

  screen.getByText('Encrypting and updating 2 items...')
})

test('a service that sends no file list counts every syncing path', async () => {
  journal = {
    endEstimate: Date.now() + 5000,
    syncingPaths: ['/keybase/private/testuser/dir', '/keybase/private/testuser/dir/a.pdf'],
    totalSyncingBytes: 585,
  }
  await renderUploadFooter()

  screen.getByText('Encrypting and updating 2 items...')
})

test('an empty file list counts no files even while folders sync', async () => {
  journal = {
    endEstimate: Date.now() + 5000,
    syncingFilePaths: [],
    syncingPaths: ['/keybase/private/testuser/dir'],
    totalSyncingBytes: 585,
  }
  await renderUploadFooter()

  screen.getByText('Encrypting and updating items...')
})

// Whether the service restarted or only the link dropped, a change made while the app was away sent
// it no notification, and KBFS stays connected throughout. The new connection subscribes again and
// rereads what changed.
test('a reconnect subscribes again and rereads the journal', async () => {
  const journalSubscriptions = () =>
    fake.calls.filter(
      c =>
        c.method === 'keybase.1.SimpleFS.simpleFSSubscribeNonPath' &&
        c.params.topic === T.RPCGen.SubscriptionTopic.journalStatus
    )
  fake.answer('keybase.1.config.getBootstrapStatus', () => ({
    loggedIn: true,
    sessionSeq: 0,
    uid: 'uid',
    username: 'testuser',
  }))
  useDaemonState.getState().dispatch.initBootstrapSteps([])
  act(() => useDaemonState.getState().dispatch.startHandshake())
  await flush()
  await renderStatus()
  screen.getByText('0 paths, 0 bytes')
  expect(journalSubscriptions()).toHaveLength(1)

  act(() => fake.drop())
  await flush()
  journal = {endEstimate: null, syncingPaths: ['/keybase/private/testuser/a.pdf'], totalSyncingBytes: 585}
  act(() => fake.restart())
  await flush()
  act(() => useDaemonState.getState().dispatch.startHandshake())
  await flush(8)

  expect(journalSubscriptions()).toHaveLength(2)
  screen.getByText('1 paths, 585 bytes')
})
