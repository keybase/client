// @flow
import * as I from 'immutable'

// Reserves held against an account's XLM balance
export type _Reserve = {
  amount: string,
  description: string, // e.g. 'account' or 'KEYZ/keybase.io trust line'
}
export type Reserve = I.RecordOf<_Reserve>

export type _State = {
  hello: string,
}
export type State = I.RecordOf<_State>

export type _WalletMeta = {

}
export type WalletMeta = I.RecordOf<_WalletMeta>