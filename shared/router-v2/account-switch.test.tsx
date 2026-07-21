/// <reference types="jest" />

import * as Tabs from '@/constants/tabs'
import {
  clearPendingAccountSwitch,
  consumePendingAccountSwitchTab,
  getMostRecentlyUsedAccount,
  rememberAccountSwitchTab,
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
