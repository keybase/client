// @flow
import * as I from 'immutable'
import * as Types from './types/wallets'
import * as RPCTypes from './types/rpc-stellar-gen'
import * as Styles from '../styles'
import * as Tabs from './tabs'
import * as Flow from '../util/flow'
import * as SettingsConstants from './settings'
import {isMobile} from './platform'
import {invert} from 'lodash-es'
import {type TypedState} from './reducer'
import HiddenString from '../util/hidden-string'
import {getPath, type RouteStateNode} from '../route-tree'

export const balanceDeltaToString: {
  [key: RPCTypes.BalanceDelta]: $Keys<typeof RPCTypes.localBalanceDelta>,
} = invert(RPCTypes.localBalanceDelta)
export const statusSimplifiedToString: {
  [key: RPCTypes.PaymentStatus]: $Keys<typeof RPCTypes.localPaymentStatus>,
} = invert(RPCTypes.localPaymentStatus)
const partyTypeToString: {
  [key: RPCTypes.ParticipantType]: $Keys<typeof RPCTypes.localParticipantType>,
} = invert(RPCTypes.localParticipantType)

export const sendRequestFormRouteKey = 'sendReceiveForm'
export const chooseAssetFormRouteKey = 'chooseAssetForm'
export const confirmFormRouteKey = 'confirmForm'
export const sendRequestFormRoutes = [sendRequestFormRouteKey, confirmFormRouteKey]

export const makeInflationDestination: I.RecordFactory<Types._InflationDestination> = I.Record({
  address: '',
  link: '',
  name: '',
  recommended: false,
})

export const makeAccountInflationDestination: I.RecordFactory<Types._AccountInflationDestination> = I.Record({
  accountID: Types.noAccountID,
  name: '',
})
export const noAccountInflationDestination = makeAccountInflationDestination()

export const makeReserve: I.RecordFactory<Types._Reserve> = I.Record({
  amount: '',
  description: '',
})

export const makeBuilding: I.RecordFactory<Types._Building> = I.Record({
  amount: '',
  bid: '',
  currency: 'XLM', // FIXME: Use default currency?
  from: Types.noAccountID,
  isRequest: false,
  publicMemo: new HiddenString(''),
  recipientType: 'keybaseUser',
  secretNote: new HiddenString(''),
  sendAssetChoices: null,
  to: '',
})

export const makeBuiltPayment: I.RecordFactory<Types._BuiltPayment> = I.Record({
  amountAvailable: '',
  amountErrMsg: '',
  builtBanners: null,
  displayAmountFiat: '',
  displayAmountXLM: '',
  from: Types.noAccountID,
  publicMemoErrMsg: new HiddenString(''),
  readyToReview: false,
  readyToSend: 'spinning',
  reviewBanners: null,
  secretNoteErrMsg: new HiddenString(''),
  sendingIntentionXLM: false,
  toErrMsg: '',
  worthAmount: '',
  worthCurrency: '',
  worthDescription: '',
  worthInfo: '',
})

export const makeBuiltRequest: I.RecordFactory<Types._BuiltRequest> = I.Record({
  amountErrMsg: '',
  builtBanners: null,
  displayAmountFiat: '',
  displayAmountXLM: '',
  readyToRequest: false,
  secretNoteErrMsg: new HiddenString(''),
  sendingIntentionXLM: false,
  toErrMsg: '',
  worthDescription: '',
  worthInfo: '',
})

export const makeState: I.RecordFactory<Types._State> = I.Record({
  acceptedDisclaimer: false,
  acceptingDisclaimerDelay: false,
  accountMap: I.OrderedMap(),
  accountName: '',
  accountNameError: '',
  accountNameValidationState: 'none',
  assetsMap: I.Map(),
  buildCounter: 0,
  building: makeBuilding(),
  builtPayment: makeBuiltPayment(),
  builtRequest: makeBuiltRequest(),
  createNewAccountError: '',
  currencies: I.List(),
  exportedSecretKey: new HiddenString(''),
  exportedSecretKeyAccountID: Types.noAccountID,
  inflationDestinationError: '',
  inflationDestinationMap: I.Map(),
  inflationDestinations: I.List(),
  lastSentXLM: false,
  linkExistingAccountError: '',
  mobileOnlyMap: I.Map(),
  newPayments: I.Map(),
  paymentCursorMap: I.Map(),
  paymentLoadingMoreMap: I.Map(),
  paymentOldestUnreadMap: I.Map(),
  paymentsMap: I.Map(),
  reviewCounter: 0,
  reviewLastSeqno: null,
  secretKey: new HiddenString(''),
  secretKeyError: '',
  secretKeyMap: I.Map(),
  secretKeyValidationState: 'none',
  selectedAccount: Types.noAccountID,
  sentPaymentError: '',
  unreadPaymentsMap: I.Map(),
})

