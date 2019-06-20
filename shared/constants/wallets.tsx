import * as I from 'immutable'
import * as Types from './types/wallets'
import * as RPCTypes from './types/rpc-stellar-gen'
import * as Styles from '../styles'
import {AllowedColors} from '../common-adapters/text'
import * as Tabs from './tabs'
import * as Flow from '../util/flow'
import * as SettingsConstants from './settings'
import {invert} from 'lodash-es'
import {TypedState} from './reducer'
import HiddenString from '../util/hidden-string'

export const balanceDeltaToString = invert(RPCTypes.BalanceDelta) as {
  [K in RPCTypes.BalanceDelta]: keyof typeof RPCTypes.BalanceDelta
}
export const statusSimplifiedToString = invert(RPCTypes.PaymentStatus) as {
  [K in RPCTypes.PaymentStatus]: keyof typeof RPCTypes.PaymentStatus
}
const partyTypeToString = invert(RPCTypes.ParticipantType) as {
  [K in RPCTypes.ParticipantType]: keyof typeof RPCTypes.ParticipantType
}

export const sendRequestFormRouteKey = 'sendReceiveForm'
export const chooseAssetFormRouteKey = 'chooseAssetForm'
export const confirmFormRouteKey = 'confirmForm'
export const sendRequestFormRoutes = [sendRequestFormRouteKey, confirmFormRouteKey]
export const airdropBannerKey = 'stellarHideAirdropBanner'

export const makeAirdropQualification = I.Record<Types._AirdropQualification>({
  subTitle: '',
  title: '',
  valid: false,
})

export const makeAirdropDetailsLine = I.Record<Types._AirdropDetailsLine>({
  bullet: false,
  text: '',
})

export const makeAirdropDetailsHeader = I.Record<Types._AirdropDetailsHeader>({
  body: '',
  title: '',
})

export const makeAirdropDetailsSection = I.Record<Types._AirdropDetailsSection>({
  icon: '',
  lines: I.List(),
  section: '',
})

export const makeAirdropDetails = I.Record<Types._AirdropDetails>({
  header: makeAirdropDetailsHeader({}),
  sections: I.List(),
})

export const makeInflationDestination = I.Record<Types._InflationDestination>({
  address: '',
  link: '',
  name: '',
  recommended: false,
})

export const makeAccountInflationDestination = I.Record<Types._AccountInflationDestination>({
  accountID: Types.noAccountID,
  name: '',
})
export const noAccountInflationDestination = makeAccountInflationDestination()

export const makeReserve = I.Record<Types._Reserve>({
  amount: '',
  description: '',
})

