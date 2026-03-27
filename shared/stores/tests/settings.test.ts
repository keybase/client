/// <reference types="jest" />
jest.mock('../../constants/router', () => ({
  clearModals: jest.fn(),
  navigateAppend: jest.fn(),
  switchTab: jest.fn(),
}))

import {resetAllStores} from '../../util/zustand'
import {useConfigState} from '../config'
import {useSettingsState} from '../settings'

describe('settings store', () => {
  afterEach(() => {
    jest.restoreAllMocks()
    resetAllStores()
  })

  test('loadSettings forwards email and phone settings through deferred handlers', async () => {
    const emails = [{email: 'alice@example.com', isPrimary: true, isVerified: true, visibility: 0}]
    const phoneNumbers = [{phoneNumber: '+15555555555', superseded: false, verified: true, visibility: 0}]
    const emailHandler = jest.fn()
    const phoneHandler = jest.fn()

    useConfigState.setState({loggedIn: true})
    useSettingsState.setState(s => ({
      ...s,
      dispatch: {
        ...s.dispatch,
        defer: {
          ...s.dispatch.defer,
          getSettingsPhonePhones: () => new Map([['existing', {} as never]]),
          onSettingsEmailNotifyEmailsChanged: emailHandler,
          onSettingsPhoneSetNumbers: phoneHandler,
        },
      },
    }))
    jest.spyOn(T.RPCGen, 'userLoadMySettingsRpcPromise').mockResolvedValue({
      emails,
      phoneNumbers,
    } as never)

    useSettingsState.getState().dispatch.loadSettings()
    await Promise.resolve()

    expect(emailHandler).toHaveBeenCalledWith(emails)
    expect(phoneHandler).toHaveBeenCalledWith(phoneNumbers)
  })
})