export const buildPaymentResultToBuiltPayment = (b: RPCTypes.BuildPaymentResLocal) =>
  makeBuiltPayment({
    amountAvailable: b.amountAvailable,
    amountErrMsg: b.amountErrMsg,
    builtBanners: b.banners,
    displayAmountFiat: b.displayAmountFiat,
    displayAmountXLM: b.displayAmountXLM,
    from: Types.stringToAccountID(b.from),
    publicMemoErrMsg: new HiddenString(b.publicMemoErrMsg),
    readyToReview: b.readyToReview,
    secretNoteErrMsg: new HiddenString(b.secretNoteErrMsg),
    sendingIntentionXLM: b.sendingIntentionXLM,
    toErrMsg: b.toErrMsg,
    worthAmount: b.worthAmount,
    worthCurrency: b.worthCurrency,
    worthDescription: b.worthDescription,
    worthInfo: b.worthInfo,
  })

export const buildRequestResultToBuiltRequest = (b: RPCTypes.BuildRequestResLocal) =>
  makeBuiltRequest({
    amountErrMsg: b.amountErrMsg,
    builtBanners: b.banners,
    displayAmountFiat: b.displayAmountFiat,
    displayAmountXLM: b.displayAmountXLM,
    readyToRequest: b.readyToRequest,
    secretNoteErrMsg: new HiddenString(b.secretNoteErrMsg),
    sendingIntentionXLM: b.sendingIntentionXLM,
    toErrMsg: b.toErrMsg,
    worthDescription: b.worthDescription,
    worthInfo: b.worthInfo,
  })

export const accountResultToAccount = (w: RPCTypes.WalletAccountLocal) =>
  makeAccount({
    accountID: Types.stringToAccountID(w.accountID),
    accountMode: w.accountMode,
    balanceDescription: w.balanceDescription,
    displayCurrency: currencyResultToCurrency(w.currencyLocal),
    isDefault: w.isDefault,
    mobileOnlyEditable: w.accountModeEditable,
    name: w.name,
  })

export const makeAssets: I.RecordFactory<Types._Assets> = I.Record({
  assetCode: '',
  availableToSendWorth: '',
  balanceAvailableToSend: '',
  balanceTotal: '',
  issuerAccountID: '',
  issuerName: '',
  issuerVerifiedDomain: '',
  name: '',
  reserves: I.List(),
  worth: '',
})

export const assetsResultToAssets = (w: RPCTypes.AccountAssetLocal) =>
  makeAssets({
    assetCode: w.assetCode,
    availableToSendWorth: w.availableToSendWorth,
    balanceAvailableToSend: w.balanceAvailableToSend,
    balanceTotal: w.balanceTotal,
    issuerAccountID: w.issuerAccountID,
    issuerName: w.issuerName,
    issuerVerifiedDomain: w.issuerVerifiedDomain,
    name: w.name,
    reserves: I.List((w.reserves || []).map(makeReserve)),
    worth: w.worth,
  })

export const currencyResultToCurrency = (w: RPCTypes.CurrencyLocal) =>
  makeCurrency({
    code: w.code,
    description: w.description,
    name: w.name,
    symbol: w.symbol,
  })

const _defaultPaymentCommon = {
  amountDescription: '',
  delta: 'none',
  error: '',
  id: Types.noPaymentID,
  issuerAccountID: null,
  issuerDescription: '',
  note: new HiddenString(''),
  noteErr: new HiddenString(''),
  showCancel: false,
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
  worth: '',
  worthAtSendTime: '',
}

const _defaultPaymentResult = {
  ..._defaultPaymentCommon,
  section: 'none',
  unread: false,
}

const _defaultPaymentDetail = {
  ..._defaultPaymentCommon,
  externalTxURL: '',
  publicMemo: new HiddenString(''),
  publicMemoType: '',
  txID: '',
}

const _defaultPayment = {
  ..._defaultPaymentResult,
  ..._defaultPaymentDetail,
}

export const makePaymentResult: I.RecordFactory<Types._PaymentResult> = I.Record(_defaultPaymentResult)

