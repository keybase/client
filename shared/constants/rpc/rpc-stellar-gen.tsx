/* eslint-disable */

// This file is auto-generated. Run `yarn gen:protocol` to regenerate it.
import {getCallPort} from '@/engine/call-port'
import * as Keybase1 from './rpc-gen'
export {Keybase1}
import type {WaitingKeys} from '@/constants/waiting-key-type'
type SimpleError = {code?: number, desc?: string}
export type IncomingErrorCallback = (err?: SimpleError | null) => void



export type MessageTypes = {
  'stellar.1.local.deleteWalletAccountLocal': {
    inParam: {readonly accountID: AccountID,readonly userAcknowledged: string},
    outParam: void,
  },
  'stellar.1.local.getWalletAccountSecretKeyLocal': {
    inParam: {readonly accountID: AccountID},
    outParam: SecretKey,
  },
  'stellar.1.local.getWalletAccountsLocal': {
    inParam: undefined,
    outParam: ReadonlyArray<WalletAccountLocal> | null,
  },
  'stellar.1.local.hasAcceptedDisclaimerLocal': {
    inParam: undefined,
    outParam: boolean,
  },
}
export type MessageKey = keyof MessageTypes
export type RpcIn<M extends MessageKey> = MessageTypes[M]['inParam']
export type RpcOut<M extends MessageKey> = MessageTypes[M]['outParam']
export type RpcResponse<M extends MessageKey> = {error: IncomingErrorCallback, result: (res: RpcOut<M>) => void}
type PromiseMethod = 'stellar.1.local.deleteWalletAccountLocal' | 'stellar.1.local.getWalletAccountSecretKeyLocal' | 'stellar.1.local.getWalletAccountsLocal' | 'stellar.1.local.hasAcceptedDisclaimerLocal'
// method names the call for cache keys. An aborted signal cancels the call client-side.
export type RpcFn<M extends PromiseMethod> = {readonly method: M} & ([RpcIn<M>] extends [undefined]
  ? (params?: undefined, waitingKey?: WaitingKeys, signal?: AbortSignal) => Promise<RpcOut<M>>
  : (params: RpcIn<M>, waitingKey?: WaitingKeys, signal?: AbortSignal) => Promise<RpcOut<M>>)
const createRpc = <M extends PromiseMethod>(method: M): RpcFn<M> =>
  Object.assign(
    (params?: RpcIn<M>, waitingKey?: WaitingKeys, signal?: AbortSignal) =>
      new Promise<RpcOut<M>>((resolve, reject) => {
        const port = getCallPort()
        const sessionID = port.call({
          method,
          params,
          callback: (error: SimpleError, result: RpcOut<M>) => error ? reject(error) : resolve(result),
          waitingKey,
        })
        const cancel = () => port.cancelSession(sessionID)
        if (signal?.aborted) {
          cancel()
        } else {
          signal?.addEventListener('abort', cancel, {once: true})
        }
      }),
    {method}
  ) as RpcFn<M>

export enum AccountBundleVersion {
  v1 = 1,
  v2 = 2,
  v3 = 3,
  v4 = 4,
  v5 = 5,
  v6 = 6,
  v7 = 7,
  v8 = 8,
  v9 = 9,
  v10 = 10,
}

export enum AccountMode {
  none = 0,
  user = 1,
  mobile = 2,
}

export enum BalanceDelta {
  none = 0,
  increase = 1,
  decrease = 2,
}

export enum BundleVersion {
  v1 = 1,
  v2 = 2,
  v3 = 3,
  v4 = 4,
  v5 = 5,
  v6 = 6,
  v7 = 7,
  v8 = 8,
  v9 = 9,
  v10 = 10,
}

export enum PaymentStatus {
  none = 0,
  pending = 1,
  claimable = 2,
  completed = 3,
  error = 4,
  unknown = 5,
}

