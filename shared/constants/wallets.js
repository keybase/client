// @flow
import * as I from 'immutable'
import * as Types from './types/wallets'
import * as RPCTypes from './types/rpc-stellar-gen'
import * as Styles from '../styles'
import {invert} from 'lodash-es'
import {type TypedState} from './reducer'
import HiddenString from '../util/hidden-string'
import logger from '../logger'

const balanceDeltaToString = invert(RPCTypes.localBalanceDelta)
const statusSimplifiedToString = invert(RPCTypes.localPaymentStatus)
const partyTypeToString = invert(RPCTypes.localParticipantType)
const requestStatusToString = invert(RPCTypes.commonRequestStatus)

const sendReceiveFormRouteKey = 'sendReceiveForm'
const chooseAssetFormRouteKey = 'chooseAssetForm'
const confirmFormRouteKey = 'confirmForm'
const sendReceiveFormRoutes = [sendReceiveFormRouteKey, confirmFormRouteKey]

const makeReserve: I.RecordFactory<Types._Reserve> = I.Record({
  amount: '',
  description: '',
})

const makeBuilding: I.RecordFactory<Types._Building> = I.Record({
  amount: '',
  currency: 'XLM', // FIXME: Use default currency?
  from: Types.noAccountID,
  isRequest: false,
  publicMemo: new HiddenString(''),
  recipientType: 'keybaseUser',
  secretNote: new HiddenString(''),
  to: '',
  sendAssetChoices: null,
})

const makeBuiltPayment: I.RecordFactory<Types._BuiltPayment> = I.Record({
  amountErrMsg: '',
  amountFormatted: '',
  banners: null,
  from: Types.noAccountID,
  publicMemoErrMsg: new HiddenString(''),
  readyToSend: false,
  secretNoteErrMsg: new HiddenString(''),
  toErrMsg: '',
  worthAmount: '',
  worthCurrency: '',
  worthDescription: '',
  worthInfo: '',
})

const makeBuiltRequest: I.RecordFactory<Types._BuiltRequest> = I.Record({
  amountErrMsg: '',
  banners: null,
  readyToRequest: false,
  secretNoteErrMsg: new HiddenString(''),
  toErrMsg: '',
  worthDescription: '',
  worthInfo: '',
})

const makeState: I.RecordFactory<Types._State> = I.Record({
  accountMap: I.OrderedMap(),
  accountName: '',
  accountNameError: '',
  accountNameValidationState: 'none',
  assetsMap: I.Map(),
  building: makeBuilding(),
  builtPayment: makeBuiltPayment(),
  builtRequest: makeBuiltRequest(),
  createNewAccountError: '',
  currencies: I.List(),
  currencyMap: I.Map(),
  exportedSecretKey: new HiddenString(''),
  exportedSecretKeyAccountID: Types.noAccountID,
  linkExistingAccountError: '',
  paymentCursorMap: I.Map(),
  paymentLoadingMoreMap: I.Map(),
  paymentOldestUnreadMap: I.Map(),
  paymentsMap: I.Map(),
  requests: I.Map(),
  secretKey: new HiddenString(''),
  secretKeyError: '',
  secretKeyMap: I.Map(),
  secretKeyValidationState: 'none',
  selectedAccount: Types.noAccountID,
  sentPaymentError: '',
  unreadPaymentsMap: I.Map(),
})

const buildPaymentResultToBuiltPayment = (b: RPCTypes.BuildPaymentResLocal) =>
  makeBuiltPayment({
    amountErrMsg: b.amountErrMsg,
    amountFormatted: b.amountFormatted,
    banners: b.banners,
    from: Types.stringToAccountID(b.from),
    publicMemoErrMsg: new HiddenString(b.publicMemoErrMsg),
    readyToSend: b.readyToSend,
    secretNoteErrMsg: new HiddenString(b.secretNoteErrMsg),
    toErrMsg: b.toErrMsg,
    worthAmount: b.worthAmount,
    worthCurrency: b.worthCurrency,
    worthDescription: b.worthDescription,
    worthInfo: b.worthInfo,
  })

const buildRequestResultToBuiltRequest = (b: RPCTypes.BuildRequestResLocal) =>
  makeBuiltRequest({
    amountErrMsg: b.amountErrMsg,
    banners: b.banners,
    readyToRequest: b.readyToRequest,
    secretNoteErrMsg: new HiddenString(b.secretNoteErrMsg),
    toErrMsg: b.toErrMsg,
    worthDescription: b.worthDescription,
    worthInfo: b.worthInfo,
  })

