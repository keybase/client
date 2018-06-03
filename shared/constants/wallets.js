// @flow
import * as I from 'immutable'
import * as Types from './types/wallets'
import * as RPCTypes from './types/rpc-stellar-gen'
const makeReserve: I.RecordFactory<Types._Reserve> = I.Record({
  amount: '',
  description: '',
})

const makeState: I.RecordFactory<Types._State> = I.Record({
  assetsMap: I.Map(),
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

const makeAssets: I.RecordFactory<Types._Assets> = I.Record({
  assetCode: '',
  balanceAvailableToSend: '',
  balanceTotal: '',
  issuer: '',
  name: '',
  worth: '',
  worthCurrency: '',
})

const assetsResultToAssets = (w: RPCTypes.AccountAssetLocal) => {
  const {assetCode, balanceAvailableToSend, balanceTotal, issuer, name, worth, worthCurrency} = w
  return makeAssets({
    assetCode,
    balanceAvailableToSend,
    balanceTotal,
    issuer,
    name,
    worth,
    worthCurrency,
  })
}

export {assetsResultToAssets, makeReserve, makeState, makeAssets, makeWallet, walletResultToWallet}
