// @flow
import * as I from 'immutable'
import * as Types from './types/wallets'
import * as RPCTypes from './types/rpc-stellar-gen'
import {invert} from 'lodash'

const balanceDeltaToString = invert(RPCTypes.localBalanceDelta)

const makeReserve: I.RecordFactory<Types._Reserve> = I.Record({
  amount: '',
  description: '',
})

const makeState: I.RecordFactory<Types._State> = I.Record({
  assetsMap: I.Map(),
  paymentsMap: I.Map(),
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

const makePayment: I.RecordFactory<Types._Payment> = I.Record({
  amountDescription: '',
  delta: 'none',
  error: '',
  id: '',
  note: '',
  noteErr: '',
  source: '',
  sourceType: '',
  statusDescription: 'none',
  statusDetail: '',
  target: '',
  targetType: '',
  time: '',
  worth: '',
  worthCurrency: '',
})

const paymentResultToPayment = (w: RPCTypes.PaymentOrErrorLocal) => {
  if (!w) {
    return makePayment({error: 'No payments returned'})
  }
  if (!w.payment) {
    return makePayment({error: w.error})
  }
  const {
    amountDescription,
    delta,
    id,
    note,
    noteErr,
    source,
    sourceType,
    statusDescription,
    statusDetail,
    target,
    targetType,
    time,
    worth,
    worthCurrency,
  } = w.payment
  return makePayment({
    amountDescription,
    delta: balanceDeltaToString[delta],
    error: '',
    id,
    note,
    noteErr,
    source,
    sourceType,
    statusDescription,
    statusDetail,
    target,
    targetType,
    time,
    worth,
    worthCurrency,
  })
}

export {
  assetsResultToAssets,
  makeAssets,
  makePayment,
  makeReserve,
  makeState,
  makeWallet,
  paymentResultToPayment,
  walletResultToWallet,
}
