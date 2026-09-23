/// <reference types="jest" />
import * as T from '../../constants/types'
import {loadSettings} from '../../settings/load-settings'
import {resetAllStores} from '../../util/zustand'
import {useConfigState} from '../config'
import {useCurrentUserState} from '../current-user'
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
    const stale = [{ctime: 0, phoneNumber: '+15550000000', superseded: false, verified: true, visibility: 0}]
    const notified = [{ctime: 0, phoneNumber: '+15551111111', superseded: false, verified: true, visibility: 0}]
    const staleEmails = [
      {email: 'stale@example.com', isPrimary: true, isVerified: true, lastVerifyEmailDate: 0, visibility: 0},
    ]
    const notifiedEmails = [
      {email: 'fresh@example.com', isPrimary: true, isVerified: true, lastVerifyEmailDate: 0, visibility: 0},
    ]

    useConfigState.setState({loggedIn: true})
    jest.spyOn(T.RPCGen, 'userLoadMySettingsRpcPromise').mockImplementation((async () => {
      // the notifications win the race: they carry the newer server state
      await Promise.resolve()
      useSettingsPhoneState.getState().dispatch.notifyPhoneNumberPhoneNumbersChanged(notified)
      useSettingsEmailState.getState().dispatch.notifyEmailAddressEmailsChanged(notifiedEmails)
      return {emails: staleEmails, phoneNumbers: stale}
    }) as never)

    loadSettings()
    for (let i = 0; i < 10; ++i) await Promise.resolve()

    expect([...useSettingsPhoneState.getState().phones!.keys()]).toEqual(['+15551111111'])
    expect([...useSettingsEmailState.getState().emails.keys()]).toEqual(['fresh@example.com'])
  })

  test('a logout while the settings load is in flight drops the reply', async () => {
    const emails = [
      {email: 'a@example.com', isPrimary: true, isVerified: true, lastVerifyEmailDate: 0, visibility: 0},
    ]
    const phoneNumbers = [
      {ctime: 0, phoneNumber: '+15555555555', superseded: false, verified: true, visibility: 0},
    ]

    useConfigState.setState({loggedIn: true})
    jest.spyOn(T.RPCGen, 'userLoadMySettingsRpcPromise').mockImplementation((async () => {
      // Z.defaultReset restores the identities captured at store creation, so the reference
      // checks cannot see this; only the loggedIn re-read can.
      await Promise.resolve()
      useConfigState.getState().dispatch.setLoggedIn(false)
      return {emails, phoneNumbers}
    }) as never)

    loadSettings()
    for (let i = 0; i < 10; ++i) await Promise.resolve()

    expect(useSettingsPhoneState.getState().phones).toBeUndefined()
    expect([...useSettingsEmailState.getState().emails.keys()]).toEqual([])
  })

  test('an account switch while the settings load is in flight drops the reply', async () => {
    const emails = [
      {email: 'a@example.com', isPrimary: true, isVerified: true, lastVerifyEmailDate: 0, visibility: 0},
    ]
    const phoneNumbers = [
      {ctime: 0, phoneNumber: '+15555555555', superseded: false, verified: true, visibility: 0},
    ]

    const bootstrap = (uid: string) =>
      useCurrentUserState.getState().dispatch.setBootstrap({
        deviceID: '',
        deviceName: '',
        uid,
        username: uid,
      })

    useConfigState.setState({loggedIn: true})
    bootstrap('uid-a')
    jest.spyOn(T.RPCGen, 'userLoadMySettingsRpcPromise').mockImplementation((async () => {
      // The switch, as the app performs it: the stores go back to their creation-time values
      // and the next account logs in. Neither the reference checks nor the loggedIn re-read
      // can tell that apart from a quiet load, so only the uid stops account A's reply from
      // landing in account B's stores.
      await Promise.resolve()
      useSettingsEmailState.getState().dispatch.resetState()
      useSettingsPhoneState.getState().dispatch.resetState()
      bootstrap('uid-b')
      useConfigState.getState().dispatch.setLoggedIn(true)
      return {emails, phoneNumbers}
    }) as never)

    loadSettings()
    for (let i = 0; i < 10; ++i) await Promise.resolve()

    expect(useSettingsPhoneState.getState().phones).toBeUndefined()
    expect([...useSettingsEmailState.getState().emails.keys()]).toEqual([])
  })
})
