/// <reference types="jest" />
import logger from '@/logger'
import {navigateAppendOnceRootHas, navigationRef} from '@/constants/router'
import {useRouterState} from '@/stores/router'

const dispatch = jest.fn()
// The mounted container's own 'state' listeners.
let listeners = new Set<() => void>()
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
// A commit, as the container reports it: to its own listeners, and through onStateChange to the router store.
const emitState = () => {
  for (const l of [...listeners]) {
    l()
  }
  useRouterState.getState().dispatch.setNavState(rootState as never)
}

// The container stubs, for one mounted container with its own listeners.
const mountContainer = () => {
  const own = new Set<() => void>()
  listeners = own
  const nr = navigationRef as unknown as Record<string, unknown>
  nr['current'] = {}
  nr['dispatch'] = dispatch
  nr['getRootState'] = () => rootState
  nr['isReady'] = () => true
  nr['addListener'] = (_: string, cb: () => void) => {
    own.add(cb)
    return () => own.delete(cb)
  }
}

beforeEach(() => {
  dispatch.mockReset()
  // the jest mock's container ref is a plain object, so stub its methods directly
  mountContainer()
})

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

// These drive the real container adapter, whose Navigator lives for the whole file. Each test
// pushes distinct params: its in-flight dupe check would otherwise swallow a same-shaped push
// from an earlier test.
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

  const onDrop = jest.fn()
  navigateAppendOnceRootHas('loggedOut', {name: 'username', params: {username: 'testuser-c'}} as never, 5000, onDrop)
  jest.advanceTimersByTime(4999)
  expect(onDrop).not.toHaveBeenCalled()
  jest.advanceTimersByTime(1)
  expect(onDrop).toHaveBeenCalledTimes(1)
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

test('a cancelled wait neither pushes nor reports a drop', () => {
  jest.useFakeTimers()
  setRootRoutes([loggedIn])
  const onDrop = jest.fn()

  const cancel = navigateAppendOnceRootHas(
    'loggedOut',
    {name: 'username', params: {username: 'testuser-e'}} as never,
    5000,
    onDrop
  )
  cancel()
  setRootRoutes([loggedOut])
  emitState()
  jest.advanceTimersByTime(5000)

  expect(dispatch).not.toHaveBeenCalled()
  expect(onDrop).not.toHaveBeenCalled()
})

test("'untilCancelled' never gives up: a root mounting late still gets the push", () => {
  jest.useFakeTimers()
  setRootRoutes([loggedIn])
  const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})

  navigateAppendOnceRootHas(
    'loggedOut',
    {name: 'username', params: {username: 'testuser-f'}} as never,
    'untilCancelled'
  )
  jest.advanceTimersByTime(60_000)
  expect(warn).not.toHaveBeenCalled()

  setRootRoutes([loggedOut])
  emitState()
  expect(dispatch).toHaveBeenCalledTimes(1)
  expect(dispatch).toHaveBeenCalledWith(pushOf('testuser-f'))
})

// An account switch remounts the NavigationContainer under a new key. A listener added to the old container
// stays with it and never hears the new one, so the wait has to outlive the container.
test("'untilCancelled' survives the container remounting", () => {
  setRootRoutes([loggedIn])

  navigateAppendOnceRootHas(
    'loggedOut',
    {name: 'username', params: {username: 'testuser-g'}} as never,
    'untilCancelled'
  )
  mountContainer()
  setRootRoutes([loggedOut])
  emitState()

  expect(dispatch).toHaveBeenCalledTimes(1)
  expect(dispatch).toHaveBeenCalledWith(pushOf('testuser-g'))
})

// Between the old container going and the new one mounting there is no navigator to listen to.
test("'untilCancelled' started with no navigator pushes once a container mounts with the root", () => {
  setRootRoutes([loggedIn])
  const nr = navigationRef as unknown as Record<string, unknown>
  nr['isReady'] = () => false
  const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})

  navigateAppendOnceRootHas(
    'loggedOut',
    {name: 'username', params: {username: 'testuser-h'}} as never,
    'untilCancelled'
  )
  expect(warn).not.toHaveBeenCalled()

  mountContainer()
  setRootRoutes([loggedOut])
  emitState()
  expect(dispatch).toHaveBeenCalledTimes(1)
  expect(dispatch).toHaveBeenCalledWith(pushOf('testuser-h'))
})
