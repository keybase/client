// @flow strict
import * as I from 'immutable'
import HiddenString from '../../util/hidden-string'
import * as StellarRPCTypes from './rpc-stellar-gen'

// When accepting the Stellar disclaimer, next path after acceptance
export type NextScreenAfterAcceptance = 'linkExisting' | 'openWallet'

// Possible roles given an account and a
// transaction. senderAndReceiver means a transaction sending money
// from an account to itself.
export type Role = 'senderOnly' | 'receiverOnly' | 'senderAndReceiver'

// Possible 'types' of things you can send or receive transactions with
export type CounterpartyType = 'keybaseUser' | 'stellarPublicKey' | 'otherAccount'

// Reserves held against an account's XLM balance
export type _Reserve = {
  amount: string,
  description: string, // e.g. 'account' or 'KEYZ/keybase.io trust line'
}
export type Reserve = I.RecordOf<_Reserve>

export opaque type AccountID: string = string
export const stringToAccountID = __DEV__
  ? (s: string): AccountID => {
      if (!s) {
        throw new Error('Invalid empty AccountID. Did you mean Types.noAccountID?')
      }
      return s
    }
  : (s: string): AccountID => s

export const accountIDToString = (accountID: AccountID): string => accountID

// No account
export const noAccountID = stringToAccountID('NOACCOUNTID')

export const isValidAccountID = (accountID: AccountID) => accountID && accountID !== noAccountID

// We treat PaymentIDs from the service as opaque
export opaque type PaymentID = StellarRPCTypes.PaymentID
export const noPaymentID: PaymentID = 'NOPAYMENTID'
export const rpcPaymentIDToPaymentID = (id: StellarRPCTypes.PaymentID): PaymentID => id
export const paymentIDToRPCPaymentID = (id: PaymentID): StellarRPCTypes.PaymentID => id
export const paymentIDToString = (id: PaymentID): string => id
export const paymentIDIsEqual = (p1: PaymentID, p2: PaymentID) => p1 === p2

export type _Account = {
  accountID: AccountID,
  balanceDescription: string,
  isDefault: boolean,
  name: string,
}

export type _Assets = {
  assetCode: string,
  balanceAvailableToSend: string,
  balanceTotal: string,
  issuerAccountID: string,
  issuerName: string,
  issuerVerifiedDomain: string,
  name: string,
  worth: string,
  worthCurrency: string,
  availableToSendWorth: string,
  reserves: I.List<Reserve>,
}

export type CurrencyCode = StellarRPCTypes.OutsideCurrencyCode

export type _LocalCurrency = {
  description: string,
  code: CurrencyCode,
  symbol: string,
  name: string,
}

export type _Building = {
  amount: string,
  currency: string,
  from: AccountID,
  isRequest: boolean,
  publicMemo: HiddenString,
  recipientType: CounterpartyType,
  secretNote: HiddenString,
  sendAssetChoices: ?Array<StellarRPCTypes.SendAssetChoiceLocal>,
  to: string,
}

export type _BuiltPayment = {
  amountErrMsg: string,
  banners: ?Array<StellarRPCTypes.SendBannerLocal>,
  from: AccountID,
  publicMemoErrMsg: HiddenString,
  readyToSend: boolean,
  secretNoteErrMsg: HiddenString,
  toErrMsg: string,
  worthAmount: string,
  worthCurrency: string,
  worthDescription: string,
  worthInfo: string,
  displayAmountXLM: string,
  displayAmountFiat: string,
  sendingIntentionXLM: boolean,
}

export type _BuiltRequest = {
  amountErrMsg: string,
  banners?: ?Array<StellarRPCTypes.SendBannerLocal>,
  readyToRequest: boolean,
  secretNoteErrMsg: HiddenString,
  toErrMsg: string,
  worthDescription: string,
  worthInfo: string,
  displayAmountXLM: string,
  displayAmountFiat: string,
  sendingIntentionXLM: boolean,
}

export type StatusSimplified =
  | 'none'
  | 'pending'
  | 'cancelable'
  | 'canceled'
  | 'completed'
  | 'error'
  | 'unknown'

export type PaymentDelta = 'none' | 'increase' | 'decrease'
export type PaymentSection = 'pending' | 'history' | 'none' // where does the payment go on the wallet screen

// The various payment types below are awkward, but they reflect the
// protocol. We can clean this up once
// https://keybase.atlassian.net/browse/CORE-9234 is fixed.

