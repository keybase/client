/// <reference types="jest" />
import logger from '@/logger'
import {navigateAppendOnceRootHas, navigationRef} from '@/constants/router'
import {useRouterState} from '@/stores/router'

const dispatch = jest.fn()
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
// What the container's onStateChange does
const emitState = () => {
  useRouterState.getState().dispatch.setNavState(rootState as never)
}

beforeEach(() => {
  dispatch.mockReset()
  // the jest mock's container ref is a plain object, so stub its methods directly
  const nr = navigationRef as unknown as Record<string, unknown>
  nr['current'] = {}
  nr['dispatch'] = dispatch
  nr['getRootState'] = () => rootState
  nr['isReady'] = () => true
  // Not ready, the container's own listeners are a no-op: the wait must not depend on them
  nr['addListener'] = () => () => {}
})

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

// These drive the real container adapter, whose Navigator lives for the whole file. Each test
// pushes distinct params: its in-flight dupe check would otherwise swallow a same-shaped push
// from an earlier test.
const toUsername = (username: string) => ({
  path: () => ({name: 'username', params: {username}}) as never,
  rootOk: (root: string) => root === 'loggedOut',
})
const pushOf = (username: string) =>
  expect.objectContaining({payload: {name: 'username', params: {username}}, type: 'PUSH'})

test('pushes right away when the root already has the route', () => {
  setRootRoutes([loggedOut])

  navigateAppendOnceRootHas(toUsername('testuser-a'))

  expect(dispatch).toHaveBeenCalledTimes(1)
  expect(dispatch).toHaveBeenCalledWith(pushOf('testuser-a'))
})

test('waits for the root route to mount, then pushes once', () => {
  setRootRoutes([loggedIn])

  navigateAppendOnceRootHas(toUsername('testuser-b'))
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

  navigateAppendOnceRootHas(toUsername('testuser-c'))
  jest.advanceTimersByTime(5000)
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('gave up on root loggedIn, dropping username'))

  setRootRoutes([loggedOut])
  emitState()
  expect(dispatch).not.toHaveBeenCalled()
})

test('a container not ready yet is waited for: its onReady state is the next check', () => {
  setRootRoutes([loggedOut])
  const nr = navigationRef as unknown as Record<string, unknown>
  let ready = false
  nr['isReady'] = () => ready

  navigateAppendOnceRootHas(toUsername('testuser-d'))
  expect(dispatch).not.toHaveBeenCalled()

  ready = true
  emitState()

  expect(dispatch).toHaveBeenCalledTimes(1)
  expect(dispatch).toHaveBeenCalledWith(pushOf('testuser-d'))
})
