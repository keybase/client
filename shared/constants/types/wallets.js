// @flow
import * as I from 'immutable'
import * as RPCTypes from './rpc-stellar-gen'

// Reserves held against an account's XLM balance
export type _Reserve = {
  amount: string,
  description: string, // e.g. 'account' or 'KEYZ/keybase.io trust line'
}
export type Reserve = I.RecordOf<_Reserve>

export type _State = {
  assetsMap: any,
  walletMap: any,
}
export type State = I.RecordOf<_State>

export type _Wallet = RPCTypes.WalletAccountLocal

export type _Assets = AccountAssetLocal

export type Wallet = I.RecordOf<_Wallet>