export const makePaymentDetail: I.RecordFactory<Types._PaymentDetail> = I.Record(_defaultPaymentDetail)

export const makePayment: I.RecordFactory<Types._Payment> = I.Record(_defaultPayment)

export const makeCurrency: I.RecordFactory<Types._LocalCurrency> = I.Record({
  code: '',
  description: '',
  name: '',
  symbol: '',
})
export const unknownCurrency = makeCurrency()

export const makeAccount: I.RecordFactory<Types._Account> = I.Record({
  accountID: Types.noAccountID,
  accountMode: Types.accountModeNone,
  balanceDescription: '',
  displayCurrency: unknownCurrency,
  isDefault: false,
  mobileOnlyEditable: false,
  name: '',
})
export const unknownAccount = makeAccount()

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

export const rpcPaymentResultToPaymentResult = (
  w: RPCTypes.PaymentOrErrorLocal,
  section: Types.PaymentSection
) => {
  if (!w) {
    return makePaymentResult({error: 'No payments returned'})
  }
  if (!w.payment) {
    return makePaymentResult({error: w.err})
  }
  const unread = w.payment.unread
  return makePaymentResult({
    ...rpcPaymentToPaymentCommon(w.payment),
    section,
    unread,
  })
}

export const rpcPaymentDetailToPaymentDetail = (p: RPCTypes.PaymentDetailsLocal) =>
  makePaymentDetail({
    ...rpcPaymentToPaymentCommon(p),
    externalTxURL: p.externalTxURL,
    publicMemo: new HiddenString(p.publicNote),
    publicMemoType: p.publicNoteType,
    txID: p.txID,
  })

const rpcPaymentToPaymentCommon = (p: RPCTypes.PaymentLocal | RPCTypes.PaymentDetailsLocal) => {
  const sourceType = partyTypeToString[p.fromType]
  const source = partyToDescription(sourceType, p.fromUsername, '', p.fromAccountName, p.fromAccountID)
  let targetType = partyTypeToString[p.toType]
  let target = partyToDescription(
    targetType,
    p.toUsername,
    p.toAssertion,
    p.toAccountName,
    p.toAccountID || ''
  )
  if (p.statusDescription === 'canceled') {
    // Canceled relay. Similar presentation to a cancelable relay. Service
    // transformed this to an account self-transfer, let's preserve the original
    // target so we can show it.
    target = p.originalToAssertion
    targetType = 'keybase'
  }
  const serviceStatusSimplfied = statusSimplifiedToString[p.statusSimplified]
  return {
    amountDescription: p.amountDescription,
    delta: balanceDeltaToString[p.delta],
    error: '',
    id: Types.rpcPaymentIDToPaymentID(p.id),
    issuerAccountID: p.issuerAccountID ? Types.stringToAccountID(p.issuerAccountID) : null,
    issuerDescription: p.issuerDescription,
    note: new HiddenString(p.note),
    noteErr: new HiddenString(p.noteErr),
    showCancel: p.showCancel,
    source,
    sourceAccountID: p.fromAccountID,
    sourceType,
    statusDescription: p.statusDescription,
    statusDetail: p.statusDetail,
    statusSimplified: serviceStatusSimplfied,
    target,
    targetAccountID: p.toAccountID,
    targetType,
    time: p.time,
    worth: p.worth,
    worthAtSendTime: p.worthAtSendTime,
  }
}

export const makeAssetDescription: I.RecordFactory<Types._AssetDescription> = I.Record({
  code: '',
  issuerAccountID: Types.noAccountID,
  issuerName: '',
  issuerVerifiedDomain: '',
})

