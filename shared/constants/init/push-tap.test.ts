/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {useNavigationIntentsState} from '@/stores/navigation-intents'
import {onEngineConnected, _onEngineIncoming} from './shared'

const g = globalThis as unknown as {isMobile: boolean}

// The intent store remembers a push tap id for the life of the module, so ids must not repeat
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
// retires it only if it is still the same tap. Nothing in constants/init calls the ack any more --
// that happens only once navigation (or account-link-switch) consumes the intent -- so these tests
// exercise it only to prove that absence.
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

// Wedges the store the route is queued into, which is the one thing between the peek and the
// enqueue that can throw.
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

test('the nudge queues the armed route and does not ack it', async () => {
  const route = chatRoute()
  const service = serviceHolding(route)

  nudge()
  await settle()

  expect(service.peek).toHaveBeenCalledTimes(1)
  expect(service.ack).not.toHaveBeenCalled()
  expect(service.isArmed()).toBe(true)
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
  expect(service.ack).not.toHaveBeenCalled()
})

// The point of never clearing on read: a reply that never arrives must cost a repeat, not the tap.
// Nothing else in the app would say the tap had happened.
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
})

// The store, not this layer, is what stops a repeat: nothing here retires the route on read any
// more, so a second peek of the same still-armed id must be turned away by the intent it already
// queued, never by anything drainPushTapRoute tracks itself.
test('a second peek of the same still-armed id does not enqueue a second intent', async () => {
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
  expect(service.ack).not.toHaveBeenCalled()
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

// A throw between the peek and the queue must not crash the notification handler, and since
// nothing here ever acks, the route is still armed for the next peek regardless.
test('an enqueue that throws leaves the route armed for the next peek', async () => {
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
})
