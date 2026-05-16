/// <reference types="jest" />
jest.mock('../../constants/router', () => ({
  clearModals: jest.fn(),
  navigateAppend: jest.fn(),
  switchTab: jest.fn(),
}))

import * as T from '../../constants/types'
import {loadSettings} from '../../settings/load-settings'
import {resetAllStores} from '../../util/zustand'
import {useConfigState} from '../config'
import {useSettingsEmailState} from '../settings-email'
import {useSettingsPhoneState} from '../settings-phone'

describe('settings loading', () => {
  afterEach(() => {
    jest.restoreAllMocks()
    resetAllStores()
  })

  test('loadSettings forwards email and phone settings through email and phone stores', async () => {
    const emails = [{email: 'alice@example.com', isPrimary: true, isVerified: true, visibility: 0}]
    const phoneNumbers = [{phoneNumber: '+15555555555', superseded: false, verified: true, visibility: 0}]
    const emailHandler = jest.fn()
    const phoneHandler = jest.fn()

    useConfigState.setState({loggedIn: true})
    useSettingsEmailState.setState(s => ({
      ...s,
      dispatch: {
        ...s.dispatch,
        notifyEmailAddressEmailsChanged: emailHandler,
      },
    }))
    useSettingsPhoneState.setState(s => ({
      ...s,
      dispatch: {
        ...s.dispatch,
        setNumbers: phoneHandler,
      },
      phones: new Map([['existing', {} as never]]),
    }))
    jest.spyOn(T.RPCGen, 'userLoadMySettingsRpcPromise').mockResolvedValue({
      emails,
      phoneNumbers,
    } as never)

    loadSettings()
    await Promise.resolve()

    expect(emailHandler).toHaveBeenCalledWith(emails)
    expect(phoneHandler).toHaveBeenCalledWith(phoneNumbers)
  })
})
