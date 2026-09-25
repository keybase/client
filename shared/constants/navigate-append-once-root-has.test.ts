/// <reference types="jest" />
import logger from '@/logger'
import {navigateAppendOnceRootHas, navigationRef} from '@/constants/router'

const dispatch = jest.fn()
const listeners = new Set<() => void>()
let rootState: unknown

const loggedIn = {key: 'loggedIn-1', name: 'loggedIn'}
const loggedOut = {
  key: 'loggedOut-1',
  name: 'loggedOut',
  state: {index: 0, key: 'loggedOutStack-1', routes: [{key: 'login-1', name: 'login'}], type: 'stack'},
}

const setRootRoutes = (routes: Array<unknown>) => {
  rootState = {index: routes.length - 1, key: 'root-1', routeNames: [], routes, stale: false, type: 'stack'}
}
const emitState = () => {
  for (const l of [...listeners]) {
    l()
  }
}

beforeEach(() => {
  dispatch.mockReset()
  listeners.clear()
  // the jest mock's container ref is a plain object, so stub its methods directly
  const nr = navigationRef as unknown as Record<string, unknown>
  nr['current'] = {}
  nr['dispatch'] = dispatch
  nr['getRootState'] = () => rootState
  nr['isReady'] = () => true
  nr['addListener'] = (_: string, cb: () => void) => {
    listeners.add(cb)
    return () => listeners.delete(cb)
  }
})

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

// Each test pushes distinct params: navigateAppend's module-private `_pendingAppend` dupe cache
// would otherwise swallow a same-shaped push from an earlier test.
const pushOf = (username: string) =>
  expect.objectContaining({payload: {name: 'username', params: {username}}, type: 'PUSH'})

test('pushes right away when the root already has the route', () => {
  setRootRoutes([loggedOut])

  navigateAppendOnceRootHas('loggedOut', {name: 'username', params: {username: 'testuser-a'}} as never)

  expect(dispatch).toHaveBeenCalledTimes(1)
  expect(dispatch).toHaveBeenCalledWith(pushOf('testuser-a'))
})

test('waits for the root route to mount, then pushes once', () => {
  setRootRoutes([loggedIn])

  navigateAppendOnceRootHas('loggedOut', {name: 'username', params: {username: 'testuser-b'}} as never)
  expect(dispatch).not.toHaveBeenCalled()

  emitState()
  expect(dispatch).not.toHaveBeenCalled()

  setRootRoutes([loggedOut])
  emitState()
  expect(dispatch).toHaveBeenCalledTimes(1)
  expect(dispatch).toHaveBeenCalledWith(pushOf('testuser-b'))

  emitState()
  expect(dispatch).toHaveBeenCalledTimes(1)
})

test('gives up if the root route does not mount before the timeout', () => {
  jest.useFakeTimers()
  setRootRoutes([loggedIn])

  const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})

  navigateAppendOnceRootHas('loggedOut', {name: 'username', params: {username: 'testuser-c'}} as never, 5000)
  jest.advanceTimersByTime(5000)
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('loggedOut never mounted, dropping username'))

  setRootRoutes([loggedOut])
  emitState()
  expect(dispatch).not.toHaveBeenCalled()
})

test('logs the push it drops when there is no navigator', () => {
  setRootRoutes([loggedIn])
  const nr = navigationRef as unknown as Record<string, unknown>
  nr['isReady'] = () => false
  const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})

  navigateAppendOnceRootHas('loggedOut', {name: 'username', params: {username: 'testuser-d'}} as never)

  expect(warn).toHaveBeenCalledWith(expect.stringContaining('no navigator, dropping username'))
  expect(dispatch).not.toHaveBeenCalled()
})