const makeAccount: I.RecordFactory<Types._Account> = I.Record({
  accountID: Types.noAccountID,
  balanceDescription: '',
  isDefault: false,
  name: '',
})

const unknownAccount = makeAccount()

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
  issuerVerifiedDomain: '',
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
    issuerVerifiedDomain: w.issuerVerifiedDomain,
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
  id: Types.noPaymentID,
  note: new HiddenString(''),
  noteErr: new HiddenString(''),
  publicMemo: new HiddenString(''),
  publicMemoType: '',
  readState: 'read',
  section: 'none',
  source: '',
  sourceAccountID: '',
  sourceType: '',
  statusDescription: '',
  statusDetail: '',
  statusSimplified: 'none',
  target: '',
  targetAccountID: '',
  targetType: '',
  time: null,
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

const partyToDescription = (type, username, assertion, name, id): string => {
  switch (type) {
    case 'keybase':
      return username
    case 'sbs':
      return assertion
    case 'ownaccount':
      return name
    default:
      return id
  }
}

const paymentResultToPayment = (
  w: RPCTypes.PaymentOrErrorLocal,
  section: Types.PaymentSection,
  oldestUnread: ?RPCTypes.PaymentID
) => {
  if (!w) {
    return makePayment({error: 'No payments returned'})
  }
  if (!w.payment) {
    return makePayment({error: w.err})
  }
  let readState
  if (w.payment.id === oldestUnread) {
    readState = 'oldestUnread'
  } else if (w.payment.unread) {
    readState = 'unread'
  } else {
    readState = 'read'
  }
  return makePayment({
    ...rpcPaymentToPaymentCommon(w.payment, section),
    readState,
  })
}

const paymentDetailResultToPayment = (p: RPCTypes.PaymentDetailsLocal) =>
  makePayment({
    ...rpcPaymentToPaymentCommon(p),
    // Payment details have no unread field.
    readState: 'read',
    publicMemo: new HiddenString(p.publicNote),
    publicMemoType: p.publicNoteType,
    txID: p.txID,
  })

const rpcPaymentToPaymentCommon = (
  p: RPCTypes.PaymentLocal | RPCTypes.PaymentDetailsLocal,
  section?: Types.PaymentSection
) => {
  const sourceType = partyTypeToString[p.fromType]
  const targetType = partyTypeToString[p.toType]
  const source = partyToDescription(sourceType, p.fromUsername, '', p.fromAccountName, p.fromAccountID)
  const target = partyToDescription(
    targetType,
    p.toUsername,
    p.toAssertion,
    p.toAccountName,
    p.toAccountID || ''
  )
  const serviceStatusSimplfied = statusSimplifiedToString[p.statusSimplified]
  return {
    ...(section ? {section} : null),
    amountDescription: p.amountDescription,
    delta: balanceDeltaToString[p.delta],
    error: '',
    id: Types.rpcPaymentIDToPaymentID(p.id),
    note: new HiddenString(p.note),
    noteErr: new HiddenString(p.noteErr),
    source,
    sourceAccountID: p.fromAccountID,
    sourceType,
    statusDescription: p.statusDescription,
    statusDetail: p.statusDetail,
    statusSimplified: serviceStatusSimplfied === 'claimable' ? 'cancelable' : serviceStatusSimplfied,
    target,
    targetAccountID: p.toAccountID,
    targetType,
    time: p.time,
    worth: p.worth,
    worthCurrency: p.worthCurrency,
  }
}

