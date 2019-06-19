import * as I from 'immutable'
import HiddenString from '../../util/hidden-string'
import * as StellarRPCTypes from './rpc-stellar-gen'

// When accepting the Stellar disclaimer, next path after acceptance
export type NextScreenAfterAcceptance = '' | 'linkExisting' | 'openWallet'

// Possible roles given an account and a
// transaction. senderAndReceiver means a transaction sending money
// from an account to itself.
export type Role = 'senderOnly' | 'receiverOnly' | 'senderAndReceiver' | 'none'

// Possible 'types' of things you can send or receive transactions with
export type CounterpartyType = 'keybaseUser' | 'stellarPublicKey' | 'otherAccount'

// Reserves held against an account's XLM balance
export type _Reserve = {
  amount: string
  description: string // e.g. 'account' or 'KEYZ/keybase.io trust line'
}
export type Reserve = I.RecordOf<_Reserve>

export type AccountID = string
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

export type PartnerUrl = StellarRPCTypes.PartnerUrl

// We treat PaymentIDs from the service as opaque
export type PaymentID = StellarRPCTypes.PaymentID
export const noPaymentID: PaymentID = 'NOPAYMENTID'
export const rpcPaymentIDToPaymentID = (id: StellarRPCTypes.PaymentID): PaymentID => id
export const paymentIDToRPCPaymentID = (id: PaymentID): StellarRPCTypes.PaymentID => id
export const paymentIDToString = (id: PaymentID): string => id
export const paymentIDIsEqual = (p1: PaymentID, p2: PaymentID) => p1 === p2

export type _Assets = {
  assetCode: string
  availableToSendWorth: string
  balanceAvailableToSend: string
  balanceTotal: string
  infoUrl: string
  infoUrlText: string
  issuerAccountID: string
  issuerName: string
  issuerVerifiedDomain: string
  name: string
  reserves: I.List<Reserve>
  worth: string
  worthCurrency: string
}

export type CurrencyCode = StellarRPCTypes.OutsideCurrencyCode

export type _LocalCurrency = {
  description: string
  code: CurrencyCode
  symbol: string
  name: string
}

export type _Building = {
  amount: string
  bid: string
  currency: string
  from: AccountID
  isRequest: boolean
  publicMemo: HiddenString
  recipientType: CounterpartyType
  secretNote: HiddenString
  sendAssetChoices: Array<StellarRPCTypes.SendAssetChoiceLocal> | null
  to: string
}

export type _BuiltPayment = {
  amountAvailable: string
  amountErrMsg: string
  builtBanners: Array<StellarRPCTypes.SendBannerLocal> | null
  from: AccountID
  publicMemoErrMsg: HiddenString
  readyToReview: boolean
  readyToSend: string
  secretNoteErrMsg: HiddenString
  toErrMsg: string
  worthAmount: string
  worthCurrency: string
  worthDescription: string
  worthInfo: string
  displayAmountXLM: string
  displayAmountFiat: string
  reviewBanners: Array<StellarRPCTypes.SendBannerLocal> | null
  sendingIntentionXLM: boolean
}

export type _BuiltRequest = {
  amountErrMsg: string
  builtBanners?: Array<StellarRPCTypes.SendBannerLocal> | null
  readyToRequest: boolean
  secretNoteErrMsg: HiddenString
  toErrMsg: string
  worthDescription: string
  worthInfo: string
  displayAmountXLM: string
  displayAmountFiat: string
  sendingIntentionXLM: boolean
}

export type StatusSimplified =
  | 'none'
  | 'pending'
  | 'claimable'
  | 'canceled'
  | 'completed'
  | 'error'
  | 'unknown'

export type PaymentDelta = 'none' | 'increase' | 'decrease'
export type PaymentSection = 'pending' | 'history' | 'none' // where does the payment go on the wallet screen

// The various payment types below are awkward, but they reflect the
// protocol. We can clean this up once
// https://keybase.atlassian.net/browse/CORE-9234 is fixed.

export type _PaymentCommon = {
  amountDescription: string
  delta: PaymentDelta
  error: string | null
  id: PaymentID
  note: HiddenString
  noteErr: HiddenString
  source: string
  sourceAccountID: string
  sourceAmount: string // this and sourceAsset are set if this was a path payment,
  sourceAsset: string // just code for now,
  sourceType: string
  statusSimplified: StatusSimplified
  statusDescription: string
  statusDetail: string
  showCancel: boolean
  target: string
  targetAccountID: string | null
  targetType: string
  time: number | null
  worth: string
  worthAtSendTime: string // for "(APPROXIMATELY $X.XX)" strings,
  // issuer, for non-xlm assets
  isAdvanced: boolean
  operations: Array<string> | null
  summaryAdvanced: string
  issuerDescription: string
  issuerAccountID: AccountID | null
}

export type _PaymentResult = {
  // Ideally the section field would be in _PaymentCommon. We can
  // derive it from statusDescription, which is either "pending",
  // "completed", or "error", or once
  // https://keybase.atlassian.net/browse/CORE-9234 is fixed there
  // might be a better way.
  section: PaymentSection
  unread: boolean
} & _PaymentCommon

