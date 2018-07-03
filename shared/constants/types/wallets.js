// @flow
import * as I from 'immutable'

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
        throw new Error('Invalid empty converationidkey. Did you mean Constants.noConversationIDKey?')
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
}

export type _Payment = {
  amountDescription: string,
  delta: 'none' | 'increase' | 'decrease',
  error: ?string,
  id: string,
  note: string,
  noteErr: string,
  source: string,
  sourceType: string,
  statusSimplified: 'none' | 'pending' | 'claimable' | 'completed' | 'error' | 'unknown',
  statusDescription: string,
  statusDetail: string,
  target: string,
  targetType: string,
  time: number,
  worth: string,
  worthCurrency: string,
}

export type Account = I.RecordOf<_Account>

export type Assets = I.RecordOf<_Assets>

export type Payment = I.RecordOf<_Payment>
type ValidationState = 'none' | 'waiting' | 'error' | 'valid'
export type _State = {
  accountMap: I.Map<AccountID, Account>,
  accountNameError: string,
  accountNameValidationState: ValidationState,
  secretKeyError: string,
  secretKeyValidationState: ValidationState,
  selectedAccount: AccountID,
  assetsMap: I.Map<AccountID, I.List<Assets>>,
  paymentsMap: I.Map<AccountID, I.List<Payment>>,
}
export type State = I.RecordOf<_State>
