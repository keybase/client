/** @jest-environment jsdom */
/// <reference types="jest" />
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {cleanup, render, screen} from '@testing-library/react'
import * as Tabs from '@/constants/tabs'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {navigationWrapper} from '@/test/navigation'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {flush} from '@/test/flush'
import {resetAllStores} from '@/util/zustand'
import {FsDaemonProvider} from './daemon'
import {FsDataProvider, useFsFolderChildItems, useFsScreenCoordinator} from './hooks'

const subscribePath = 'keybase.1.SimpleFS.simpleFSSubscribePath'
const folder = T.FS.stringToPath('/keybase/private/testuser/work')

let fake: FakeEngine
// what the folder holds now, as the service lists it
let entries: Array<T.RPCGen.Dirent> = []

const dirent = (name: string): T.RPCGen.Dirent => ({
  direntType: T.RPCGen.DirentType.file,
  lastWriterUnverified: {uid: '', username: 'testuser'},
  name,
  prefetchProgress: {bytesFetched: 0, bytesTotal: 0, endEstimate: 0, start: 0},
  prefetchStatus: T.RPCGen.PrefetchStatus.notStarted,
  size: 585,
  symlinkTarget: '',
  time: 0,
  writable: true,
})

// The folder's screen, as the Files tab draws it: its coordinator, and the names it lists
const FolderScreen = () => {
  useFsScreenCoordinator(folder)
  const {childPaths} = useFsFolderChildItems(folder)
  return (
    <>
      {childPaths.map(p => (
        <Kb.Text key={T.FS.pathToString(p)} type="Body">
          {T.FS.getPathName(p)}
        </Kb.Text>
      ))}
    </>
  )
}

beforeEach(() => {
  entries = []
  fake = installFakeEngine()
  useConfigState.setState({loggedIn: true})
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'testuser-mac',
    uid: 'uid',
    username: 'testuser',
  })
  fake.answer('keybase.1.config.waitForClient', () => true)
  fake.answer('keybase.1.SimpleFS.simpleFSSubscribeNonPath', () => null)
  fake.answer('keybase.1.SimpleFS.simpleFSUnsubscribe', () => null)
  fake.answer('keybase.1.SimpleFS.simpleFSUserIn', () => null)
  fake.answer('keybase.1.SimpleFS.simpleFSListFavorites', () => ({favoriteFolders: [], ignoredFolders: [], newFolders: []}))
  fake.answer('keybase.1.SimpleFS.simpleFSStat', () => ({...dirent('work'), direntType: T.RPCGen.DirentType.dir}))
  fake.answer('keybase.1.SimpleFS.simpleFSListRecursiveToDepth', () => null)
  fake.answer('keybase.1.SimpleFS.simpleFSWait', () => null)
  fake.answer('keybase.1.SimpleFS.simpleFSReadList', () => ({entries, progress: 0}))
})

afterEach(() => {
  cleanup()
  resetAllStores()
})

// A change made before the service holds the folder's subscription sends no notification, so the
// screen reads the folder again once it does: here the listing was empty when the screen opened,
// and a file came in while the subscription was still on its way.
test('a file added before the folder subscription is live is listed once it is', async () => {
  const held = fake.hold(subscribePath)
  render(
    <FsDaemonProvider>
      <FsDataProvider>
        <FolderScreen />
      </FsDataProvider>
    </FsDaemonProvider>,
    {wrapper: navigationWrapper({route: 'fsRoot', tab: Tabs.fsTab}).wrapper}
  )
  await flush()
  expect(held.length).toBeGreaterThan(0)
  expect(screen.queryByText('e2e-c.pdf')).toBeNull()

  entries = [dirent('e2e-c.pdf')]
  for (const c of held) c.reply(null)
  await flush(8)

  screen.getByText('e2e-c.pdf')
})

// The subscription can answer while the screen's first read of the folder is still on its way: the
// read it asks for then runs after that one, rather than being dropped as a duplicate.
test('a subscription that answers during the first read still gets the folder read again', async () => {
  const heldSubscribes = fake.hold(subscribePath)
  const heldReads = fake.hold('keybase.1.SimpleFS.simpleFSReadList')
  render(
    <FsDaemonProvider>
      <FsDataProvider>
        <FolderScreen />
      </FsDataProvider>
    </FsDaemonProvider>,
    {wrapper: navigationWrapper({route: 'fsRoot', tab: Tabs.fsTab}).wrapper}
  )
  await flush()
  expect(heldReads).toHaveLength(1)

  // the file comes in, then the subscription answers, while the first read (empty) is held
  entries = [dirent('e2e-c.pdf')]
  for (const c of heldSubscribes) c.reply(null)
  await flush()
  expect(heldReads).toHaveLength(1)
  heldReads[0]?.reply({entries: [], progress: 0})
  await flush()
  expect(heldReads).toHaveLength(2)
  heldReads[1]?.reply({entries, progress: 0})
  await flush()

  screen.getByText('e2e-c.pdf')
})

// A read that fails still leaves the read asked for during it to run.
test('a read asked for during a failed read still runs', async () => {
  const heldSubscribes = fake.hold(subscribePath)
  const heldReads = fake.hold('keybase.1.SimpleFS.simpleFSReadList')
  render(
    <FsDaemonProvider>
      <FsDataProvider>
        <FolderScreen />
      </FsDataProvider>
    </FsDaemonProvider>,
    {wrapper: navigationWrapper({route: 'fsRoot', tab: Tabs.fsTab}).wrapper}
  )
  await flush()
  expect(heldReads).toHaveLength(1)

  entries = [dirent('e2e-c.pdf')]
  for (const c of heldSubscribes) c.reply(null)
  await flush()
  heldReads[0]?.reply(fakeError(100, 'listing failed'))
  await flush()
  expect(heldReads).toHaveLength(2)
  heldReads[1]?.reply({entries, progress: 0})
  await flush()

  screen.getByText('e2e-c.pdf')
})
