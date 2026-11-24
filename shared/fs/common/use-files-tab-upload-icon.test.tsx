/** @jest-environment jsdom */
/// <reference types="jest" />
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {act, cleanup, render, screen} from '@testing-library/react'
import {useConfigState} from '@/stores/config'
import {useDaemonState} from '@/stores/daemon'
import {installFakeEngine, uninstallFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {flush} from '@/test/flush'
import {resetAllStores} from '@/util/zustand'
import {FsDaemonProvider} from './daemon'
import {filesTabBadgeToUploadIcon, useFilesTabUploadIcon} from './use-files-tab-upload-icon'

test('awaitingUpload maps to AwaitingToUpload', () => {
  expect(filesTabBadgeToUploadIcon(T.RPCGen.FilesTabBadge.awaitingUpload)).toBe(
    T.FS.UploadIcon.AwaitingToUpload
  )
})

test('uploadingStuck maps to UploadingStuck', () => {
  expect(filesTabBadgeToUploadIcon(T.RPCGen.FilesTabBadge.uploadingStuck)).toBe(
    T.FS.UploadIcon.UploadingStuck
  )
})

test('uploading maps to Uploading', () => {
  expect(filesTabBadgeToUploadIcon(T.RPCGen.FilesTabBadge.uploading)).toBe(T.FS.UploadIcon.Uploading)
})

test('none maps to undefined', () => {
  expect(filesTabBadgeToUploadIcon(T.RPCGen.FilesTabBadge.none)).toBeUndefined()
})

test('an unknown badge value falls through to undefined', () => {
  expect(filesTabBadgeToUploadIcon(999 as T.RPCGen.FilesTabBadge)).toBeUndefined()
})

test('every declared FilesTabBadge value maps to its own icon', () => {
  const expected = new Map<T.RPCGen.FilesTabBadge, T.FS.UploadIcon | undefined>([
    [T.RPCGen.FilesTabBadge.none, undefined],
    [T.RPCGen.FilesTabBadge.uploadingStuck, T.FS.UploadIcon.UploadingStuck],
    [T.RPCGen.FilesTabBadge.awaitingUpload, T.FS.UploadIcon.AwaitingToUpload],
    [T.RPCGen.FilesTabBadge.uploading, T.FS.UploadIcon.Uploading],
  ])
  const values = Object.values(T.RPCGen.FilesTabBadge).filter(
    (v): v is T.RPCGen.FilesTabBadge => typeof v === 'number'
  )
  // every declared value is covered by the table above, and nothing is missing
  expect(new Set(values)).toEqual(new Set(expected.keys()))
  for (const v of values) {
    expect(filesTabBadgeToUploadIcon(v)).toBe(expected.get(v))
  }
  // and no two badges share an icon
  const icons = [...expected.values()].filter(Boolean)
  expect(new Set(icons).size).toBe(icons.length)
})

describe('the upload icon', () => {
  let fake: FakeEngine
  // what the service reports now
  let badge: T.RPCGen.FilesTabBadge
  const badgeSubscriptions = () =>
    fake.calls.filter(
      c =>
        c.method === 'keybase.1.SimpleFS.simpleFSSubscribeNonPath' &&
        c.params.topic === T.RPCGen.SubscriptionTopic.filesTabBadge
    )

  const Icon = () => {
    const icon = useFilesTabUploadIcon()
    return <Kb.Text type="Body">{`icon: ${icon ?? 'none'}`}</Kb.Text>
  }

  beforeEach(() => {
    badge = T.RPCGen.FilesTabBadge.none
    fake = installFakeEngine()
    useConfigState.setState({loggedIn: true})
    fake.answer('keybase.1.config.waitForClient', () => true)
    fake.answer('keybase.1.SimpleFS.simpleFSSubscribeNonPath', () => null)
    fake.answer('keybase.1.SimpleFS.simpleFSUnsubscribe', () => null)
    fake.answer('keybase.1.SimpleFS.simpleFSGetFilesTabBadge', () => badge)
    fake.answer('keybase.1.config.getBootstrapStatus', () => ({
      loggedIn: true,
      sessionSeq: 0,
      uid: 'uid',
      username: 'testuser',
    }))
  })
  afterEach(() => {
    cleanup()
    uninstallFakeEngine()
    resetAllStores()
  })

  // Whether the service restarted or only the link dropped, a change made while the app was away
  // sent it no notification, and KBFS stays connected throughout. The new connection subscribes
  // again and rereads the badge.
  test('a reconnect subscribes again and rereads the badge', async () => {
    useDaemonState.getState().dispatch.initBootstrapSteps([], async () => {})
    act(() => useDaemonState.getState().dispatch.startHandshake())
    await flush()
    render(
      <FsDaemonProvider>
        <Icon />
      </FsDaemonProvider>
    )
    await flush(8)
    screen.getByText('icon: none')
    expect(badgeSubscriptions()).toHaveLength(1)

    act(() => fake.drop())
    await flush()
    badge = T.RPCGen.FilesTabBadge.uploading
    act(() => fake.restart())
    await flush()
    act(() => useDaemonState.getState().dispatch.startHandshake())
    await flush(8)

    expect(badgeSubscriptions()).toHaveLength(2)
    screen.getByText(`icon: ${T.FS.UploadIcon.Uploading}`)
  })
})
