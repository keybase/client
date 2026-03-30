/// <reference types="jest" />
import * as T from '../../constants/types'
import {resetAllStores} from '../../util/zustand'
import {useSettingsNotifState} from '../settings-notifications'

const mockApiserverPostJSONRpcPromise = jest.fn()
const mockLocalSetGlobalAppNotificationSettingsLocalRpcPromise = jest.fn()

const flush = async () => new Promise<void>(resolve => setImmediate(resolve))

afterEach(() => {
  mockApiserverPostJSONRpcPromise.mockReset()
  mockLocalSetGlobalAppNotificationSettingsLocalRpcPromise.mockReset()
  jest.restoreAllMocks()
  resetAllStores()
})

test('toggle updates the in-memory group state and persists the change', async () => {
  mockApiserverPostJSONRpcPromise.mockResolvedValue({body: JSON.stringify({status: {code: 0}})})
  mockLocalSetGlobalAppNotificationSettingsLocalRpcPromise.mockResolvedValue({})
  jest.spyOn(T.RPCGen, 'apiserverPostJSONRpcPromise').mockImplementation(mockApiserverPostJSONRpcPromise)
  jest.spyOn(T.RPCChat, 'localSetGlobalAppNotificationSettingsLocalRpcPromise').mockImplementation(
    mockLocalSetGlobalAppNotificationSettingsLocalRpcPromise
  )

  useSettingsNotifState.setState(state => ({
    ...state,
    allowEdit: true,
    groups: new Map([
      [
        'email',
        {
          settings: [],
          unsub: false,
        },
      ],
      [
        'security',
        {
          settings: [
            {description: 'phone', name: 'plaintextmobile', subscribed: true},
            {description: 'desktop', name: 'plaintextdesktop', subscribed: true},
            {description: 'typing', name: 'disabletyping', subscribed: false},
          ],
          unsub: false,
        },
      ],
    ]),
  }))

  useSettingsNotifState.getState().dispatch.toggle('security', 'plaintextmobile')
  expect(useSettingsNotifState.getState().allowEdit).toBe(false)
  const security = useSettingsNotifState.getState().groups.get('security')
  expect(security?.settings[0]?.subscribed).toBe(false)

  await flush()
  await flush()
  await flush()

  expect(mockApiserverPostJSONRpcPromise).toHaveBeenCalled()
  expect(mockLocalSetGlobalAppNotificationSettingsLocalRpcPromise).toHaveBeenCalled()
  expect(useSettingsNotifState.getState().allowEdit).toBe(true)
})

test('toggle works when notification groups are loaded without an email group', async () => {
  mockApiserverPostJSONRpcPromise.mockResolvedValue({body: JSON.stringify({status: {code: 0}})})
  mockLocalSetGlobalAppNotificationSettingsLocalRpcPromise.mockResolvedValue({})
  jest.spyOn(T.RPCGen, 'apiserverPostJSONRpcPromise').mockImplementation(mockApiserverPostJSONRpcPromise)
  jest.spyOn(T.RPCChat, 'localSetGlobalAppNotificationSettingsLocalRpcPromise').mockImplementation(
    mockLocalSetGlobalAppNotificationSettingsLocalRpcPromise
  )

  useSettingsNotifState.setState(state => ({
    ...state,
    allowEdit: true,
    groups: new Map([
      [
        'app_push',
        {
          settings: [{description: 'push', name: 'newmessages', subscribed: true}],
          unsub: false,
        },
      ],
      [
        'security',
        {
          settings: [{description: 'phone', name: 'plaintextmobile', subscribed: true}],
          unsub: false,
        },
      ],
    ]),
  }))

  useSettingsNotifState.getState().dispatch.toggle('security', 'plaintextmobile')
  expect(useSettingsNotifState.getState().allowEdit).toBe(false)
  expect(useSettingsNotifState.getState().groups.get('security')?.settings[0]?.subscribed).toBe(false)

  await flush()
  await flush()
  await flush()

  expect(mockApiserverPostJSONRpcPromise).toHaveBeenCalled()
  expect(mockLocalSetGlobalAppNotificationSettingsLocalRpcPromise).toHaveBeenCalled()
  expect(useSettingsNotifState.getState().allowEdit).toBe(true)
})
