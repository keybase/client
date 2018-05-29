// @flow
import * as I from 'immutable'

// Reserves held against an account's XLM balance
export type _Reserve = {
  amount: string,
  description: string, // e.g. 'account' or 'KEYZ/keybase.io trust line'
}
export type Reserve = I.RecordOf<_Reserve>

export type _State = {
  walletMap: any,
}
export type State = I.RecordOf<_State>

export type _Wallet = {
  accountID: string,
  balanceDescription: string,
  isDefault: false,
  name: string,
}
export type Wallet = I.RecordOf<_Wallet>
