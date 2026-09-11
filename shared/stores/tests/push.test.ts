/// <reference types="jest" />
import './as-mobile'
import * as T from '@/constants/types'
import {resetAllStores} from '../../util/zustand'
import {useConfigState} from '../config'
import {usePushState} from '../push'

const flush = async () => new Promise<void>(resolve => setImmediate(resolve))

const tapFor = (forUid: string) =>
  ({conversationIDKey: 'conv', forUid, type: 'chat.newmessage', userInteraction: true}) as any

afterEach(() => {
  jest.restoreAllMocks()
  // config's resetState carries userSwitching across resets, so clear it explicitly
  useConfigState.getState().dispatch.setUserSwitching(false)
  resetAllStores()
})

test("a switch started by a notification tap that ends with the tap still pending drops it", async () => {
  // the switch's login never answers; the test ends the switch itself
  jest.spyOn(T.RPCGen, 'loginLoginRpcListener').mockReturnValue(new Promise(() => {}))
  const config = useConfigState.getState().dispatch
  config.setAccounts([{hasStoredSecret: true, uid: 'testuser-uid', username: 'testuser'}])

  usePushState.getState().dispatch.handlePush(tapFor('testuser-uid'))
  await flush()
  expect(useConfigState.getState().userSwitching).toBe(true)
  expect(usePushState.getState().pendingPushNotification).toEqual(tapFor('testuser-uid'))

  config.setUserSwitching(false)

  expect(usePushState.getState().pendingPushNotification).toBeUndefined()
})

test('a notification parked for an account that is not configured yet survives an unrelated switch', () => {
  const config = useConfigState.getState().dispatch
  config.setUserSwitching(true)
  usePushState.getState().dispatch.setPendingPushNotification(tapFor('testuser-mac-uid'))

  config.setUserSwitching(false)

  expect(usePushState.getState().pendingPushNotification).toEqual(tapFor('testuser-mac-uid'))
})

test('a pending notification survives the store reset in the middle of a switch', () => {
  const config = useConfigState.getState().dispatch
  config.setLoggedIn(true)
  config.setUserSwitching(true)
  usePushState.getState().dispatch.setPendingPushNotification(tapFor('testuser-uid'))

  // the service's loggedOut notification during a switch resets every store
  config.setLoggedIn(false)

  expect(usePushState.getState().pendingPushNotification).toEqual(tapFor('testuser-uid'))
})