const makeAssetDescription: I.RecordFactory<Types._AssetDescription> = I.Record({
  code: '',
  issuerAccountID: Types.noAccountID,
  issuerName: '',
  issuerVerifiedDomain: '',
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
    const assetResult = r.asset
    asset = makeAssetDescription({
      code: assetResult.code,
      issuerAccountID: Types.stringToAccountID(assetResult.issuer),
      issuerName: assetResult.issuerName,
      issuerVerifiedDomain: assetResult.verifiedDomain,
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

const bannerLevelToBackground = (level: string) => {
  switch (level) {
    case 'info':
      return 'Announcements'
    case 'error':
      return 'HighRisk'
    default:
      console.warn('Unexpected banner level', level)
      return 'Information'
  }
}

const partyTypeToCounterpartyType = (t: string): Types.CounterpartyType => {
  switch (t) {
    case 'ownaccount':
      return 'otherAccount'
    case 'sbs':
    case 'keybase':
      return 'keybaseUser'
    case 'stellar':
      return 'stellarPublicKey'
    default:
      // TODO: Have better typing here so we don't need this.
      return 'stellarPublicKey'
  }
}

const paymentToYourRoleAndCounterparty = (
  p: Types.Payment
): {yourRole: Types.Role, counterparty: string, counterpartyType: Types.CounterpartyType} => {
  switch (p.delta) {
    case 'none':
      // Need to guard check that sourceType is non-empty to handle the
      // case when p is the empty value.
      if (p.sourceType && p.sourceType !== 'ownaccount') {
        throw new Error(`Unexpected sourceType ${p.sourceType} with delta=none`)
      }
      if (p.targetType && p.targetType !== 'ownaccount') {
        throw new Error(`Unexpected targetType ${p.targetType} with delta=none`)
      }
      if (p.source !== p.target) {
        throw new Error(`source=${p.source} != target=${p.target} with delta=none`)
      }
      return {yourRole: 'senderAndReceiver', counterparty: p.source, counterpartyType: 'otherAccount'}

    case 'increase':
      return {
        yourRole: 'receiverOnly',
        counterparty: p.source,
        counterpartyType: partyTypeToCounterpartyType(p.sourceType),
      }
    case 'decrease':
      return {
        yourRole: 'senderOnly',
        counterparty: p.target,
        counterpartyType: partyTypeToCounterpartyType(p.targetType),
      }

    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllCasesAbove: (type: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllCasesAbove(p.delta);
      */
      throw new Error(`Unexpected delta ${p.delta}`)
  }
}

// Update payment, take all new fields except any that contain the default value
const emptyPayment = makePayment()
// $FlowIssue thinks toSeq() has something to do with the `payment.delta` type
const keys = emptyPayment
  .toSeq()
  .keySeq()
  .toArray()
const updatePayment = (oldPayment: Types.Payment, newPayment: Types.Payment): Types.Payment => {
  const res = oldPayment.withMutations(paymentMutable => {
    keys.forEach(
      key =>
        newPayment.get(key) === emptyPayment.get(key) ? null : paymentMutable.set(key, newPayment.get(key))
    )
  })
  return res
}
const updatePaymentMap = (
  map: I.Map<Types.PaymentID, Types.Payment>,
  newPayments: Array<Types.Payment>,
  clearExisting: boolean = false
) => {
  const baseMap = clearExisting ? map.clear() : map
  return baseMap.withMutations(mapMutable =>
    newPayments.forEach(newPayment =>
      mapMutable.update(newPayment.id, makePayment(), oldPayment => updatePayment(oldPayment, newPayment))
    )
  )
}

const changeAccountNameWaitingKey = 'wallets:changeAccountName'
const createNewAccountWaitingKey = 'wallets:createNewAccount'
const changeDisplayCurrencyWaitingKey = 'wallets:changeDisplayCurrency'
const linkExistingWaitingKey = 'wallets:linkExisting'
const loadEverythingWaitingKey = 'wallets:loadEverything'
const buildPaymentWaitingKey = 'wallets:buildPayment'
const sendPaymentWaitingKey = 'wallets:stellarSend'
const requestPaymentWaitingKey = 'wallets:requestPayment'
const setAccountAsDefaultWaitingKey = 'wallets:setAccountAsDefault'
const deleteAccountWaitingKey = 'wallets:deleteAccount'
const searchKey = 'walletSearch'
const loadAccountWaitingKey = (id: Types.AccountID) => `wallets:loadAccount:${id}`
const cancelPaymentWaitingKey = (id: Types.PaymentID) =>
  `wallets:cancelPayment:${Types.paymentIDToString(id)}`

const getAccountIDs = (state: TypedState) => state.wallets.accountMap.keySeq().toList()

const getAccounts = (state: TypedState) => state.wallets.accountMap.valueSeq().toList()

const getSelectedAccount = (state: TypedState) => state.wallets.selectedAccount

const getDisplayCurrencies = (state: TypedState) => state.wallets.currencies

const getDisplayCurrency = (state: TypedState, accountID: Types.AccountID) =>
  state.wallets.currencyMap.get(accountID, makeCurrency())

const getPayments = (state: TypedState, accountID: Types.AccountID) =>
  state.wallets.paymentsMap.get(accountID, null)

const getOldestUnread = (state: TypedState, accountID: Types.AccountID) =>
  state.wallets.paymentOldestUnreadMap.get(accountID, Types.noPaymentID)

const getPayment = (state: TypedState, accountID: Types.AccountID, paymentID: Types.PaymentID) =>
  state.wallets.paymentsMap.get(accountID, I.Map()).get(paymentID, makePayment())

const getRequest = (state: TypedState, requestID: RPCTypes.KeybaseRequestID) =>
  state.wallets.requests.get(requestID, null)

const getAccount = (state: TypedState, accountID: Types.AccountID) =>
  state.wallets.accountMap.get(accountID, unknownAccount)

const getDefaultAccountID = (state: TypedState) => {
  const defaultAccount = state.wallets.accountMap.find(a => a.isDefault)
  return defaultAccount ? defaultAccount.accountID : null
}

const getAssets = (state: TypedState, accountID: Types.AccountID) =>
  state.wallets.assetsMap.get(accountID, I.List())

const getFederatedAddress = (state: TypedState, accountID: Types.AccountID) => {
  const account = state.wallets.accountMap.get(accountID, unknownAccount)
  const {username} = state.config
  return username && account.isDefault ? `${username}*keybase.io` : ''
}

const getSecretKey = (state: TypedState, accountID: Types.AccountID) =>
  accountID === state.wallets.exportedSecretKeyAccountID
    ? state.wallets.exportedSecretKey
    : new HiddenString('')

const shortenAccountID = (id: Types.AccountID) => id.substring(0, 8) + '...' + id.substring(48)

const isAccountLoaded = (state: TypedState, accountID: Types.AccountID) =>
  state.wallets.accountMap.has(accountID)

const isFederatedAddress = (address: ?string) => (address ? address.includes('*') : false)

const getCurrencyAndSymbol = (state: TypedState, code: string) => {
  if (!state.wallets.currencies || !code) {
    return 'XLM'
  }
  const currency = state.wallets.currencies.find(c => c.code === code)
  return currency ? currency.description : code
}

const balanceChangeColor = (delta: Types.PaymentDelta, status: Types.StatusSimplified) => {
  let balanceChangeColor = Styles.globalColors.black
  if (delta !== 'none') {
    balanceChangeColor = delta === 'increase' ? Styles.globalColors.green : Styles.globalColors.red
  }
  if (status !== 'completed') {
    balanceChangeColor = Styles.globalColors.black_20
  }
  return balanceChangeColor
}

const balanceChangeSign = (delta: Types.PaymentDelta, balanceChange: string = '') => {
  let sign = ''
  if (delta !== 'none') {
    sign = delta === 'increase' ? '+' : '-'
  }
  return sign + balanceChange
}

export {
  accountResultToAccount,
  assetsResultToAssets,
  bannerLevelToBackground,
  balanceChangeColor,
  balanceChangeSign,
  buildPaymentWaitingKey,
  cancelPaymentWaitingKey,
  changeDisplayCurrencyWaitingKey,
  currenciesResultToCurrencies,
  changeAccountNameWaitingKey,
  balanceDeltaToString,
  buildPaymentResultToBuiltPayment,
  buildRequestResultToBuiltRequest,
  chooseAssetFormRouteKey,
  confirmFormRouteKey,
  createNewAccountWaitingKey,
  deleteAccountWaitingKey,
  getAccountIDs,
  getAccounts,
  getAccount,
  getAssets,
  getCurrencyAndSymbol,
  getDisplayCurrencies,
  getDisplayCurrency,
  getDefaultAccountID,
  getFederatedAddress,
  getPayment,
  getPayments,
  getOldestUnread,
  getRequest,
  getSecretKey,
  getSelectedAccount,
  isAccountLoaded,
  isFederatedAddress,
  linkExistingWaitingKey,
  loadAccountWaitingKey,
  loadEverythingWaitingKey,
  makeAccount,
  makeAssetDescription,
  makeAssets,
  makeCurrencies,
  makeBuilding,
  makeBuiltPayment,
  makeBuiltRequest,
  makePayment,
  makeRequest,
  makeReserve,
  makeState,
  paymentDetailResultToPayment,
  paymentResultToPayment,
  paymentToYourRoleAndCounterparty,
  requestResultToRequest,
  requestPaymentWaitingKey,
  sendPaymentWaitingKey,
  sendReceiveFormRouteKey,
  sendReceiveFormRoutes,
  setAccountAsDefaultWaitingKey,
  searchKey,
  shortenAccountID,
  statusSimplifiedToString,
  unknownAccount,
  updatePayment,
  updatePaymentMap,
}