export type _PaymentDetail = {
  externalTxURL: string
  publicMemo: HiddenString
  publicMemoType: string
  txID: string
  feeChargedDescription: string
} & _PaymentCommon

export type _Payment = {} & _PaymentResult & _PaymentDetail

export type _AssetDescription = {
  code: string
  issuerAccountID: AccountID
  issuerName: string
  issuerVerifiedDomain: string
}

export type AssetDescription = I.RecordOf<_AssetDescription>

export type Asset = 'native' | 'currency' | AssetDescription

export type Assets = I.RecordOf<_Assets>

export type BannerBackground = 'Announcements' | 'HighRisk' | 'Information'

export type Banner = {
  action?: () => void
  bannerBackground: BannerBackground
  bannerText: string
  reviewProofs?: boolean
  sendFailed?: boolean
}

export type Building = I.RecordOf<_Building>

export type BuiltPayment = I.RecordOf<_BuiltPayment>

export type BuiltRequest = I.RecordOf<_BuiltRequest>

export type PaymentResult = I.RecordOf<_PaymentResult>
export type PaymentDetail = I.RecordOf<_PaymentDetail>
export type Payment = I.RecordOf<_Payment>

export type Currency = I.RecordOf<_LocalCurrency>

export type _Account = {
  accountID: AccountID
  balanceDescription: string
  canSubmitTx: boolean
  deviceReadOnly: boolean
  displayCurrency: Currency
  isDefault: boolean
  mobileOnlyEditable: boolean
  name: string
}
export type Account = I.RecordOf<_Account>

export type _InflationDestination = {
  name: string
  recommended: boolean
  address: AccountID
  link: string
}
export type InflationDestination = I.RecordOf<_InflationDestination>

export type _AccountInflationDestination = {
  accountID: AccountID
  name: string // if known
}
export type AccountInflationDestination = I.RecordOf<_AccountInflationDestination>

export type ValidationState = 'none' | 'waiting' | 'error' | 'valid'

export type AirdropState = 'loading' | 'accepted' | 'qualified' | 'unqualified'
export type _AirdropQualification = {
  title: string
  subTitle: string
  valid: boolean
}
export type AirdropQualification = I.RecordOf<_AirdropQualification>

export type _AirdropDetailsLine = {
  bullet: boolean
  text: string
}
type AirdropDetailsLine = I.RecordOf<_AirdropDetailsLine>

export type _AirdropDetailsSection = {
  lines: I.List<AirdropDetailsLine>
  section: string
  icon: string
}
type AirdropDetailsSection = I.RecordOf<_AirdropDetailsSection>

export type _AirdropDetailsHeader = {
  body: string
  title: string
}
type AirdropDetailsHeader = I.RecordOf<_AirdropDetailsHeader>

export type _AirdropDetails = {
  header: AirdropDetailsHeader
  sections: I.List<AirdropDetailsSection>
}
export type AirdropDetails = I.RecordOf<_AirdropDetails>

export type _State = {
  acceptedDisclaimer: boolean
  acceptingDisclaimerDelay: boolean
  accountMap: I.OrderedMap<AccountID, Account>
  accountName: string
  accountNameError: string
  accountNameValidationState: ValidationState
  airdropDetails: AirdropDetails
  airdropQualifications: I.List<AirdropQualification>
  airdropShowBanner: boolean
  airdropState: AirdropState
  assetsMap: I.Map<AccountID, I.List<Assets>>
  buildCounter: number // increments when we call buildPayment / buildRequest,
  building: Building
  builtPayment: BuiltPayment
  builtRequest: BuiltRequest
  createNewAccountError: string
  currencies: I.List<Currency>
  externalPartners: I.List<PartnerUrl>
  exportedSecretKey: HiddenString
  exportedSecretKeyAccountID: AccountID
  inflationDestinations: I.List<InflationDestination>
  inflationDestinationMap: I.Map<AccountID, AccountInflationDestination>
  inflationDestinationError: string
  lastSentXLM: boolean
  linkExistingAccountError: string
  newPayments: I.Map<AccountID, I.Set<PaymentID>>
  paymentsMap: I.Map<AccountID, I.Map<PaymentID, Payment>>
  paymentCursorMap: I.Map<AccountID, StellarRPCTypes.PageCursor | null>
  paymentLoadingMoreMap: I.Map<AccountID, boolean>
  paymentOldestUnreadMap: I.Map<AccountID, PaymentID>
  reviewCounter: number // increments when we call reviewPayment,
  reviewLastSeqno: number | null // last UIPaymentReviewed.seqno received from the active review,
  secretKey: HiddenString
  secretKeyError: string
  secretKeyMap: I.Map<AccountID, HiddenString>
  secretKeyValidationState: ValidationState
  selectedAccount: AccountID
  sentPaymentError: string
  unreadPaymentsMap: I.Map<string, number>
  mobileOnlyMap: I.Map<AccountID, boolean>
}

export type State = I.RecordOf<_State>
