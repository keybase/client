/// <reference types="jest" />
import {useRouterState, type NavState} from '@/stores/router'
import {registerRouteGone} from './route-gone'

const setRootState = (state: NavState | undefined) =>
  useRouterState.getState().dispatch.setNavState(state)

// A root holding these routes, each a stack screen with these params; a nested stack under `nested`
const rootWith = (routes: Array<{key: string; params?: object}>, nested?: Array<{key: string; params?: object}>) =>
  ({
    index: routes.length - 1,
    key: 'root',
    routes: [
      ...routes.map(r => ({key: r.key, name: 'screen', params: r.params})),
      ...(nested
        ? [
            {
              key: 'stack-route',
              name: 'loggedOut',
              state: {
                index: 0,
                key: 'stack',
                routes: nested.map(r => ({key: r.key, name: 'screen', params: r.params})),
                type: 'stack',
              },
            },
          ]
        : []),
    ],
    type: 'stack',
  }) as unknown as NavState

const pending = () => {
  let resolve = () => {}
  const promise = new Promise<void>(_resolve => {
    resolve = _resolve
  })
  return {promise, resolve}
}

const settle = async () => new Promise(resolve => setTimeout(resolve, 0))

let n = 0
let key = ''
beforeEach(() => {
  key = `screen-${n++}`
  setRootState(rootWith([]))
})

test('a route that leaves the state is gone once, with its params as last seen', () => {
  const onGone = jest.fn()
  setRootState(rootWith([{key, params: {promptId: 1}}]))
  registerRouteGone(key, pending().promise, onGone)
  setRootState(rootWith([{key, params: {promptId: 2}}]))
  expect(onGone).not.toHaveBeenCalled()

  setRootState(rootWith([]))
  setRootState(rootWith([{key: 'other'}]))

  expect(onGone).toHaveBeenCalledTimes(1)
  expect(onGone).toHaveBeenCalledWith({promptId: 2})
})

test('a route in a nested navigator is found, and is gone when its navigator goes', () => {
  const onGone = jest.fn()
  registerRouteGone(key, pending().promise, onGone)
  setRootState(rootWith([{key: 'app'}], [{key, params: {promptId: 3}}]))
  expect(onGone).not.toHaveBeenCalled()

  setRootState(rootWith([{key: 'app'}]))

  expect(onGone).toHaveBeenCalledWith({promptId: 3})
})

test('a route registered before it reaches the state is not gone until it has been there', () => {
  const onGone = jest.fn()
  registerRouteGone(key, pending().promise, onGone)
  setRootState(rootWith([{key: 'other'}]))
  expect(onGone).not.toHaveBeenCalled()

  setRootState(rootWith([{key}]))
  setRootState(rootWith([{key: 'other'}]))

  expect(onGone).toHaveBeenCalledTimes(1)
})

test('a route that stays (a removal prevented, a screen covered) is not gone', () => {
  const onGone = jest.fn()
  setRootState(rootWith([{key}]))
  registerRouteGone(key, pending().promise, onGone)

  setRootState(rootWith([{key}, {key: 'modal'}]))
  setRootState(rootWith([{key}]))

  expect(onGone).not.toHaveBeenCalled()
})

test('no state is not a removal', () => {
  const onGone = jest.fn()
  setRootState(rootWith([{key}]))
  registerRouteGone(key, pending().promise, onGone)

  setRootState(undefined)
  setRootState(rootWith([{key}]))

  expect(onGone).not.toHaveBeenCalled()
})

test.each([
  ['resolves', (p: ReturnType<typeof pending>) => p.resolve()],
  ['rejects', () => {}],
])('the entry goes when its wait %s', async (kind, settleWait) => {
  const onGone = jest.fn()
  setRootState(rootWith([{key}]))
  const wait = pending()
  const until = kind === 'rejects' ? Promise.reject(new Error('failed')) : wait.promise
  registerRouteGone(key, until, onGone)
  settleWait(wait)
  await settle()

  setRootState(rootWith([]))

  expect(onGone).not.toHaveBeenCalled()
})

test('registering again replaces the entry, keeps what was seen, and the old wait does not drop it', async () => {
  const first = jest.fn()
  const second = jest.fn()
  const firstWait = pending()
  setRootState(rootWith([{key, params: {promptId: 1}}]))
  registerRouteGone(key, firstWait.promise, first)
  registerRouteGone(key, pending().promise, second)
  firstWait.resolve()
  await settle()

  setRootState(rootWith([]))

  expect(first).not.toHaveBeenCalled()
  expect(second).toHaveBeenCalledWith({promptId: 1})
})

test('registering the same entry twice (StrictMode, a re-shown screen) is one entry', () => {
  const onGone = jest.fn()
  const until = pending().promise
  setRootState(rootWith([{key}]))
  registerRouteGone(key, until, onGone)
  registerRouteGone(key, until, onGone)

  setRootState(rootWith([]))

  expect(onGone).toHaveBeenCalledTimes(1)
})
