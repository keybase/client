/// <reference types="jest" />

import * as Tabs from '@/constants/tabs'
import {
  clearPendingAccountSwitch,
  consumePendingAccountSwitchTab,
  getMostRecentlyUsedAccount,
  peekPendingAccountSwitchTab,
  rememberAccountSwitchTab,
  showLoggedInScreens,
} from './account-switch'

const account = (username: string, hasStoredSecret = true) => ({
  hasStoredSecret,
  uid: `${username}-uid`,
  username,
})

test('selects the first eligible account from the service MRU order', () => {
  const accounts = [account('current'), account('most-recent'), account('older')]

  expect(getMostRecentlyUsedAccount(accounts, 'current')?.username).toBe('most-recent')
})

test('skips the current account and accounts without a stored secret', () => {
  const accounts = [account('current'), account('recent-without-secret', false), account('older')]

  expect(getMostRecentlyUsedAccount(accounts, 'current')?.username).toBe('older')
})

test('returns undefined when no other account can be switched to', () => {
  const accounts = [account('current'), account('other-without-secret', false)]

  expect(getMostRecentlyUsedAccount(accounts, 'current')).toBeUndefined()
})

describe('pending account-switch tab', () => {
  afterEach(() => {
    clearPendingAccountSwitch('')
  })

  test('returns the remembered tab after the username changes and consumes it once', () => {
    rememberAccountSwitchTab('alice', 'bob', Tabs.chatTab)

    expect(consumePendingAccountSwitchTab('bob')).toBe(Tabs.chatTab)
    expect(consumePendingAccountSwitchTab('bob')).toBeUndefined()
  })

  test('peeks the remembered tab for the target account without consuming it', () => {
    rememberAccountSwitchTab('alice', 'bob', Tabs.fsTab)

    expect(peekPendingAccountSwitchTab('alice')).toBeUndefined()
    expect(peekPendingAccountSwitchTab('bob')).toBe(Tabs.fsTab)
    expect(consumePendingAccountSwitchTab('bob')).toBe(Tabs.fsTab)
  })

  test('does not consume the tab before the account changes', () => {
    rememberAccountSwitchTab('alice', 'bob', Tabs.fsTab)

    expect(consumePendingAccountSwitchTab('alice')).toBeUndefined()
    expect(consumePendingAccountSwitchTab('bob')).toBe(Tabs.fsTab)
  })

  test('keeps the pending tab when switching ends on the target account', () => {
    rememberAccountSwitchTab('alice', 'bob', Tabs.teamsTab)

    clearPendingAccountSwitch('bob')

    expect(consumePendingAccountSwitchTab('bob')).toBe(Tabs.teamsTab)
  })

  test('clears the pending tab when switching fails after blanking the username', () => {
    rememberAccountSwitchTab('alice', 'bob', Tabs.teamsTab)

    clearPendingAccountSwitch('')

    expect(consumePendingAccountSwitchTab('bob')).toBeUndefined()
  })

  test('ignores routes that are not application tabs', () => {
    rememberAccountSwitchTab('alice', 'bob', Tabs.loginTab)

    expect(consumePendingAccountSwitchTab('bob')).toBeUndefined()
  })
})

describe('showLoggedInScreens', () => {
  const state = (loggedIn: boolean, userSwitching = false, userSwitchingFromLoggedIn = false) => ({
    loggedIn,
    userSwitching,
    userSwitchingFromLoggedIn,
  })

  test('follows loggedIn when no switch is running', () => {
    expect(showLoggedInScreens(state(true))).toBe(true)
    expect(showLoggedInScreens(state(false))).toBe(false)
  })

  test('holds the logged-in screens through the loggedIn flap of a switch that started logged in', () => {
    expect(showLoggedInScreens(state(false, true, true))).toBe(true)
  })

  test('keeps the logged-out screens for a switch that started logged out', () => {
    expect(showLoggedInScreens(state(false, true, false))).toBe(false)
  })
})
