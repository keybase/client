import type * as StellarRPCTypes from './rpc-stellar-gen'

export type Reserve = {
  amount: string
  description: string // e.g. 'account' or 'KEYZ/keybase.io trust line'
}

export type AccountID = string
export const noAccountID = 'NOACCOUNTID'
export type PaymentID = StellarRPCTypes.PaymentID
export const noPaymentID: PaymentID = 'NOPAYMENTID'

export type StatusSimplified =
  | 'none'
  | 'pending'
  | 'claimable'
  | 'canceled'
  | 'completed'
  | 'error'
  | 'unknown'

export type AssetDescription = {
  code: string
  depositButtonText: string
  infoUrl: string
  infoUrlText: string
  issuerAccountID: AccountID
  issuerName: string
  issuerVerifiedDomain: string
  showDepositButton: boolean
  showWithdrawButton: boolean
  withdrawButtonText: string
}

export type Asset = 'native' | 'currency' | AssetDescription
