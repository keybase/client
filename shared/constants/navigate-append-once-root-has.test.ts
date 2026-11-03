/** @jest-environment jsdom */
/// <reference types="jest" />
// A push whose target lives in a root group a store change is about to mount, on the real tree:
// the logged-out stack, mounted by the session logging out.
import logger from '@/logger'
import {navigateAppend, navigateAppendOnceRootHas, navigateUp} from '@/constants/router'
import {installNavigation, makeRootState, renders, rendersUntil, type MountedNavigation} from '@/test/navigation'

let nav: MountedNavigation

afterEach(() => {
  jest.restoreAllMocks()
})


const usernamePush = (username: string) => ({name: 'username', params: {username}})
const pushesOfUsername = () => nav.pushes().filter(p => p.name === 'username')

test('pushes right away when the root already has the route', () => {
  nav = installNavigation({rootState: makeRootState({loggedIn: false})})

  navigateAppendOnceRootHas('loggedOut', usernamePush('testuser') as never)

  expect(nav.pushes()).toEqual([usernamePush('testuser')])
  expect(nav.visibleScreen()).toMatchObject(usernamePush('testuser'))
})

test('waits for the root route to mount, then pushes once', async () => {
  nav = installNavigation({rootState: makeRootState()})

  navigateAppendOnceRootHas('loggedOut', usernamePush('testuser') as never)
  expect(nav.actions).toEqual([])

  // a state change that does not mount the group
  navigateAppend({name: 'profile', params: {username: 'testuser-mac'}})
  await renders(100)
  expect(pushesOfUsername()).toEqual([])

  nav.setLoggedIn(false)
  await rendersUntil(() => pushesOfUsername().length > 0)
  expect(pushesOfUsername()).toEqual([usernamePush('testuser')])
  expect(nav.visibleScreen()).toMatchObject(usernamePush('testuser'))

  navigateUp()
  await renders(100)
  expect(pushesOfUsername()).toHaveLength(1)
})

test('gives up if the root route does not mount before the timeout', async () => {
  nav = installNavigation({rootState: makeRootState()})
  const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})

  navigateAppendOnceRootHas('loggedOut', usernamePush('testuser') as never, 20)
  await rendersUntil(() => warn.mock.calls.length > 0)
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('loggedOut never mounted, dropping username'))

  nav.setLoggedIn(false)
  await renders(100)
  expect(nav.pushes()).toEqual([])
  expect(nav.visibleScreen()?.name).toBe('login')
})

test('logs the push it drops when there is no navigator', () => {
  nav = installNavigation({ready: false})
  const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})

  navigateAppendOnceRootHas('loggedOut', usernamePush('testuser') as never)

  expect(warn).toHaveBeenCalledWith(expect.stringContaining('no navigator, dropping username'))
  expect(nav.actions).toEqual([])
})
