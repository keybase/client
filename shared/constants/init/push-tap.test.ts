/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {useNavigationIntentsState} from '@/stores/navigation-intents'
import {onEngineConnected, _onEngineIncoming} from './shared'

const g = globalThis as unknown as {isMobile: boolean}

// shared.tsx remembers the last id it queued for the life of the module, so ids must not repeat
// across tests any more than they do across taps.
let nextRouteID = 100
const chatRoute = (): T.RPCGen.PushTapRoute => ({
  id: ++nextRouteID,
  targetUID: 'uid-other',
  url: 'keybase://convid/0000ab',
})

const nudge = () =>
  _onEngineIncoming({
    payload: {params: undefined},
    type: 'keybase.1.NotifyApp.pushTapRouteAvailable',
  } as never)

// The service's holder, as far as these tests are concerned: a peek reports what is armed, an ack
// retires it only if it is still the same tap.
const serviceHolding = (route?: T.RPCGen.PushTapRoute) => {
  let armed = route
  // Both answer a microtask late, as a real RPC would: nothing here should depend on a reply
  // landing in the same tick as the call.
  const peek = jest
    .spyOn(T.RPCGen, 'appStatePeekPushTapRouteRpcPromise')
    .mockImplementation(async () => {
      await Promise.resolve()
      return armed ?? null
    })
  const ack = jest
    .spyOn(T.RPCGen, 'appStateAckPushTapRouteRpcPromise')
    .mockImplementation(async (params?: {id: number}) => {
      await Promise.resolve()
      if (armed && params?.id === armed.id) {
        armed = undefined
      }
    })
  return {ack, arm: (next: T.RPCGen.PushTapRoute) => (armed = next), isArmed: () => !!armed, peek}
}

const settle = async () => new Promise(resolve => setImmediate(resolve))

// Wedges the store the route is queued into, which is the one thing between the peek and the ack
// that can throw.
const withEnqueueThrowing = () => {
  const original = useNavigationIntentsState.getState().dispatch
  useNavigationIntentsState.setState(state => {
    state.dispatch = {
      ...original,
      enqueue: () => {
        throw new Error('the store is wedged')
      },
    }
  })
  return () =>
    useNavigationIntentsState.setState(state => {
      state.dispatch = original
    })
}

const originalConfigDispatch = useConfigState.getState().dispatch

// onEngineConnected's other work is not what is under test here; this is the same stubbing
// shared.test.ts does for it.
const stubConnect = () => {
  for (const rpc of [
    'delegateUiCtlRegisterChatUIRpcPromise',
    'delegateUiCtlRegisterLogUIRpcPromise',
    'delegateUiCtlRegisterHomeUIRpcPromise',
    'delegateUiCtlRegisterSecretUIRpcPromise',
    'delegateUiCtlRegisterIdentify3UIRpcPromise',
    'delegateUiCtlRegisterRekeyUIRpcPromise',
  ] as const) {
    jest.spyOn(T.RPCGen, rpc).mockResolvedValue(undefined)
  }
  useConfigState.setState(s => {
    s.dispatch = {...originalConfigDispatch, onEngineConnected: () => {}}
  })
  jest.spyOn(T.RPCGen, 'notifyCtlSetNotificationsRpcPromise').mockRejectedValue(new Error('not under test'))
  jest.spyOn(T.RPCGen, 'configGetBootstrapStatusRpcPromise').mockResolvedValue({
    loggedIn: true,
  } as T.RPCGen.BootstrapStatus)
}

beforeEach(() => {
  g.isMobile = true
  resetAllStores()
})

afterEach(() => {
  g.isMobile = false
  jest.restoreAllMocks()
  useConfigState.setState({dispatch: originalConfigDispatch})
  const {intent, dispatch} = useNavigationIntentsState.getState()
  if (intent) dispatch.acknowledge(intent.id)
  resetAllStores()
})

test('the nudge queues the armed route and acks it', async () => {
  const route = chatRoute()
  const service = serviceHolding(route)

  nudge()
  await settle()

  expect(service.peek).toHaveBeenCalledTimes(1)
  expect(service.ack).toHaveBeenCalledWith({id: route.id})
  expect(service.isArmed()).toBe(false)
  expect(useNavigationIntentsState.getState().intent).toMatchObject({
    targetUid: 'uid-other',
    url: 'keybase://convid/0000ab',
  })
})

test('a tap waiting from before this connection is taken on connect', async () => {
  stubConnect()
  const route = chatRoute()
  const service = serviceHolding(route)

  onEngineConnected()
  await settle()

  expect(service.peek).toHaveBeenCalledTimes(1)
  expect(useNavigationIntentsState.getState().intent?.url).toBe('keybase://convid/0000ab')
  expect(service.isArmed()).toBe(false)
})

