import * as T from '@/constants/types'

export type Account = Pick<
  T.RPCStellar.WalletAccountLocal,
  'accountID' | 'balanceDescription' | 'deviceReadOnly' | 'isDefault' | 'name'
>

export const toAccount = (account: T.RPCStellar.WalletAccountLocal): Account => ({
  accountID: account.accountID,
  balanceDescription: account.balanceDescription,
  deviceReadOnly: account.deviceReadOnly,
  isDefault: account.isDefault,
  name: account.name,
})

export const sortAccounts = (accounts: ReadonlyArray<Account>): Array<Account> =>
  [...accounts].sort((a, b) => {
    if (a.isDefault) return -1
    if (b.isDefault) return 1
    return a.name < b.name ? -1 : 1
  })

export const makeRemoveAccountRouteParams = (account: Account) => ({
  accountID: account.accountID,
  balanceDescription: account.balanceDescription,
  name: account.name,
})

export const makeReallyRemoveAccountRouteParams = (account: Pick<Account, 'accountID' | 'name'>) => ({
  accountID: account.accountID,
  name: account.name,
})
