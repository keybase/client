/// <reference types="jest" />
import * as T from '@/constants/types'
import {
  makeReallyRemoveAccountRouteParams,
  makeRemoveAccountRouteParams,
  sortAccounts,
  toAccount,
  type Account,
} from './account-utils'

const makeRPCAccount = (
  overrides?: Partial<T.RPCStellar.WalletAccountLocal>
): T.RPCStellar.WalletAccountLocal => ({
  accountID: 'acct-1' as T.RPCStellar.AccountID,
  accountMode: T.RPCStellar.AccountMode.user,
  accountModeEditable: true,
  balanceDescription: '1.00 XLM',
  canAddTrustline: false,
  canSubmitTx: true,
  currencyLocal: {
    code: 'USD',
    description: 'United States Dollar',
    name: 'USD',
    symbol: '$',
  },
  deviceReadOnly: false,
  isDefault: true,
  isFunded: true,
  name: 'Primary',
  seqno: '1',
  ...overrides,
})

const makeAccount = (overrides?: Partial<Account>): Account => ({
  accountID: 'acct-1' as T.RPCStellar.AccountID,
  balanceDescription: '1.00 XLM',
  deviceReadOnly: false,
  isDefault: false,
  name: 'Primary',
  ...overrides,
})

test('toAccount keeps only the wallet fields used by the UI', () => {
  expect(
    toAccount(
      makeRPCAccount({
        accountID: 'acct-2' as T.RPCStellar.AccountID,
        balanceDescription: '7.25 XLM',
        deviceReadOnly: true,
        isDefault: false,
        name: 'Savings',
      })
    )
  ).toEqual({
    accountID: 'acct-2',
    balanceDescription: '7.25 XLM',
    deviceReadOnly: true,
    isDefault: false,
    name: 'Savings',
  })
})

test('sortAccounts keeps the default account first, then sorts remaining accounts by name', () => {
  expect(
    sortAccounts([
      makeAccount({accountID: 'acct-2' as T.RPCStellar.AccountID, name: 'Zulu'}),
      makeAccount({accountID: 'acct-3' as T.RPCStellar.AccountID, isDefault: true, name: 'Middle'}),
      makeAccount({accountID: 'acct-1' as T.RPCStellar.AccountID, name: 'Alpha'}),
    ]).map(a => a.accountID)
  ).toEqual(['acct-3', 'acct-1', 'acct-2'])
})

test('remove-account route params carry the account fields the confirmation modal needs', () => {
  expect(
    makeRemoveAccountRouteParams(
      makeAccount({
        accountID: 'acct-9' as T.RPCStellar.AccountID,
        balanceDescription: '9.99 XLM',
        name: 'Vacation',
      })
    )
  ).toEqual({
    accountID: 'acct-9',
    balanceDescription: '9.99 XLM',
    name: 'Vacation',
  })
})

test('really-remove-account route params only carry the fields used on the final screen', () => {
  expect(
    makeReallyRemoveAccountRouteParams({
      accountID: 'acct-5' as T.RPCStellar.AccountID,
      name: 'Emergency',
    })
  ).toEqual({
    accountID: 'acct-5',
    name: 'Emergency',
  })
})
