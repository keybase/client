/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'
import type {FakeNativeKbModule} from '@/test/fake-native-kb'

// the fade-out animation
jest.mock('./download-wrapper', () => ({children}: {children?: React.ReactNode}): React.ReactNode => children)
jest.mock('react-native-kb', () => jest.requireActual<FakeNativeKbModule>('@/test/fake-native-kb').realKb())

import type * as T from '@/constants/types'
import {Platform} from 'react-native'
import {cleanup, fireEvent, render, screen} from '@testing-library/react'
import {FsDataProvider} from '../common'
import {FsDaemonProvider} from '../common/daemon'
import * as Tabs from '@/constants/tabs'
import {useConfigState} from '@/stores/config'
import {navigationWrapper} from '@/test/navigation'
import {fakeNativeKb} from '@/test/fake-native-kb'
import {installFakeEngine} from '@/test/fake-engine'
import {flush} from '@/test/flush'
import {saveFinishedDownloadToPublicDownloads} from '@/util/fs-platform'
import {resetAllStores} from '@/util/zustand'
import Downloads from './downloads'

const g = globalThis as unknown as {isMobile: boolean; isAndroid: boolean}
const preloadFunctions = (globalThis as unknown as {_fromPreload: {functions: Record<string, unknown>}})._fromPreload
  .functions

const dlState = {
  canceled: false,
  done: true,
  downloadID: 'id1',
  endEstimate: 0,
  error: '',
  localPath: '/cache/a.pdf',
  progress: 1,
}

// The service, with kbfs up, has one download of a.pdf: finished, unless `state` says otherwise
const serve = (state: typeof dlState = dlState) => {
  const fake = installFakeEngine()
  fake.answer('keybase.1.config.waitForClient', () => true)
  fake.answer('keybase.1.SimpleFS.simpleFSSubscribeNonPath', () => null)
  fake.answer('keybase.1.SimpleFS.simpleFSUnsubscribe', () => null)
  // what the files screen tells the service when it comes up on a phone
  fake.answer('keybase.1.SimpleFS.simpleFSUserIn', () => null)
  fake.answer('keybase.1.SimpleFS.simpleFSConfigureDownload', () => null)
  fake.answer('keybase.1.SimpleFS.simpleFSGetDownloadStatus', (): T.RPCGen.DownloadStatus => ({
    regularDownloadIDs: ['id1'],
    states: [state],
  }))
  fake.answer('keybase.1.SimpleFS.simpleFSGetDownloadInfo', (): T.RPCGen.DownloadInfo => ({
    downloadID: 'id1',
    filename: 'a.pdf',
    isRegularDownload: true,
    path: {path: '/private/testuser/a.pdf'},
    startTime: 0,
  }))
  return fake
}

// The footer's download list on the files tab, signed in, once the service answered
const renderDownloads = async (layout: 'desktop' | 'phone' = 'desktop', state: typeof dlState = dlState) => {
  const fake = serve(state)
  useConfigState.setState({loggedIn: true})
  render(
    <FsDaemonProvider>
      <FsDataProvider>
        <Downloads />
      </FsDataProvider>
    </FsDaemonProvider>,
    {wrapper: navigationWrapper({layout, route: 'fsRoot', tab: Tabs.fsTab}).wrapper}
  )
  await flush()
  return fake
}

const filename = () => screen.getByText('a.pdf')
// react-native-web draws text with a press handler with a pointer cursor
// the native type-check, which has no DOM library, covers this file too, so jsdom's is typed here
const {getComputedStyle} = globalThis as unknown as {getComputedStyle: (el: unknown) => {cursor: string}}
const isTappable = () => getComputedStyle(filename()).cursor === 'pointer'

const onAndroid = () => {
  g.isMobile = true
  g.isAndroid = true
  jest.replaceProperty(Platform, 'OS', 'android')
}

afterEach(() => {
  cleanup()
  resetAllStores()
  g.isMobile = false
  g.isAndroid = false
  delete preloadFunctions['getPathType']
  delete preloadFunctions['openPathInFinder']
  jest.restoreAllMocks()
})

