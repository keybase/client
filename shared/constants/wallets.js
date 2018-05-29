// @flow
import * as I from 'immutable'
import * as Types from './types/wallets'
import * as RPCTypes from './types/rpc-stellar-gen'
const makeReserve: I.RecordFactory<Types._Reserve> = I.Record({
  amount: '',
  description: '',
})

const makeState: I.RecordFactory<Types._State> = I.Record({
  walletMap: I.Map(),
})

const makeWallet: I.RecordFactory<Types._Wallet> = I.Record({
  accountID: '',
  balanceDescription: '',
  isDefault: false,
  name: '',
})

const walletResultToWallet = (w: RPCTypes.WalletAccountLocal) => {
  const {accountID, balanceDescription, isDefault, name} = w
  return makeWallet({
    accountID,
    balanceDescription,
    isDefault,
    name,
  })
}
export {makeReserve, makeState, makeWallet, walletResultToWallet}
