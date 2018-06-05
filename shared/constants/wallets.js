// @flow
import * as I from 'immutable'
import * as Types from './types/wallets'
import * as RPCTypes from './types/rpc-stellar-gen'
import {invert} from 'lodash'

const balanceDeltaToString = invert(RPCTypes.localBalanceDelta)
const statusSimplifiedToString = invert(RPCTypes.localPaymentStatus)

const makeReserve: I.RecordFactory<Types._Reserve> = I.Record({
  amount: '',
  description: '',
})

const makeState: I.RecordFactory<Types._State> = I.Record({
  assetsMap: I.Map(),
  paymentsMap: I.Map(),
  accountMap: I.Map(),
})

const makeAccount: I.RecordFactory<Types._Account> = I.Record({
  accountID: '',
  balanceDescription: '',
  isDefault: false,
  name: '',
})

const accountResultToAccount = (w: RPCTypes.WalletAccountLocal) => {
  const {accountID, balanceDescription, isDefault, name} = w
  return makeAccount({
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
  statusDescription: '',
  statusDetail: '',
  statusSimplified: 'none',
  target: '',
  targetType: '',
  time: 0,
  worth: '',
  worthCurrency: '',
})

const paymentResultToPayment = (w: RPCTypes.PaymentOrErrorLocal) => {
  if (!w) {
    return makePayment({error: 'No payments returned'})
  }
  if (!w.payment) {
    return makePayment({error: w.err})
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
    statusSimplified,
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
    statusSimplified: statusSimplifiedToString[statusSimplified],
    target,
    targetType,
    time,
    worth,
    worthCurrency,
  })
}

export {
  accountResultToAccount,
  assetsResultToAssets,
  makeAccount,
  makeAssets,
  makePayment,
  makeReserve,
  makeState,
  paymentResultToPayment,
}
