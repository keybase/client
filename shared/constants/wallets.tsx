import * as C from '.'
import * as T from './types'
import * as Z from '@/util/zustand'
import invert from 'lodash/invert'

export const statusSimplifiedToString = invert(T.RPCStellar.PaymentStatus) as {
  [K in T.RPCStellar.PaymentStatus]: keyof typeof T.RPCStellar.PaymentStatus
}

export const balanceDeltaToString = invert(T.RPCStellar.BalanceDelta) as {
  [K in T.RPCStellar.BalanceDelta]: keyof typeof T.RPCStellar.BalanceDelta
}

export const makeAssetDescription = (
  a?: Partial<T.Wallets.AssetDescription>
): T.Wallets.AssetDescription => ({
  code: '',
  depositButtonText: '',
  infoUrl: '',
  infoUrlText: '',
  issuerAccountID: T.Wallets.noAccountID,
  issuerName: '',
  issuerVerifiedDomain: '',
  showDepositButton: false,
  showWithdrawButton: false,
  withdrawButtonText: '',
  ...a,
})
export const emptyAssetDescription = makeAssetDescription()

export type Account = {
  accountID: string
  balanceDescription: string
  deviceReadOnly: boolean
  isDefault: boolean
  name: string
}

type Store = T.Immutable<{
  accountMap: Map<string, Account>
}>

const initialStore: Store = {
  accountMap: new Map(),
}

interface State extends Store {
  dispatch: {
    load: () => void
    removeAccount: (accountID: string) => void
    resetState: 'default'
  }
}

export const loadAccountsWaitingKey = 'wallets:loadAccounts'
export const _useState = Z.createZustand<State>((set, get) => {
  const dispatch: State['dispatch'] = {
    load: () => {
      const f = async () => {
        if (!C.useConfigState.getState().loggedIn) {
          return
        }
        const res = await T.RPCStellar.localGetWalletAccountsLocalRpcPromise(undefined, [
          loadAccountsWaitingKey,
        ])
        set(s => {
          s.accountMap = new Map(
            res?.map(a => {
              return [
                a.accountID,
                {
                  accountID: a.accountID,
                  balanceDescription: a.balanceDescription,
                  deviceReadOnly: a.deviceReadOnly,
                  isDefault: a.isDefault,
                  name: a.name,
                },
              ]
            })
          )
        })
      }
      C.ignorePromise(f())
    },
    removeAccount: accountID => {
      const f = async () => {
        await T.RPCStellar.localDeleteWalletAccountLocalRpcPromise(
          {accountID, userAcknowledged: 'yes'},
          loadAccountsWaitingKey
        )
        get().dispatch.load()
      }
      C.ignorePromise(f())
    },
    resetState: 'default',
  }
  return {
    ...initialStore,
    dispatch,
  }
})
