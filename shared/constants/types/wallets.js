// @flow strict
// $FlowIssue https://github.com/facebook/flow/issues/6628
import * as I from 'immutable'
import HiddenString from '../../util/hidden-string'
import * as StellarRPCTypes from './rpc-stellar-gen'

// We treat PaymentIDs from the service as opaque
export const paymentIDIsEqual = (p1: StellarRPCTypes.PaymentID, p2: StellarRPCTypes.PaymentID) =>
  p1.txID === p2.txID

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
export type _BuildingPayment = {
  amount: string,
  currency: string,
  from: string,
  publicMemo: HiddenString,
  recipientType: ?CounterpartyType,
  secretNote: HiddenString,
  to: string,
}

export type _BuiltPayment = {
  amountErrMsg: string,
  banners: ?Array<StellarRPCTypes.SendBannerLocal>,
  from: string,
  publicMemoErrMsg: HiddenString,
  readyToSend: boolean,
  secretNoteErrMsg: HiddenString,
  toErrMsg: string,
  toUsername: string,
  worthDescription: string,
  worthInfo: string,
}

export type StatusSimplified = 'none' | 'pending' | 'claimable' | 'completed' | 'error' | 'unknown'

export type _Payment = {
  amountDescription: string,
  delta: 'none' | 'increase' | 'decrease',
  error: ?string,
  id: StellarRPCTypes.PaymentID,
  note: HiddenString,
  noteErr: HiddenString,
  publicMemo: HiddenString,
  publicMemoType: string,
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
  txID: string,
  worth: string,
  worthCurrency: string,
}

export type _AssetDescription = {
  code: string,
  issuerAccountID: AccountID,
  issuerName: ?string,
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

export type BuildingPayment = I.RecordOf<_BuildingPayment>

export type BuiltPayment = I.RecordOf<_BuiltPayment>

export type Payment = I.RecordOf<_Payment>

export type Currency = I.RecordOf<_LocalCurrency>
export type Request = I.RecordOf<_Request>

export type ValidationState = 'none' | 'waiting' | 'error' | 'valid'

export type _State = {
  accountMap: I.Map<AccountID, Account>,
  accountName: string,
  accountNameError: string,
  accountNameValidationState: ValidationState,
  buildingPayment: BuildingPayment,
  builtPayment: BuiltPayment,
  createNewAccountError: string,
  exportedSecretKey: HiddenString,
  exportedSecretKeyAccountID: AccountID,
  linkExistingAccountError: string,
  requests: I.Map<StellarRPCTypes.KeybaseRequestID, Request>,
  secretKey: HiddenString,
  secretKeyError: string,
  secretKeyValidationState: ValidationState,
  selectedAccount: AccountID,
  assetsMap: I.Map<AccountID, I.List<Assets>>,
  paymentsMap: I.Map<AccountID, I.List<Payment>>,
  pendingMap: I.Map<AccountID, I.List<Payment>>,
  secretKeyMap: I.Map<AccountID, HiddenString>,
  selectedAccount: AccountID,
  currencies: I.List<Currency>,
  currencyMap: I.Map<AccountID, Currency>,
}

export type State = I.RecordOf<_State>
