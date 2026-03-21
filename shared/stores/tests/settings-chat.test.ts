/// <reference types="jest" />
import * as S from '../../constants/strings'
import * as T from '../../constants/types'
import {resetAllStores} from '../../util/zustand'
import {useConfigState} from '../config'
import {useSettingsChatState} from '../settings-chat'

const mockAccountUserGetContactSettingsRpcPromise = jest.fn()
const mockAccountUserSetContactSettingsRpcPromise = jest.fn()
const mockLocalGetUnfurlSettingsRpcPromise = jest.fn()
const mockLocalSaveUnfurlSettingsRpcPromise = jest.fn()

const flush = async () => new Promise<void>(resolve => setImmediate(resolve))

beforeEach(() => {
  useConfigState.setState({loggedIn: true})
})

afterEach(() => {
  mockAccountUserGetContactSettingsRpcPromise.mockReset()
  mockAccountUserSetContactSettingsRpcPromise.mockReset()
  mockLocalGetUnfurlSettingsRpcPromise.mockReset()
  mockLocalSaveUnfurlSettingsRpcPromise.mockReset()
  jest.restoreAllMocks()
  resetAllStores()
})

test('contactSettingsSaved writes the transformed settings and refreshes state', async () => {
  const settings = {display: 'contact-settings'} as any
  mockAccountUserSetContactSettingsRpcPromise.mockResolvedValue({})
  mockAccountUserGetContactSettingsRpcPromise.mockResolvedValue(settings)
  jest.spyOn(T.RPCGen, 'accountUserSetContactSettingsRpcPromise').mockImplementation(
    mockAccountUserSetContactSettingsRpcPromise
  )
  jest.spyOn(T.RPCGen, 'accountUserGetContactSettingsRpcPromise').mockImplementation(
    mockAccountUserGetContactSettingsRpcPromise
  )

  useSettingsChatState.getState().dispatch.contactSettingsSaved(true, true, false, {
    team1: true,
    team2: false,
  })
  await flush()
  await flush()
  await flush()

  expect(mockAccountUserSetContactSettingsRpcPromise).toHaveBeenCalledWith(
    {
      settings: {
        allowFolloweeDegrees: 2,
        allowGoodTeams: false,
        enabled: true,
        teams: [
          {enabled: true, teamID: 'team1'},
          {enabled: false, teamID: 'team2'},
        ],
      },
    },
    S.waitingKeySettingsChatContactSettingsSave
  )
  expect(useSettingsChatState.getState().contactSettings).toEqual({error: '', settings})
})

test('unfurlSettingsSaved updates local state and persists the new settings', async () => {
  mockLocalSaveUnfurlSettingsRpcPromise.mockResolvedValue({})
  mockLocalGetUnfurlSettingsRpcPromise.mockResolvedValue({
    mode: T.RPCChat.UnfurlMode.always,
    whitelist: ['keybase.io'],
  })
  jest.spyOn(T.RPCChat, 'localSaveUnfurlSettingsRpcPromise').mockImplementation(
    mockLocalSaveUnfurlSettingsRpcPromise
  )
  jest.spyOn(T.RPCChat, 'localGetUnfurlSettingsRpcPromise').mockImplementation(
    mockLocalGetUnfurlSettingsRpcPromise
  )

  useSettingsChatState.getState().dispatch.unfurlSettingsSaved(T.RPCChat.UnfurlMode.always, ['keybase.io'])
  await flush()
  await flush()
  await flush()

  expect(useSettingsChatState.getState().unfurl).toEqual({
    unfurlError: undefined,
    unfurlMode: T.RPCChat.UnfurlMode.always,
    unfurlWhitelist: ['keybase.io'],
  })
  expect(mockLocalSaveUnfurlSettingsRpcPromise).toHaveBeenCalledWith(
    {mode: T.RPCChat.UnfurlMode.always, whitelist: ['keybase.io']},
    S.waitingKeySettingsChatUnfurl
  )
})
