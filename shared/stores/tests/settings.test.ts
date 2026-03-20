jest.mock('../../constants/router', () => ({
  clearModals: jest.fn(),
  navigateAppend: jest.fn(),
  switchTab: jest.fn(),
}))

import * as T from '../../constants/types'
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

  test('setProxyData persists and updates local state on success', async () => {
    const proxyData: T.RPCGen.ProxyData = {
      addressWithPort: '127.0.0.1:8080',
      certPinning: false,
      proxyType: T.RPCGen.ProxyType.httpConnect,
    }
    jest.spyOn(T.RPCGen, 'configSetProxyDataRpcPromise').mockResolvedValue(undefined)

    useSettingsState.getState().dispatch.setProxyData(proxyData)
    await Promise.resolve()

    expect(useSettingsState.getState().proxyData).toBe(proxyData)
  })

  test('setDidToggleCertificatePinning and resetState restore initial state', () => {
    useSettingsState.getState().dispatch.setDidToggleCertificatePinning(true)
    expect(useSettingsState.getState().didToggleCertificatePinning).toBe(true)

    resetAllStores()

    expect(useSettingsState.getState().didToggleCertificatePinning).toBeUndefined()
    expect(useSettingsState.getState().checkPasswordIsCorrect).toBeUndefined()
  })
})
