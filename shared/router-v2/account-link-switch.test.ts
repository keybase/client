/// <reference types="jest" />
import * as T from '@/constants/types'
import RPCError from '@/util/rpcerror'
import {resetAllStores} from '@/util/zustand'
import {subscribeIntentAccountSwitch} from './account-link-switch'
import {enqueuePushTapRoute, emitDeepLink} from './deep-link-emitter'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {useDaemonState} from '@/stores/daemon'
import {useNavigationIntentsState} from '@/stores/navigation-intents'

const currentAccount = {hasStoredSecret: true, uid: 'uid-current', username: 'testuser'}
const otherAccount = {hasStoredSecret: true, uid: 'uid-other', username: 'testuser-mac'}
const noSecretAccount = {hasStoredSecret: false, uid: 'uid-nosecret', username: 'testuser-nosecret'}
const allAccounts = [currentAccount, otherAccount, noSecretAccount]

// A push tap's id must not repeat across tests any more than it does across taps, so every call
// here gets a fresh one; the ack RPC is mocked below so a leftover, still-pending intent from a
// previous test can be acknowledged in cleanup without an unmocked RPC call.
let nextTapID = 9000
const tapFor = (uid: string) =>
  enqueuePushTapRoute({id: ++nextTapID, targetUID: uid, url: 'keybase://convid/0000ab'})

let login = jest.fn()
let unsub: (() => void) | undefined

const setAccounts = (configuredAccounts: typeof allAccounts) => {
  useConfigState.setState({configuredAccounts})
}

beforeEach(() => {
  jest.spyOn(T.RPCGen, 'appStateAckPushTapRouteRpcPromise').mockResolvedValue(undefined)
  login = jest.fn()
  // navigation-intents' resetState deliberately keeps account-targeted intents.
  const {intent, dispatch} = useNavigationIntentsState.getState()
  if (intent) dispatch.acknowledge(intent.id)
  useNavigationIntentsState.setState({lastHandledIntent: undefined})
  useDaemonState.setState({handshakeState: 'done'})
  useCurrentUserState.setState({uid: currentAccount.uid, username: currentAccount.username})
  // config's resetState deliberately keeps userSwitching, so clear it here.
  useConfigState.setState({
    configuredAccounts: allAccounts,
    dispatch: {...useConfigState.getState().dispatch, login},
    loggedIn: true,
    loginError: undefined,
    userSwitching: false,
  })
  unsub = subscribeIntentAccountSwitch()
})

afterEach(() => {
  jest.restoreAllMocks()
  unsub?.()
  unsub = undefined
  resetAllStores()
})

test('a tap for the current account does not switch', () => {
  tapFor(currentAccount.uid)

  expect(login).not.toHaveBeenCalled()
  expect(useNavigationIntentsState.getState().intent?.targetUid).toBe(currentAccount.uid)
})

test('a tap for a stored account switches to it once', () => {
  tapFor(otherAccount.uid)

  expect(login).toHaveBeenCalledTimes(1)
  expect(login).toHaveBeenCalledWith(otherAccount.username, '')
  expect(useConfigState.getState().userSwitching).toBe(true)

  setAccounts([...allAccounts])

  expect(login).toHaveBeenCalledTimes(1)
})

test('a tap for an account not listed yet waits for the account list', () => {
  setAccounts([currentAccount])
  tapFor(otherAccount.uid)

  expect(login).not.toHaveBeenCalled()

  setAccounts(allAccounts)

  expect(login).toHaveBeenCalledTimes(1)
})

test('a tap for an account without a stored secret is dropped', () => {
  tapFor(noSecretAccount.uid)

  expect(login).not.toHaveBeenCalled()
  expect(useNavigationIntentsState.getState().intent).toBeUndefined()
})

// Dropped here means no navigation is ever coming for it, so this is where the tap's route must
// be acked -- there is no other consumption point left to do it.
test('a tap dropped for a missing stored secret acks its route', () => {
  const ack = T.RPCGen.appStateAckPushTapRouteRpcPromise as jest.Mock
  const id = ++nextTapID

  enqueuePushTapRoute({id, targetUID: noSecretAccount.uid, url: 'keybase://convid/0000ab'})

  expect(ack).toHaveBeenCalledWith({id})
})

test('nothing switches before the handshake is done', () => {
  useDaemonState.setState({handshakeState: 'loading'})
  tapFor(otherAccount.uid)

  expect(login).not.toHaveBeenCalled()

  useDaemonState.setState({handshakeState: 'done'})

  expect(login).toHaveBeenCalledTimes(1)
})

test('a login error drops the tap', () => {
  tapFor(otherAccount.uid)
  expect(login).toHaveBeenCalledTimes(1)

  useConfigState.setState({loginError: new RPCError('bad', 1), userSwitching: false})

  expect(useNavigationIntentsState.getState().intent).toBeUndefined()
})

test('a login error dropping the tap acks its route', () => {
  const ack = T.RPCGen.appStateAckPushTapRouteRpcPromise as jest.Mock
  const id = ++nextTapID
  enqueuePushTapRoute({id, targetUID: otherAccount.uid, url: 'keybase://convid/0000ab'})
  expect(ack).not.toHaveBeenCalled()

  useConfigState.setState({loginError: new RPCError('bad', 1), userSwitching: false})

  expect(ack).toHaveBeenCalledWith({id})
})

test('logging out drops a tap for another account', () => {
  useConfigState.setState({configuredAccounts: [], loggedIn: true})
  tapFor(otherAccount.uid)

  useConfigState.setState({loggedIn: false, userSwitching: false})

  expect(useNavigationIntentsState.getState().intent).toBeUndefined()
})

test('a foreign link naming a stored account never switches', () => {
  emitDeepLink(`keybase://profile/show/${otherAccount.username}`)

  expect(login).not.toHaveBeenCalled()
  expect(useConfigState.getState().userSwitching).toBe(false)
})

test('a switch already under way is not restarted when userSwitching clears early', () => {
  tapFor(otherAccount.uid)
  expect(login).toHaveBeenCalledTimes(1)

  // the replacement router's onReady clears userSwitching before the new uid lands
  useConfigState.setState({userSwitching: false})

  expect(login).toHaveBeenCalledTimes(1)
})
