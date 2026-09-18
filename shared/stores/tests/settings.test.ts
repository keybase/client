/// <reference types="jest" />
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

  test('a notification that lands while the settings load is in flight is not overwritten', async () => {
    const stale = [{phoneNumber: '+15550000000', superseded: false, verified: true, visibility: 0}]
    const notified = [{phoneNumber: '+15551111111', superseded: false, verified: true, visibility: 0}]
    const staleEmails = [{email: 'stale@example.com', isPrimary: true, isVerified: true, visibility: 0}]
    const notifiedEmails = [{email: 'fresh@example.com', isPrimary: true, isVerified: true, visibility: 0}]

    useConfigState.setState({loggedIn: true})
    jest.spyOn(T.RPCGen, 'userLoadMySettingsRpcPromise').mockImplementation((async () => {
      // the notifications win the race: they carry the newer server state
      useSettingsPhoneState.getState().dispatch.notifyPhoneNumberPhoneNumbersChanged(notified)
      useSettingsEmailState.getState().dispatch.notifyEmailAddressEmailsChanged(notifiedEmails)
      return {emails: staleEmails, phoneNumbers: stale}
    }) as never)

    loadSettings()
    await Promise.resolve()
    await Promise.resolve()

    expect([...useSettingsPhoneState.getState().phones!.keys()]).toEqual(['+15551111111'])
    expect([...useSettingsEmailState.getState().emails.keys()]).toEqual(['fresh@example.com'])
  })
})
