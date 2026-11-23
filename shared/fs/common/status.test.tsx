/** @jest-environment jsdom */
/// <reference types="jest" />
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {act, cleanup, render, screen} from '@testing-library/react'
import {useConfigState} from '@/stores/config'
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

// The service leaves folders out of syncingFilePaths, so a new file in a folder reads as one file.
test('the upload footer counts the files the service reports, not the folders', async () => {
  journal = {
    endEstimate: Date.now() + 5000,
    syncingFilePaths: ['/keybase/private/testuser/dir/a.pdf'],
    syncingPaths: ['/keybase/private/testuser/dir', '/keybase/private/testuser/dir/a.pdf'],
    totalSyncingBytes: 585,
  }
  render(
    <FsStatusProvider>
      <UploadContainer />
    </FsStatusProvider>
  )
  await flush()

  screen.getByText('Encrypting and updating a.pdf...')
  expect(fake.calls.filter(c => c.method === 'keybase.1.SimpleFS.simpleFSStat')).toHaveLength(0)
})
