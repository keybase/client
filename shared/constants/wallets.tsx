import * as ConfigConstants from './config'
import * as RPCStellarTypes from './types/rpc-stellar-gen'
import * as RPCTypes from './types/rpc-stellar-gen'
import * as Types from './types/wallets'
import * as Z from '../util/zustand'
import invert from 'lodash/invert'

export const statusSimplifiedToString = invert(RPCTypes.PaymentStatus) as {
  [K in RPCTypes.PaymentStatus]: keyof typeof RPCTypes.PaymentStatus
}

export const balanceDeltaToString = invert(RPCTypes.BalanceDelta) as {
  [K in RPCTypes.BalanceDelta]: keyof typeof RPCTypes.BalanceDelta
}

export const makeAssetDescription = (a?: Partial<Types.AssetDescription>): Types.AssetDescription => ({
  code: '',
  depositButtonText: '',
  infoUrl: '',
  infoUrlText: '',
  issuerAccountID: Types.noAccountID,
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

type Store = {
  accountMap: Map<string, Account>
}

const initialStore: Store = {
  accountMap: new Map(),
}

type State = Store & {
  dispatch: {
    load: () => void
    removeAccount: (accountID: string) => void
    resetState: 'default'
  }
}

export const loadAccountsWaitingKey = 'wallets:loadAccounts'
export const useState = Z.createZustand<State>((set, get) => {
  const dispatch: State['dispatch'] = {
    load: () => {
      const f = async () => {
        if (!ConfigConstants.useConfigState.getState().loggedIn) {
          return
        }
        const res = await RPCStellarTypes.localGetWalletAccountsLocalRpcPromise(undefined, [
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
      Z.ignorePromise(f())
    },
    removeAccount: accountID => {
      const f = async () => {
        await RPCStellarTypes.localDeleteWalletAccountLocalRpcPromise(
          {accountID, userAcknowledged: 'yes'},
          loadAccountsWaitingKey
        )
        get().dispatch.load()
      }
      Z.ignorePromise(f())
    },
    resetState: 'default',
  }
  return {
    ...initialStore,
    dispatch,
  }
})
