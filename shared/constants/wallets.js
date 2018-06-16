// @flow
import * as I from 'immutable'
import * as Types from './types/wallets'
import * as RPCTypes from './types/rpc-stellar-gen'
import {invert} from 'lodash'
import {type TypedState} from './reducer'

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
  selectedAccount: null,
})

const makeAccount: I.RecordFactory<Types._Account> = I.Record({
  accountID: '',
  balanceDescription: '',
  isDefault: false,
  name: '',
})

const accountResultToAccount = (w: RPCTypes.WalletAccountLocal) =>
  makeAccount({
    accountID: w.accountID,
    balanceDescription: w.balanceDescription,
    isDefault: w.isDefault,
    name: w.name,
  })

const makeAssets: I.RecordFactory<Types._Assets> = I.Record({
  assetCode: '',
  balanceAvailableToSend: '',
  balanceTotal: '',
  issuer: '',
  name: '',
  worth: '',
  worthCurrency: '',
})

const assetsResultToAssets = (w: RPCTypes.AccountAssetLocal) =>
  makeAssets({
    assetCode: w.assetCode,
    balanceAvailableToSend: w.balanceAvailableToSend,
    balanceTotal: w.balanceTotal,
    issuer: w.issuer,
    name: w.name,
    worth: w.worth,
    worthCurrency: w.worthCurrency,
  })

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
  const p = w.payment
  return makePayment({
    amountDescription: p.amountDescription,
    delta: balanceDeltaToString[p.delta],
    error: '',
    id: p.id,
    note: p.note,
    noteErr: p.noteErr,
    source: p.source,
    sourceType: p.sourceType,
    statusDescription: p.statusDescription,
    statusDetail: p.statusDetail,
    statusSimplified: statusSimplifiedToString[p.statusSimplified],
    target: p.target,
    targetType: p.targetType,
    time: p.time,
    worth: p.worth,
    worthCurrency: p.worthCurrency,
  })
}

const loadEverythingWaitingKey = 'wallets:loadEverything'

const getAccounts = (state: TypedState) => state.wallets.accountMap

const getSelectedAccount = (state: TypedState) => state.wallets.selectedAccount

export {
  accountResultToAccount,
  assetsResultToAssets,
  loadEverythingWaitingKey,
  makeAccount,
  makeAssets,
  makePayment,
  makeReserve,
  makeState,
  paymentResultToPayment,
  getAccounts,
  getSelectedAccount,
}