// The point of splitting peek from ack: a reply that never arrives must cost a repeat, not the
// tap. Nothing else in the app would say the tap had happened.
test('a peek whose reply is lost leaves the route armed for the next one', async () => {
  const route = chatRoute()
  const service = serviceHolding(route)
  service.peek.mockRejectedValueOnce(new Error('disconnected'))

  nudge()
  await settle()
  expect(useNavigationIntentsState.getState().intent).toBeUndefined()
  expect(service.isArmed()).toBe(true)

  // the next connection picks it up
  nudge()
  await settle()

  expect(useNavigationIntentsState.getState().intent?.url).toBe('keybase://convid/0000ab')
  expect(service.isArmed()).toBe(false)
})

// Leaving the route armed is what saves a lost peek, but it means a lost ack shows the same tap
// again. The intent store absorbs that only while the intent is still queued or inside its 1.5s
// duplicate window; once the router has navigated and that window has passed, re-queueing would
// navigate a second time. So the id is remembered here too, and only the ack is retried.
test('a lost ack retries the ack without navigating again', async () => {
  const route = chatRoute()
  const service = serviceHolding(route)
  service.ack.mockRejectedValueOnce(new Error('disconnected'))

  nudge()
  await settle()
  const first = useNavigationIntentsState.getState().intent
  expect(first?.url).toBe('keybase://convid/0000ab')
  expect(service.isArmed()).toBe(true)

  // the router consumes it and navigates, and time moves past the store's duplicate window
  useNavigationIntentsState.getState().dispatch.acknowledge(first!.id)
  const realNow = Date.now()
  jest.spyOn(Date, 'now').mockReturnValue(realNow + 60_000)

  // the route is still armed, so the next peek sees it again
  nudge()
  await settle()

  expect(useNavigationIntentsState.getState().intent).toBeUndefined()
  expect(service.ack).toHaveBeenCalledTimes(2)
  expect(service.isArmed()).toBe(false)
})

// The id must be recorded only once the queue has taken the route. Recording it first would leave
// a throw here with the route armed AND marked as queued, so the next peek would skip the queue
// and ack anyway -- retiring a tap that never reached the router, which is the silent loss this
// whole split exists to prevent.
test('an enqueue that throws does not let the next peek retire the route', async () => {
  const route = chatRoute()
  const service = serviceHolding(route)
  const restore = withEnqueueThrowing()

  nudge()
  await settle()

  expect(service.ack).not.toHaveBeenCalled()
  expect(service.isArmed()).toBe(true)
  expect(useNavigationIntentsState.getState().intent).toBeUndefined()

  restore()
  nudge()
  await settle()

  expect(useNavigationIntentsState.getState().intent?.url).toBe('keybase://convid/0000ab')
  expect(service.ack).toHaveBeenCalledWith({id: route.id})
  expect(service.isArmed()).toBe(false)
})

// The nudge carries nothing on purpose: acting on it rather than on what the peek reports would
// be a second delivery path, and the pair could then act on one tap twice.
test('a second nudge after the ack queues nothing more', async () => {
  const service = serviceHolding(chatRoute())

  nudge()
  await settle()
  const first = useNavigationIntentsState.getState().intent
  nudge()
  await settle()

  expect(service.peek).toHaveBeenCalledTimes(2)
  expect(useNavigationIntentsState.getState().intent).toBe(first)
})

test('a newer tap queued while the older one is still pending upgrades nothing away', async () => {
  const service = serviceHolding(chatRoute())

  nudge()
  await settle()
  const devices = {id: ++nextRouteID, targetUID: 'uid-other', url: 'keybase://devices'}
  service.arm(devices)
  nudge()
  await settle()

  expect(useNavigationIntentsState.getState().intent?.url).toBe('keybase://devices')
  expect(service.ack).toHaveBeenCalledWith({id: devices.id})
  expect(service.isArmed()).toBe(false)
})

test('no waiting tap queues nothing', async () => {
  const service = serviceHolding()

  nudge()
  await settle()

  expect(useNavigationIntentsState.getState().intent).toBeUndefined()
  expect(service.ack).not.toHaveBeenCalled()
})

test('a route with no account is not a targeted intent', async () => {
  serviceHolding({id: ++nextRouteID, targetUID: '', url: 'keybase://tabs.peopleTab'})

  nudge()
  await settle()

  const {intent} = useNavigationIntentsState.getState()
  expect(intent?.url).toBe('keybase://tabs.peopleTab')
  expect(intent?.targetUid).toBeUndefined()
})

test('desktop never asks for a tap', async () => {
  g.isMobile = false
  const service = serviceHolding(chatRoute())

  nudge()
  await settle()

  expect(service.peek).not.toHaveBeenCalled()
  expect(useNavigationIntentsState.getState().intent).toBeUndefined()
})
