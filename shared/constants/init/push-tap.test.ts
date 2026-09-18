/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {useNavigationIntentsState} from '@/stores/navigation-intents'
import {onEngineConnected, _onEngineIncoming} from './shared'

const g = globalThis as unknown as {isMobile: boolean}

const chatRoute: T.RPCGen.PushTapRoute = {targetUID: 'uid-other', url: 'keybase://convid/0000ab'}

const nudge = () =>
  _onEngineIncoming({
    payload: {params: undefined},
    type: 'keybase.1.NotifyApp.pushTapRouteAvailable',
  } as never)

const spyOnTake = (...routes: Array<T.RPCGen.PushTapRoute | null>) => {
  const spy = jest.spyOn(T.RPCGen, 'appStateTakePushTapRouteRpcPromise')
  for (const route of routes) {
    spy.mockResolvedValueOnce(route)
  }
  return spy.mockResolvedValue(null)
}

const settle = async () => new Promise(resolve => setImmediate(resolve))

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

test('the nudge takes the route and queues it as a tap', async () => {
  const take = spyOnTake(chatRoute)

  nudge()
  await settle()

  expect(take).toHaveBeenCalledTimes(1)
  expect(useNavigationIntentsState.getState().intent).toMatchObject({
    targetUid: 'uid-other',
    url: 'keybase://convid/0000ab',
  })
})

test('a tap waiting from before this connection is taken on connect', async () => {
  stubConnect()
  const take = spyOnTake(chatRoute)

  onEngineConnected()
  await settle()

  expect(take).toHaveBeenCalledTimes(1)
  expect(useNavigationIntentsState.getState().intent?.url).toBe('keybase://convid/0000ab')
})

// The nudge carries nothing on purpose: acting on it rather than on what the take returns would
// be a second delivery path, and the pair could then hand out one tap twice.
test('a second nudge for a tap already taken queues nothing more', async () => {
  const take = spyOnTake(chatRoute, null)

  nudge()
  await settle()
  const first = useNavigationIntentsState.getState().intent
  nudge()
  await settle()

  expect(take).toHaveBeenCalledTimes(2)
  expect(useNavigationIntentsState.getState().intent).toBe(first)
})

test('no waiting tap queues nothing', async () => {
  spyOnTake(null)

  nudge()
  await settle()

  expect(useNavigationIntentsState.getState().intent).toBeUndefined()
})

test('a route with no account is not a targeted intent', async () => {
  spyOnTake({targetUID: '', url: 'keybase://tabs.peopleTab'})

  nudge()
  await settle()

  const {intent} = useNavigationIntentsState.getState()
  expect(intent?.url).toBe('keybase://tabs.peopleTab')
  expect(intent?.targetUid).toBeUndefined()
})

test('a failed take queues nothing and does not throw', async () => {
  jest
    .spyOn(T.RPCGen, 'appStateTakePushTapRouteRpcPromise')
    .mockRejectedValue(new Error('disconnected'))

  nudge()
  await settle()

  expect(useNavigationIntentsState.getState().intent).toBeUndefined()
})

test('desktop never asks for a tap', async () => {
  g.isMobile = false
  const take = spyOnTake(chatRoute)

  nudge()
  await settle()

  expect(take).not.toHaveBeenCalled()
  expect(useNavigationIntentsState.getState().intent).toBeUndefined()
})
