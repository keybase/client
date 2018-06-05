// @flow
import * as I from 'immutable'

// Reserves held against an account's XLM balance
export type _Reserve = {
  amount: string,
  description: string, // e.g. 'account' or 'KEYZ/keybase.io trust line'
}
export type Reserve = I.RecordOf<_Reserve>

export type _State = {
  accountMap: any,
  assetsMap: any,
  paymentsMap: any,
}
export type State = I.RecordOf<_State>

export type _Account = {
  accountID: string,
  balanceDescription: string,
  isDefault: boolean,
  name: string,
}

export type _Assets = {
  assetCode: string,
  balanceAvailableToSend: string,
  balanceTotal: string,
  issuer: string,
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
