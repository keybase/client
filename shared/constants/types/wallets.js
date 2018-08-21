// @flow strict
// $FlowIssue https://github.com/facebook/flow/issues/6628
import * as I from 'immutable'
import HiddenString from '../../util/hidden-string'
import * as StellarRPCTypes from './rpc-stellar-gen'

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
        throw new Error('Invalid empty AccountID. Did you mean Constants.noAccountID?')
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
  sourceType: string,
  statusSimplified: StatusSimplified,
  statusDescription: string,
  statusDetail: string,
  target: string,
  targetType: string,
  time: number,
  txID: string,
  worth: string,
  worthCurrency: string,
}

export type Account = I.RecordOf<_Account>

export type Assets = I.RecordOf<_Assets>

export type BuildingPayment = I.RecordOf<_BuildingPayment>

export type BuiltPayment = I.RecordOf<_BuiltPayment>

export type Payment = I.RecordOf<_Payment>

export type ValidationState = 'none' | 'waiting' | 'error' | 'valid'

export type _State = {
  accountMap: I.Map<AccountID, Account>,
  accountName: string,
  accountNameError: string,
  accountNameValidationState: ValidationState,
  buildingPayment: BuildingPayment,
  builtPayment: BuiltPayment,
  exportedSecretKey: HiddenString,
  linkExistingAccountError: string,
  secretKey: HiddenString,
  secretKeyError: string,
  secretKeyValidationState: ValidationState,
  selectedAccount: AccountID,
  assetsMap: I.Map<AccountID, I.List<Assets>>,
  paymentsMap: I.Map<AccountID, I.List<Payment>>,
  pendingMap: I.Map<AccountID, I.List<Payment>>,
  secretKeyMap: I.Map<AccountID, HiddenString>,
  selectedAccount: AccountID,
}

export type State = I.RecordOf<_State>