export enum RequestStatus {
  ok = 0,
  canceled = 1,
  done = 2,
}
export type AccountBundle = {readonly prev: Hash,readonly ownHash: Hash,readonly accountID: AccountID,readonly signers?: ReadonlyArray<SecretKey> | null,}
export type AccountBundleSecretUnsupported = {}
export type AccountBundleSecretV1 = {readonly accountID: AccountID,readonly signers?: ReadonlyArray<SecretKey> | null,}
export type AccountBundleSecretVersioned ={ version: AccountBundleVersion.v1, v1: AccountBundleSecretV1 } | { version: AccountBundleVersion.v2, v2: AccountBundleSecretUnsupported } | { version: AccountBundleVersion.v3, v3: AccountBundleSecretUnsupported } | { version: AccountBundleVersion.v4, v4: AccountBundleSecretUnsupported } | { version: AccountBundleVersion.v5, v5: AccountBundleSecretUnsupported } | { version: AccountBundleVersion.v6, v6: AccountBundleSecretUnsupported } | { version: AccountBundleVersion.v7, v7: AccountBundleSecretUnsupported } | { version: AccountBundleVersion.v8, v8: AccountBundleSecretUnsupported } | { version: AccountBundleVersion.v9, v9: AccountBundleSecretUnsupported } | { version: AccountBundleVersion.v10, v10: AccountBundleSecretUnsupported }
export type AccountID = string
export type Asset = {readonly type: string,readonly code: string,readonly issuer: string,readonly verifiedDomain: string,readonly issuerName: string,readonly desc: string,readonly infoUrl: string,readonly infoUrlText: string,readonly showDepositButton: boolean,readonly depositButtonText: string,readonly showWithdrawButton: boolean,readonly withdrawButtonText: string,readonly withdrawType: string,readonly transferServer: string,readonly authEndpoint: string,readonly depositReqAuth: boolean,readonly withdrawReqAuth: boolean,readonly useSep24: boolean,}
export type Balance = {readonly asset: Asset,readonly amount: string,readonly limit: string,readonly isAuthorized: boolean,}
export type Bundle = {readonly revision: BundleRevision,readonly prev: Hash,readonly ownHash: Hash,readonly accounts?: ReadonlyArray<BundleEntry> | null,readonly accountBundles?: {[key: string]: AccountBundle} | null,}
export type BundleEntry = {readonly accountID: AccountID,readonly mode: AccountMode,readonly isPrimary: boolean,readonly name: string,readonly acctBundleRevision: BundleRevision,readonly encAcctBundleHash: Hash,}
export type BundleRevision = number
export type BundleSecretEntryV2 = {readonly accountID: AccountID,readonly name: string,}
export type BundleSecretUnsupported = {}
export type BundleSecretV2 = {readonly visibleHash: Hash,readonly accounts?: ReadonlyArray<BundleSecretEntryV2> | null,}
export type BundleSecretVersioned ={ version: BundleVersion.v1, v1: BundleSecretUnsupported } | { version: BundleVersion.v2, v2: BundleSecretV2 } | { version: BundleVersion.v3, v3: BundleSecretUnsupported } | { version: BundleVersion.v4, v4: BundleSecretUnsupported } | { version: BundleVersion.v5, v5: BundleSecretUnsupported } | { version: BundleVersion.v6, v6: BundleSecretUnsupported } | { version: BundleVersion.v7, v7: BundleSecretUnsupported } | { version: BundleVersion.v8, v8: BundleSecretUnsupported } | { version: BundleVersion.v9, v9: BundleSecretUnsupported } | { version: BundleVersion.v10, v10: BundleSecretUnsupported }
export type BundleVisibleEntryV2 = {readonly accountID: AccountID,readonly mode: AccountMode,readonly isPrimary: boolean,readonly acctBundleRevision: BundleRevision,readonly encAcctBundleHash: Hash,}
export type BundleVisibleV2 = {readonly revision: BundleRevision,readonly prev: Hash,readonly accounts?: ReadonlyArray<BundleVisibleEntryV2> | null,}
export type CurrencyLocal = {readonly description: string,readonly code: OutsideCurrencyCode,readonly symbol: string,readonly name: string,}
export type EncryptedAccountBundle = {readonly v: number,readonly e: Uint8Array,readonly n: Keybase1.BoxNonce,readonly gen: Keybase1.PerUserKeyGeneration,}
export type EncryptedBundle = {readonly v: number,readonly e: Uint8Array,readonly n: Keybase1.BoxNonce,readonly gen: Keybase1.PerUserKeyGeneration,}
export type Hash = Uint8Array
export type KeybaseRequestID = string
export type OutsideCurrencyCode = string
export type PaymentID = string
export type SecretKey = string
export type TransactionID = string
export type WalletAccountLocal = {readonly accountID: AccountID,readonly isDefault: boolean,readonly name: string,readonly balanceDescription: string,readonly seqno: string,readonly currencyLocal: CurrencyLocal,readonly accountMode: AccountMode,readonly accountModeEditable: boolean,readonly deviceReadOnly: boolean,readonly isFunded: boolean,readonly canSubmitTx: boolean,readonly canAddTrustline: boolean,}

type IncomingMethod = never
export type IncomingCallMapType = Partial<{[M in IncomingMethod]: (params: RpcIn<M>) => void}>

type CustomIncomingMethod = never
export type CustomResponseIncomingCallMap = Partial<{[M in CustomIncomingMethod]: (params: RpcIn<M>, response: RpcResponse<M>) => void}>
export const localDeleteWalletAccountLocalRpcPromise = createRpc('stellar.1.local.deleteWalletAccountLocal')
export const localGetWalletAccountSecretKeyLocalRpcPromise = createRpc('stellar.1.local.getWalletAccountSecretKeyLocal')
export const localGetWalletAccountsLocalRpcPromise = createRpc('stellar.1.local.getWalletAccountsLocal')
export const localHasAcceptedDisclaimerLocalRpcPromise = createRpc('stellar.1.local.hasAcceptedDisclaimerLocal')
// Not enabled calls. To enable add to enabled-calls.json:
// 'stellar.1.local.exportSecretKeyLocal'
// 'stellar.1.remote.balances'