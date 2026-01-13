import * as T from '@/constants/types'
import {ignorePromise} from '@/constants/utils'
import * as Z from '@/util/zustand'
import {loadAccountsWaitingKey} from '@/constants/strings'
import {useConfigState} from '@/stores/config'

export {loadAccountsWaitingKey} from '@/constants/strings'

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
export const useState = Z.createZustand<State>((set, get) => {
  const dispatch: State['dispatch'] = {
    load: () => {
      const f = async () => {
        if (!useConfigState.getState().loggedIn) {
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
      ignorePromise(f())
    },
    removeAccount: accountID => {
      const f = async () => {
        await T.RPCStellar.localDeleteWalletAccountLocalRpcPromise(
          {accountID, userAcknowledged: 'yes'},
          loadAccountsWaitingKey
        )
        get().dispatch.load()
      }
      ignorePromise(f())
    },
    resetState: 'default',
  }
  return {
    ...initialStore,
    dispatch,
  }
})