test("on Android, tapping a saved download's name opens it", async () => {
  onAndroid()
  const androidOpenFile = jest.fn(async (_o: {uri: string; mime: string}) => {})
  fakeNativeKb.give({androidOpenFile, androidSaveToDownloads: async () => Promise.resolve('content://dl/1')})
  await saveFinishedDownloadToPublicDownloads(
    'id1',
    dlState,
    {filename: 'a.pdf'} as T.FS.DownloadInfo,
    'application/pdf',
    () => {}
  )
  await renderDownloads('phone')
  expect(isTappable()).toBe(true)
  fireEvent.click(filename())
  expect(androidOpenFile).toHaveBeenCalledWith({mime: 'application/pdf', uri: 'content://dl/1'})
})

// Every way the name could open the file, as spies; a name with no tap handler opens none of them
const spyOnOpeners = () => {
  const androidOpenFile = jest.fn(async (_o: {uri: string; mime: string}) => {})
  const openPathInFinder = jest.fn(async (_path: string, _isFolder: boolean) => {})
  fakeNativeKb.give({androidOpenFile})
  preloadFunctions['getPathType'] = async () => Promise.resolve('file')
  preloadFunctions['openPathInFinder'] = openPathInFinder
  return {androidOpenFile, openPathInFinder}
}

test('on Android with no saved download yet, the name is not tappable and opens nothing', async () => {
  onAndroid()
  const openers = spyOnOpeners()
  await renderDownloads('phone')
  expect(isTappable()).toBe(false)
  fireEvent.click(filename())
  await flush()
  expect(openers.androidOpenFile).not.toHaveBeenCalled()
  expect(openers.openPathInFinder).not.toHaveBeenCalled()
})

test('on desktop, tapping the name opens the local path', async () => {
  const openPathInFinder = jest.fn(async (_path: string, _isFolder: boolean) => {})
  preloadFunctions['getPathType'] = async () => Promise.resolve('file')
  preloadFunctions['openPathInFinder'] = openPathInFinder
  await renderDownloads()
  fireEvent.click(filename())
  await flush()
  expect(openPathInFinder).toHaveBeenCalledWith('/cache/a.pdf', false)
})

test('on iOS the name is not tappable and opens nothing', async () => {
  g.isMobile = true
  g.isAndroid = false
  const openers = spyOnOpeners()
  await renderDownloads('phone')
  expect(isTappable()).toBe(false)
  fireEvent.click(filename())
  await flush()
  expect(openers.androidOpenFile).not.toHaveBeenCalled()
  expect(openers.openPathInFinder).not.toHaveBeenCalled()
})

// The card's remove icon: on a download still running it cancels it, and on a finished one it
// dismisses it. Each sends the service only that one call, for that download.
const removeIcon = () => {
  const icons = document.querySelectorAll<HTMLElement>('.icon-gen-iconfont-remove')
  expect(icons).toHaveLength(1)
  return icons[0]!
}

const sentOnRemove = async (state: typeof dlState) => {
  const fake = await renderDownloads('desktop', state)
  const sent: Array<{method: string; downloadID: string}> = []
  for (const method of ['keybase.1.SimpleFS.simpleFSCancelDownload', 'keybase.1.SimpleFS.simpleFSDismissDownload']) {
    fake.answer(method, (p: {downloadID: string}) => {
      sent.push({downloadID: p.downloadID, method})
      return null
    })
  }
  fireEvent.click(removeIcon())
  await flush()
  return sent
}

test("a running download's remove icon cancels it", async () => {
  expect(await sentOnRemove({...dlState, done: false, progress: 0.3})).toEqual([
    {downloadID: 'id1', method: 'keybase.1.SimpleFS.simpleFSCancelDownload'},
  ])
})

test("a finished download's remove icon dismisses it", async () => {
  expect(await sentOnRemove(dlState)).toEqual([{downloadID: 'id1', method: 'keybase.1.SimpleFS.simpleFSDismissDownload'}])
})
