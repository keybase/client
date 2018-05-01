// @flow
import * as I from 'immutable'

// An asset that is held by a wallet
export type _Asset = {
  balance: string,
  code: string, // Up to 12-character e.g. BTC, BOFAUSD
  domain: string, // Verified federation name, empty if unverified
  issuer: string, // Public key of issuing account
}
export type Asset = I.RecordOf<_Asset>

// Reserves held against a wallet's XLM balance
export type _Reserve = {
  amount: string,
  description: string, // e.g. 'account' or 'XLM/Stellar.org trust line'
}
export type Reserve = I.RecordOf<_Reserve>

export type _State = {
  hello: string,
}
export type State = I.RecordOf<_State>
