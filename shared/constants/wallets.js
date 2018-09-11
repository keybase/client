// @flow
import * as I from 'immutable'
import * as Types from './types/wallets'
import * as RPCTypes from './types/rpc-stellar-gen'
import {invert} from 'lodash-es'
import {type TypedState} from './reducer'
import HiddenString from '../util/hidden-string'
import logger from '../logger'

const balanceDeltaToString = invert(RPCTypes.localBalanceDelta)
const statusSimplifiedToString = invert(RPCTypes.localPaymentStatus)
const partyTypeToString = invert(RPCTypes.localParticipantType)
const requestStatusToString = invert(RPCTypes.commonRequestStatus)

const sendReceiveFormRouteKey = 'sendReceiveForm'
const confirmFormRouteKey = 'confirmForm'
const sendReceiveFormRoutes = [sendReceiveFormRouteKey, confirmFormRouteKey]

const makeReserve: I.RecordFactory<Types._Reserve> = I.Record({
  amount: '',
  description: '',
})

const makeBuildingPayment: I.RecordFactory<Types._BuildingPayment> = I.Record({
  amount: '0',
  currency: 'XLM', // FIXME: Use default currency?
  from: '',
  publicMemo: new HiddenString(''),
  recipientType: null,
  secretNote: new HiddenString(''),
  to: '',
})

const makeBuiltPayment: I.RecordFactory<Types._BuiltPayment> = I.Record({
  amountErrMsg: '',
  banners: null,
  publicMemoErrMsg: new HiddenString(''),
  readyToSend: false,
  secretNoteErrMsg: new HiddenString(''),
  toErrMsg: '',
  toUsername: '',
  worthDescription: '',
  worthInfo: '',
})

const makeState: I.RecordFactory<Types._State> = I.Record({
  accountMap: I.Map(),
  accountName: '',
  accountNameError: '',
  accountNameValidationState: 'none',
  assetsMap: I.Map(),
  buildingPayment: makeBuildingPayment(),
  builtPayment: makeBuiltPayment(),
  createNewAccountError: '',
  exportedSecretKey: new HiddenString(''),
  exportedSecretKeyAccountID: Types.noAccountID,
  linkExistingAccountError: '',
  paymentsMap: I.Map(),
  pendingMap: I.Map(),
  requests: I.Map(),
  secretKey: new HiddenString(''),
  secretKeyError: '',
  secretKeyMap: I.Map(),
  secretKeyValidationState: 'none',
  selectedAccount: Types.noAccountID,
  currencies: I.List(),
  currencyMap: I.Map(),
})

const buildPaymentResultToBuiltPayment = (b: RPCTypes.BuildPaymentResLocal) =>
  makeBuiltPayment({
    amountErrMsg: b.amountErrMsg,
    banners: b.banners,
    publicMemoErrMsg: new HiddenString(b.publicMemoErrMsg),
    readyToSend: b.readyToSend,
    secretNoteErrMsg: new HiddenString(b.secretNoteErrMsg),
    toErrMsg: b.toErrMsg,
    toUsername: b.toUsername,
    worthDescription: b.worthDescription,
    worthInfo: b.worthInfo,
  })

const makeAccount: I.RecordFactory<Types._Account> = I.Record({
  accountID: Types.noAccountID,
  balanceDescription: '',
  isDefault: false,
  name: '',
})

const accountResultToAccount = (w: RPCTypes.WalletAccountLocal) =>
  makeAccount({
    accountID: Types.stringToAccountID(w.accountID),
    balanceDescription: w.balanceDescription,
    isDefault: w.isDefault,
    name: w.name,
  })

const makeAssets: I.RecordFactory<Types._Assets> = I.Record({
  assetCode: '',
  balanceAvailableToSend: '',
  balanceTotal: '',
  issuerAccountID: '',
  issuerName: '',
  name: '',
  worth: '',
  worthCurrency: '',
  availableToSendWorth: '',
  reserves: I.List(),
})

const assetsResultToAssets = (w: RPCTypes.AccountAssetLocal) =>
  makeAssets({
    assetCode: w.assetCode,
    balanceAvailableToSend: w.balanceAvailableToSend,
    balanceTotal: w.balanceTotal,
    issuerAccountID: w.issuerAccountID,
    issuerName: w.issuerName,
    name: w.name,
    worth: w.worth,
    worthCurrency: w.worthCurrency,
    availableToSendWorth: w.availableToSendWorth,
    reserves: I.List((w.reserves || []).map(makeReserve)),
  })