export const makeBuilding = I.Record<Types._Building>({
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

export const makeBuiltPayment = I.Record<Types._BuiltPayment>({
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

export const makeBuiltRequest = I.Record<Types._BuiltRequest>({
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

export const makeState = I.Record<Types._State>({
  acceptedDisclaimer: false,
  acceptingDisclaimerDelay: false,
  accountMap: I.OrderedMap(),
  accountName: '',
  accountNameError: '',
  accountNameValidationState: 'none',
  airdropDetails: makeAirdropDetails(),
  airdropQualifications: I.List(),
  airdropShowBanner: false,
  airdropState: 'loading',
  assetsMap: I.Map(),
  buildCounter: 0,
  building: makeBuilding(),
  builtPayment: makeBuiltPayment(),
  builtRequest: makeBuiltRequest(),
  createNewAccountError: '',
  currencies: I.List(),
  exportedSecretKey: new HiddenString(''),
  exportedSecretKeyAccountID: Types.noAccountID,
  externalPartners: I.List(),
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
    from: b.from ? Types.stringToAccountID(b.from) : Types.noAccountID,
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
    balanceDescription: w.balanceDescription,
    canSubmitTx: w.canSubmitTx,
    deviceReadOnly: w.deviceReadOnly,
    displayCurrency: currencyResultToCurrency(w.currencyLocal),
    isDefault: w.isDefault,
    mobileOnlyEditable: w.accountModeEditable,
    name: w.name,
  })

export const makeAssets = I.Record<Types._Assets>({
  assetCode: '',
  availableToSendWorth: '',
  balanceAvailableToSend: '',
  balanceTotal: '',
  infoUrl: '',
  infoUrlText: '',
  issuerAccountID: '',
  issuerName: '',
  issuerVerifiedDomain: '',
  name: '',
  reserves: I.List(),
  worth: '',
  worthCurrency: '',
})

export const assetsResultToAssets = (w: RPCTypes.AccountAssetLocal) =>
  makeAssets({
    assetCode: w.assetCode,
    availableToSendWorth: w.availableToSendWorth,
    balanceAvailableToSend: w.balanceAvailableToSend,
    balanceTotal: w.balanceTotal,
    infoUrl: w.infoUrl,
    infoUrlText: w.infoUrlText,
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
  delta: 'none' as Types.PaymentDelta,
  error: '',
  id: Types.noPaymentID,
  isAdvanced: false,
  issuerAccountID: null,
  issuerDescription: '',
  note: new HiddenString(''),
  noteErr: new HiddenString(''),
  operations: [],
  showCancel: false,
  source: '',
  sourceAccountID: '',
  sourceAmount: '',
  sourceAsset: '',
  sourceType: '',
  statusDescription: '',
  statusDetail: '',
  statusSimplified: 'none' as Types.StatusSimplified,
  summaryAdvanced: '',
  target: '',
  targetAccountID: '',
  targetType: '',
  time: null,
  worth: '',
  worthAtSendTime: '',
}

const _defaultPaymentResult = {
  ..._defaultPaymentCommon,
  section: 'none' as Types.PaymentSection,
  unread: false,
}

const _defaultPaymentDetail = {
  ..._defaultPaymentCommon,
  externalTxURL: '',
  feeChargedDescription: '',
  publicMemo: new HiddenString(''),
  publicMemoType: '',
  txID: '',
}

const _defaultPayment = {
  ..._defaultPaymentResult,
  ..._defaultPaymentDetail,
}

export const makePaymentResult = I.Record<Types._PaymentResult>(_defaultPaymentResult)

export const makePaymentDetail = I.Record<Types._PaymentDetail>(_defaultPaymentDetail)

export const makePayment = I.Record<Types._Payment>(_defaultPayment)

export const makeCurrency = I.Record<Types._LocalCurrency>({
  code: '',
  description: '',
  name: '',
  symbol: '',
})
export const unknownCurrency = makeCurrency()

export const makeAccount = I.Record<Types._Account>({
  accountID: Types.noAccountID,
  balanceDescription: '',
  canSubmitTx: false,
  deviceReadOnly: false,
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
    feeChargedDescription: p.feeChargedDescription,
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
    isAdvanced: p.isAdvanced,
    issuerAccountID: p.issuerAccountID ? Types.stringToAccountID(p.issuerAccountID) : null,
    issuerDescription: p.issuerDescription,
    note: new HiddenString(p.note),
    noteErr: new HiddenString(p.noteErr),
    operations: p.operations,
    showCancel: p.showCancel,
    source,
    sourceAccountID: p.fromAccountID,
    sourceAmount: p.sourceAmountActual,
    sourceAsset: p.sourceAsset.code,
    sourceType,
    statusDescription: p.statusDescription,
    statusDetail: p.statusDetail,
    statusSimplified: serviceStatusSimplfied,
    summaryAdvanced: p.summaryAdvanced,
    target,
    targetAccountID: p.toAccountID,
    targetType,
    time: p.time,
    worth: p.worth,
    worthAtSendTime: p.worthAtSendTime,
  }
}

export const makeAssetDescription = I.Record<Types._AssetDescription>({
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
  yourAccountName: string
  yourRole: Types.Role
  counterparty: string
  counterpartyType: Types.CounterpartyType
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
        return {
          counterparty: '',
          counterpartyType: 'stellarPublicKey',
          yourAccountName: '',
          yourRole: 'none',
        }
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
    name: res.knownDestination ? res.knownDestination.name : undefined,
  })
}

export const airdropWaitingKey = 'wallets:airdrop'
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

export const getSelectedAccountData = (state: TypedState) =>
  state.wallets.accountMap.get(getSelectedAccount(state), unknownAccount)

export const getDisplayCurrencies = (state: TypedState) => state.wallets.currencies

export const getPayments = (state: TypedState, accountID: Types.AccountID) =>
  state.wallets.paymentsMap.get(accountID, null)

export const getOldestUnread = (state: TypedState, accountID: Types.AccountID) =>
  state.wallets.paymentOldestUnreadMap.get(accountID, Types.noPaymentID)

export const getPayment = (state: TypedState, accountID: Types.AccountID, paymentID: Types.PaymentID) =>
  // @ts-ignore codemod issue
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

export const getExternalPartners = (state: TypedState, accountID: Types.AccountID) =>
  state.wallets.externalPartners

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

export const isFederatedAddress = (address: string | null) => (address ? address.includes('*') : false)

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

export const getBalanceChangeColor = (delta: Types.PaymentDelta, status: Types.StatusSimplified) => {
  let balanceChangeColor: AllowedColors = Styles.globalColors.black
  if (delta !== 'none') {
    balanceChangeColor = delta === 'increase' ? Styles.globalColors.greenDark : Styles.globalColors.purpleDark
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

export const rootWalletTab = Styles.isMobile ? Tabs.settingsTab : Tabs.walletsTab // tab for wallets
export const rootWalletPath = [rootWalletTab, ...(Styles.isMobile ? [SettingsConstants.walletsTab] : [])] // path to wallets
export const walletPath = Styles.isMobile ? rootWalletPath : [...rootWalletPath, 'wallet'] // path to wallet