export type _PaymentCommon = {|
  amountDescription: string,
  delta: PaymentDelta,
  error: ?string,
  id: PaymentID,
  note: HiddenString,
  noteErr: HiddenString,
  source: string,
  sourceAccountID: string,
  sourceType: string,
  statusSimplified: StatusSimplified,
  statusDescription: string,
  statusDetail: string,
  target: string,
  targetAccountID: ?string,
  targetType: string,
  time: ?number,
  worth: string,
  worthCurrency: string,
|}

export type _PaymentResult = {|
  ..._PaymentCommon,
  // Ideally the section field would be in _PaymentCommon. We can
  // derive it from statusDescription, which is either "pending",
  // "completed", or "error", or once
  // https://keybase.atlassian.net/browse/CORE-9234 is fixed there
  // might be a better way.
  section: PaymentSection,
  unread: boolean,
|}

export type _PaymentDetail = {|
  ..._PaymentCommon,
  externalTxURL: string,
  publicMemo: HiddenString,
  publicMemoType: string,
  txID: string,
|}

export type _Payment = {|..._PaymentResult, ..._PaymentDetail|}

export type _AssetDescription = {
  code: string,
  issuerAccountID: AccountID,
  issuerName: string,
  issuerVerifiedDomain: string,
}

export type AssetDescription = I.RecordOf<_AssetDescription>

export type Asset = 'native' | 'currency' | AssetDescription

export type _Request = {
  amount: string, // The number alone
  amountDescription: string, // The amount the request was made in (XLM, asset, or equivalent fiat) (i.e. '<number> <code>')
  asset: Asset,
  completed: boolean,
  completedTransactionID: ?StellarRPCTypes.KeybaseTransactionID,
  currencyCode: string, // set if asset === 'currency'
  id: StellarRPCTypes.KeybaseRequestID,
  requestee: string, // username or assertion
  requesteeType: string,
  sender: string,
  status: 'ok' | 'canceled',
}

export type Account = I.RecordOf<_Account>

export type Assets = I.RecordOf<_Assets>

export type BannerBackground = 'Announcements' | 'HighRisk' | 'Information'

export type Banner = {|
  bannerBackground: BannerBackground,
  bannerText: string,
|}

export type Building = I.RecordOf<_Building>

export type BuiltPayment = I.RecordOf<_BuiltPayment>

export type BuiltRequest = I.RecordOf<_BuiltRequest>

export type PaymentResult = I.RecordOf<_PaymentResult>
export type PaymentDetail = I.RecordOf<_PaymentDetail>
export type Payment = I.RecordOf<_Payment>

export type Currency = I.RecordOf<_LocalCurrency>
export type Request = I.RecordOf<_Request>

export type ValidationState = 'none' | 'waiting' | 'error' | 'valid'

export type _State = {
  acceptedDisclaimer: boolean,
  accountMap: I.OrderedMap<AccountID, Account>,
  accountName: string,
  accountNameError: string,
  accountNameValidationState: ValidationState,
  assetsMap: I.Map<AccountID, I.List<Assets>>,
  building: Building,
  builtPayment: BuiltPayment,
  builtRequest: BuiltRequest,
  createNewAccountError: string,
  currencies: I.List<Currency>,
  currencyMap: I.Map<AccountID, Currency>,
  exportedSecretKey: HiddenString,
  exportedSecretKeyAccountID: AccountID,
  lastSentXLM: boolean,
  linkExistingAccountError: string,
  newPayments: I.Map<AccountID, I.Set<PaymentID>>,
  paymentsMap: I.Map<AccountID, I.Map<PaymentID, Payment>>,
  paymentCursorMap: I.Map<AccountID, ?StellarRPCTypes.PageCursor>,
  paymentLoadingMoreMap: I.Map<AccountID, boolean>,
  paymentOldestUnreadMap: I.Map<AccountID, PaymentID>,
  requests: I.Map<StellarRPCTypes.KeybaseRequestID, Request>,
  secretKey: HiddenString,
  secretKeyError: string,
  secretKeyMap: I.Map<AccountID, HiddenString>,
  secretKeyValidationState: ValidationState,
  selectedAccount: AccountID,
  sentPaymentError: string,
  unreadPaymentsMap: I.Map<string, number>,
}

export type State = I.RecordOf<_State>