const makeCurrencies: I.RecordFactory<Types._LocalCurrency> = I.Record({
  description: '',
  code: '',
  symbol: '',
  name: '',
})

const currenciesResultToCurrencies = (w: RPCTypes.CurrencyLocal) =>
  makeCurrencies({
    description: w.description,
    code: w.code,
    symbol: w.symbol,
    name: w.name,
  })

const makePayment: I.RecordFactory<Types._Payment> = I.Record({
  amountDescription: '',
  delta: 'none',
  error: '',
  id: {txID: ''},
  note: new HiddenString(''),
  noteErr: new HiddenString(''),
  publicMemo: new HiddenString(''),
  publicMemoType: '',
  source: '',
  sourceType: '',
  statusDescription: '',
  statusDetail: '',
  statusSimplified: 'none',
  target: '',
  targetType: '',
  time: 0,
  txID: '',
  worth: '',
  worthCurrency: '',
})

const makeCurrency: I.RecordFactory<Types._LocalCurrency> = I.Record({
  description: '',
  code: '',
  symbol: '',
  name: '',
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
    note: new HiddenString(p.note),
    noteErr: new HiddenString(p.noteErr),
    source: p.source,
    sourceType: partyTypeToString[p.sourceType],
    statusDescription: p.statusDescription,
    statusDetail: p.statusDetail,
    statusSimplified: statusSimplifiedToString[p.statusSimplified],
    target: p.target,
    targetType: partyTypeToString[p.targetType],
    time: p.time,
    worth: p.worth,
    worthCurrency: p.worthCurrency,
  })
}

const makeAssetDescription: I.RecordFactory<Types._AssetDescription> = I.Record({
  code: '',
  issuerAccountID: Types.noAccountID,
  issuerName: null,
})

const makeRequest: I.RecordFactory<Types._Request> = I.Record({
  amount: '',
  amountDescription: '',
  asset: 'native',
  completed: false,
  completedTransactionID: null,
  currencyCode: '',
  id: '',
  requestee: '',
  requesteeType: '',
  sender: '',
  status: 'ok',
})

const requestResultToRequest = (r: RPCTypes.RequestDetailsLocal) => {
  let asset = 'native'
  let currencyCode = ''
  if (!(r.asset || r.currency)) {
    logger.error('Received requestDetails with no asset or currency code')
    return null
  } else if (r.asset && r.asset.type !== 'native') {
    asset = makeAssetDescription({
      code: r.asset.code,
      issuerAccountID: Types.stringToAccountID(r.asset.issuer),
    })
  } else if (r.currency) {
    asset = 'currency'
    currencyCode = r.currency
  }
  return makeRequest({
    amount: r.amount,
    amountDescription: r.amountDescription,
    asset,
    currencyCode,
    id: r.id,
    requestee: r.toAssertion,
    requesteeType: partyTypeToString[r.toUserType],
    sender: r.fromAssertion,
    status: requestStatusToString[r.status],
  })
}

const paymentToCounterpartyType = (p: Types.Payment): Types.CounterpartyType => {
  let partyType = p.delta === 'increase' ? p.sourceType : p.targetType
  switch (partyType) {
    case 'sbs':
    case 'keybase':
      if (p.source === p.target) {
        return 'otherAccount'
      }
      return 'keybaseUser'
    case 'stellar':
      return 'stellarPublicKey'
  }
  return 'stellarPublicKey'
}

const paymentToYourRole = (p: Types.Payment, username: string): 'sender' | 'receiver' => {
  return p.delta === 'increase' ? 'receiver' : 'sender'
}

const createNewAccountWaitingKey = 'wallets:createNewAccount'
const changeDisplayCurrencyWaitingKey = 'wallets:changeDisplayCurrency'
const linkExistingWaitingKey = 'wallets:linkExisting'
const loadEverythingWaitingKey = 'wallets:loadEverything'
const sendPaymentWaitingKey = 'wallets:stellarSend'
const requestPaymentWaitingKey = 'wallets:requestPayment'
const setAccountAsDefaultWaitingKey = 'wallets:setAccountAsDefault'
const deleteAccountWaitingKey = 'wallets:deleteAccount'