export const bannerLevelToBackground = (level: string) => {
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

export const paymentToYourInfoAndCounterparty = (
  p: Types.Payment
): {
  yourAccountName: string,
  yourRole: Types.Role,
  counterparty: string,
  counterpartyType: Types.CounterpartyType,
} => {
  switch (p.delta) {
    case 'none':
      // In this case, sourceType and targetType are usually
      // 'ownaccount', but they may be other values when offline,
      // since the daemon has to check account names to mark them as
      // 'ownaccount'.
      //
      // Also, they may be blank when p is the empty value.
      if (p.source !== p.target) {
        throw new Error(`source=${p.source} != target=${p.target} with delta=none`)
      }
      return {
        counterparty: p.source,
        counterpartyType: 'otherAccount',
        yourAccountName: p.source,
        yourRole: 'senderAndReceiver',
      }

    case 'increase':
      return {
        counterparty: p.source,
        counterpartyType: partyTypeToCounterpartyType(p.sourceType),
        yourAccountName: p.sourceType === 'ownaccount' ? p.target : '',
        yourRole: 'receiverOnly',
      }
    case 'decrease':
      return {
        counterparty: p.target,
        counterpartyType: partyTypeToCounterpartyType(p.targetType),
        yourAccountName: p.sourceType === 'ownaccount' ? p.source : '',
        yourRole: 'senderOnly',
      }

    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(p.delta)
      throw new Error(`Unexpected delta ${p.delta}`)
  }
}

export const updatePaymentDetail = (
  map: I.Map<Types.PaymentID, Types.Payment>,
  paymentDetail: Types.PaymentDetail
): I.Map<Types.PaymentID, Types.Payment> => {
  return map.update(paymentDetail.id, (oldPayment = makePayment()) => oldPayment.merge(paymentDetail))
}

export const updatePaymentsReceived = (
  map: I.Map<Types.PaymentID, Types.Payment>,
  paymentResults: Array<Types.PaymentResult>
): I.Map<Types.PaymentID, Types.Payment> => {
  return map.withMutations(mapMutable =>
    paymentResults.forEach(paymentResult =>
      mapMutable.update(paymentResult.id, (oldPayment = makePayment()) => oldPayment.merge(paymentResult))
    )
  )
}

export const inflationDestResultToAccountInflationDest = (res: RPCTypes.InflationDestinationResultLocal) => {
  if (!res.destination) {
    return noAccountInflationDestination
  }
  return makeAccountInflationDestination({
    accountID: Types.stringToAccountID(res.destination),
    name: res.knownDestination?.name,
  })
}

export const acceptDisclaimerWaitingKey = 'wallets:acceptDisclaimer'
export const changeAccountNameWaitingKey = 'wallets:changeAccountName'
export const createNewAccountWaitingKey = 'wallets:createNewAccount'
export const changeDisplayCurrencyWaitingKey = 'wallets:changeDisplayCurrency'
export const getDisplayCurrencyWaitingKey = (id: Types.AccountID) => `wallets:getDisplayCurrency:${id}`
export const linkExistingWaitingKey = 'wallets:linkExisting'
export const buildPaymentWaitingKey = 'wallets:buildPayment'
export const sendPaymentWaitingKey = 'wallets:stellarSend'
export const requestPaymentWaitingKey = 'wallets:requestPayment'
export const setAccountAsDefaultWaitingKey = 'wallets:setAccountAsDefault'
export const deleteAccountWaitingKey = 'wallets:deleteAccount'
export const searchKey = 'walletSearch'
export const loadAccountWaitingKey = (id: Types.AccountID) => `wallets:loadAccount:${id}`
export const loadAccountsWaitingKey = 'wallets:loadAccounts'
export const cancelPaymentWaitingKey = (id: Types.PaymentID) =>
  `wallets:cancelPayment:${Types.paymentIDToString(id)}`
export const validateAccountNameWaitingKey = 'wallets:validateAccountName'
export const validateSecretKeyWaitingKey = 'wallets:validateSecretKey'
export const getRequestDetailsWaitingKey = (id: Types.PaymentID) =>
  `wallets:requestDetailsWaitingKey:${Types.paymentIDToString(id)}`
export const inflationDestinationWaitingKey = 'wallets:inflationDestination'
export const setAccountMobileOnlyWaitingKey = (id: Types.AccountID) =>
  `wallets:setAccountMobileOnly:${Types.accountIDToString(id)}`
export const checkOnlineWaitingKey = 'wallets:checkOnline'

export const getAccountIDs = (state: TypedState) => state.wallets.accountMap.keySeq().toList()

export const getAccounts = (state: TypedState) => state.wallets.accountMap.valueSeq().toList()

export const getSelectedAccount = (state: TypedState) => state.wallets.selectedAccount

export const getDisplayCurrencies = (state: TypedState) => state.wallets.currencies

export const getPayments = (state: TypedState, accountID: Types.AccountID) =>
  state.wallets.paymentsMap.get(accountID, null)

export const getOldestUnread = (state: TypedState, accountID: Types.AccountID) =>
  state.wallets.paymentOldestUnreadMap.get(accountID, Types.noPaymentID)

export const getPayment = (state: TypedState, accountID: Types.AccountID, paymentID: Types.PaymentID) =>
  state.wallets.paymentsMap.get(accountID, I.Map()).get(paymentID, makePayment())

export const getAccountInner = (state: Types.State, accountID: Types.AccountID) =>
  state.accountMap.get(accountID, unknownAccount)
export const getAccount = (state: TypedState, accountID: Types.AccountID) =>
  getAccountInner(state.wallets, accountID)

export const getDisplayCurrencyInner = (state: Types.State, accountID: Types.AccountID) =>
  getAccountInner(state, accountID).displayCurrency
export const getDisplayCurrency = (state: TypedState, accountID: Types.AccountID) =>
  getDisplayCurrencyInner(state.wallets, accountID)

export const getDefaultDisplayCurrencyInner = (state: Types.State) => {
  const defaultAccount = state.accountMap.find(a => a.isDefault)
  return defaultAccount ? defaultAccount.displayCurrency : unknownCurrency
}
export const getDefaultDisplayCurrency = (state: TypedState) => getDefaultDisplayCurrencyInner(state.wallets)

export const getDefaultAccountID = (state: TypedState) => {
  const defaultAccount = state.wallets.accountMap.find(a => a.isDefault)
  return defaultAccount ? defaultAccount.accountID : null
}

export const getInflationDestination = (state: TypedState, accountID: Types.AccountID) =>
  state.wallets.inflationDestinationMap.get(accountID, noAccountInflationDestination)

export const getAssets = (state: TypedState, accountID: Types.AccountID) =>
  state.wallets.assetsMap.get(accountID, I.List())

export const getFederatedAddress = (state: TypedState, accountID: Types.AccountID) => {
  const account = state.wallets.accountMap.get(accountID, unknownAccount)
  const {username} = state.config
  return username && account.isDefault ? `${username}*keybase.io` : ''
}

export const getSecretKey = (state: TypedState, accountID: Types.AccountID) =>
  accountID === state.wallets.exportedSecretKeyAccountID
    ? state.wallets.exportedSecretKey
    : new HiddenString('')

export const shortenAccountID = (id: Types.AccountID) => id.substring(0, 8) + '...' + id.substring(48)

export const isAccountLoaded = (state: TypedState, accountID: Types.AccountID) =>
  state.wallets.accountMap.has(accountID)

export const isFederatedAddress = (address: ?string) => (address ? address.includes('*') : false)

export const isPaymentUnread = (
  state: TypedState,
  accountID: Types.AccountID,
  paymentID: Types.PaymentID
) => {
  const newPaymentsForAccount = state.wallets.newPayments.get(accountID, false)
  return newPaymentsForAccount && newPaymentsForAccount.has(paymentID)
}

export const displayCurrenciesLoaded = (state: TypedState) => state.wallets.currencies.size > 0

export const getCurrencyAndSymbol = (state: TypedState, code: string) => {
  if (!state.wallets.currencies || !code) {
    return ''
  }
  const currency = state.wallets.currencies.find(c => c.code === code)
  return currency ? currency.description : code
}

export const getAcceptedDisclaimer = (state: TypedState) => state.wallets.acceptedDisclaimer

export const balanceChangeColor = (delta: Types.PaymentDelta, status: Types.StatusSimplified) => {
  let balanceChangeColor = Styles.globalColors.black_75
  if (delta !== 'none') {
    balanceChangeColor = delta === 'increase' ? Styles.globalColors.green : Styles.globalColors.purple
  }
  if (status !== 'completed') {
    balanceChangeColor = Styles.globalColors.black_20
  }
  return balanceChangeColor
}

export const balanceChangeSign = (delta: Types.PaymentDelta, balanceChange: string = '') => {
  let sign = ''
  if (delta !== 'none') {
    sign = delta === 'increase' ? '+ ' : '- '
  }
  return sign + balanceChange
}

export const rootWalletTab = isMobile ? Tabs.settingsTab : Tabs.walletsTab // tab for wallets
export const rootWalletPath = [rootWalletTab, ...(isMobile ? [SettingsConstants.walletsTab] : [])] // path to wallets
export const walletPath = isMobile ? rootWalletPath : [...rootWalletPath, 'wallet'] // path to wallet

const walletPathList = I.List(walletPath)
export const isLookingAtWallet = (routeState: ?RouteStateNode) => {
  const path = getPath(routeState, [rootWalletTab])
  return path.equals(walletPathList)
}