const getAccountIDs = (state: TypedState) => state.wallets.accountMap.keySeq().toList()

const getSelectedAccount = (state: TypedState) => state.wallets.selectedAccount

const getDisplayCurrencies = (state: TypedState) => state.wallets.currencies

const getDisplayCurrency = (state: TypedState, accountID?: Types.AccountID) =>
  state.wallets.currencyMap.get(accountID || getSelectedAccount(state), makeCurrency())

const getPayments = (state: TypedState, accountID?: Types.AccountID) =>
  state.wallets.paymentsMap.get(accountID || getSelectedAccount(state), I.List())

const getPendingPayments = (state: TypedState, accountID?: Types.AccountID) =>
  state.wallets.pendingMap.get(accountID || getSelectedAccount(state), I.List())

const getPayment = (state: TypedState, accountID: Types.AccountID, paymentID: RPCTypes.PaymentID) =>
  state.wallets.paymentsMap.get(accountID, I.List()).find(p => Types.paymentIDIsEqual(p.id, paymentID)) ||
  makePayment()

const getPendingPayment = (state: TypedState, accountID: Types.AccountID, paymentID: RPCTypes.PaymentID) =>
  state.wallets.pendingMap.get(accountID, I.List()).find(p => Types.paymentIDIsEqual(p.id, paymentID)) ||
  makePayment()

const getRequest = (state: TypedState, requestID: RPCTypes.KeybaseRequestID) =>
  state.wallets.requests.get(requestID, null)

const getAccount = (state: TypedState, accountID?: Types.AccountID) =>
  state.wallets.accountMap.get(accountID || getSelectedAccount(state), makeAccount())

const getAccountName = (account: Types.Account) =>
  account.name ||
  (account.accountID !== Types.noAccountID ? Types.accountIDToString(account.accountID) : null)

const getDefaultAccountID = (state: TypedState) => {
  const defaultAccount = state.wallets.accountMap.find(a => a.isDefault)
  return defaultAccount ? defaultAccount.accountID : null
}

const getAssets = (state: TypedState, accountID?: Types.AccountID) =>
  state.wallets.assetsMap.get(accountID || getSelectedAccount(state), I.List())

const getFederatedAddress = (state: TypedState, accountID?: Types.AccountID) => {
  const account = state.wallets.accountMap.get(accountID || getSelectedAccount(state), makeAccount())
  const {username} = state.config
  return username && account.isDefault ? `${username}*keybase.io` : ''
}

const getSecretKey = (state: TypedState, accountID: Types.AccountID) =>
  accountID === state.wallets.exportedSecretKeyAccountID
    ? state.wallets.exportedSecretKey
    : new HiddenString('')

export {
  accountResultToAccount,
  assetsResultToAssets,
  changeDisplayCurrencyWaitingKey,
  currenciesResultToCurrencies,
  balanceDeltaToString,
  buildPaymentResultToBuiltPayment,
  confirmFormRouteKey,
  createNewAccountWaitingKey,
  deleteAccountWaitingKey,
  getAccountIDs,
  getAccountName,
  getAccount,
  getAssets,
  getDisplayCurrencies,
  getDisplayCurrency,
  getDefaultAccountID,
  getFederatedAddress,
  getPayment,
  getPayments,
  getPendingPayment,
  getPendingPayments,
  getRequest,
  getSecretKey,
  getSelectedAccount,
  linkExistingWaitingKey,
  loadEverythingWaitingKey,
  makeAccount,
  makeAssetDescription,
  makeAssets,
  makeCurrencies,
  makeBuildingPayment,
  makeBuiltPayment,
  makePayment,
  makeRequest,
  makeReserve,
  makeState,
  paymentResultToPayment,
  paymentToCounterpartyType,
  paymentToYourRole,
  requestResultToRequest,
  requestPaymentWaitingKey,
  sendPaymentWaitingKey,
  sendReceiveFormRouteKey,
  sendReceiveFormRoutes,
  setAccountAsDefaultWaitingKey,
  statusSimplifiedToString,
}
