/* eslint-disable */

// This file is auto-generated. Run `yarn update-protocol` to regenerate it.
import {getEngine as engine} from '@/engine/require'
import * as Keybase1 from './rpc-gen'
export {Keybase1}
type WaitingKey = string | ReadonlyArray<string>
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
export type RpcFn<M extends PromiseMethod> = [RpcIn<M>] extends [undefined]
  ? (params?: undefined, waitingKey?: WaitingKey) => Promise<RpcOut<M>>
  : (params: RpcIn<M>, waitingKey?: WaitingKey) => Promise<RpcOut<M>>
const createRpc = <M extends PromiseMethod>(method: M): RpcFn<M> =>
  ((params?: RpcIn<M>, waitingKey?: WaitingKey) =>
    new Promise<RpcOut<M>>((resolve, reject) =>
      engine()._rpcOutgoing({
        method,
        params,
        callback: (error: SimpleError, result: RpcOut<M>) => error ? reject(error) : resolve(result),
        waitingKey,
      }))) as RpcFn<M>

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

export enum AdvancedBanner {
  noBanner = 0,
  senderBanner = 1,
  receiverBanner = 2,
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

export enum ParticipantType {
  none = 0,
  keybase = 1,
  stellar = 2,
  sbs = 3,
  ownaccount = 4,
}

export enum PaymentStatus {
  none = 0,
  pending = 1,
  claimable = 2,
  completed = 3,
  error = 4,
  unknown = 5,
  canceled = 6,
}

export enum PaymentStrategy {
  none = 0,
  direct = 1,
  relay = 2,
}

export enum PaymentSummaryType {
  none = 0,
  stellar = 1,
  direct = 2,
  relay = 3,
}

export enum PublicNoteType {
  none = 0,
  text = 1,
  id = 2,
  hash = 3,
  return = 4,
}

export enum RelayDirection {
  claim = 0,
  yank = 1,
}

export enum RequestStatus {
  ok = 0,
  canceled = 1,
  done = 2,
}

export enum TransactionStatus {
  none = 0,
  pending = 1,
  success = 2,
  errorTransient = 3,
  errorPermanent = 4,
}
export type AccountAssetLocal = {readonly name: string,readonly assetCode: string,readonly issuerName: string,readonly issuerAccountID: string,readonly issuerVerifiedDomain: string,readonly balanceTotal: string,readonly balanceAvailableToSend: string,readonly worthCurrency: string,readonly worth: string,readonly availableToSendWorth: string,readonly reserves?: ReadonlyArray<AccountReserve> | null,readonly desc: string,readonly infoUrl: string,readonly infoUrlText: string,readonly showDepositButton: boolean,readonly depositButtonText: string,readonly showWithdrawButton: boolean,readonly withdrawButtonText: string,}
export type AccountBundle = {readonly prev: Hash,readonly ownHash: Hash,readonly accountID: AccountID,readonly signers?: ReadonlyArray<SecretKey> | null,}
export type AccountBundleSecretUnsupported = {}
export type AccountBundleSecretV1 = {readonly accountID: AccountID,readonly signers?: ReadonlyArray<SecretKey> | null,}
export type AccountBundleSecretVersioned ={ version: AccountBundleVersion.v1, v1: AccountBundleSecretV1 } | { version: AccountBundleVersion.v2, v2: AccountBundleSecretUnsupported } | { version: AccountBundleVersion.v3, v3: AccountBundleSecretUnsupported } | { version: AccountBundleVersion.v4, v4: AccountBundleSecretUnsupported } | { version: AccountBundleVersion.v5, v5: AccountBundleSecretUnsupported } | { version: AccountBundleVersion.v6, v6: AccountBundleSecretUnsupported } | { version: AccountBundleVersion.v7, v7: AccountBundleSecretUnsupported } | { version: AccountBundleVersion.v8, v8: AccountBundleSecretUnsupported } | { version: AccountBundleVersion.v9, v9: AccountBundleSecretUnsupported } | { version: AccountBundleVersion.v10, v10: AccountBundleSecretUnsupported }
export type AccountDetails = {readonly accountID: AccountID,readonly seqno: string,readonly balances?: ReadonlyArray<Balance> | null,readonly subentryCount: number,readonly available: string,readonly reserves?: ReadonlyArray<AccountReserve> | null,readonly readTransactionID?: TransactionID | null,readonly unreadPayments: number,readonly displayCurrency: string,readonly inflationDestination?: AccountID | null,}
export type AccountID = string
export type AccountReserve = {readonly amount: string,readonly description: string,}
export type AirdropDetails = {readonly isPromoted: boolean,readonly details: string,readonly disclaimer: string,}
export type AirdropQualification = {readonly title: string,readonly subtitle: string,readonly valid: boolean,}
export type AirdropState = string
export type AirdropStatus = {readonly state: AirdropState,readonly rows?: ReadonlyArray<AirdropQualification> | null,}
export type Asset = {readonly type: string,readonly code: string,readonly issuer: string,readonly verifiedDomain: string,readonly issuerName: string,readonly desc: string,readonly infoUrl: string,readonly infoUrlText: string,readonly showDepositButton: boolean,readonly depositButtonText: string,readonly showWithdrawButton: boolean,readonly withdrawButtonText: string,readonly withdrawType: string,readonly transferServer: string,readonly authEndpoint: string,readonly depositReqAuth: boolean,readonly withdrawReqAuth: boolean,readonly useSep24: boolean,}
export type AssetActionResultLocal = {readonly externalUrl?: string | null,readonly messageFromAnchor?: string | null,}
export type AssetCode = string
export type AssetListResult = {readonly assets?: ReadonlyArray<Asset> | null,readonly totalCount: number,}
export type AutoClaim = {readonly kbTxID: KeybaseTransactionID,}
export type Balance = {readonly asset: Asset,readonly amount: string,readonly limit: string,readonly isAuthorized: boolean,}
export type BatchPaymentArg = {readonly recipient: string,readonly amount: string,readonly message: string,}
export type BatchPaymentError = {readonly message: string,readonly code: number,}
export type BatchPaymentResult = {readonly username: string,readonly startTime: TimeMs,readonly submittedTime: TimeMs,readonly endTime: TimeMs,readonly txID: TransactionID,readonly status: PaymentStatus,readonly statusDescription: string,readonly error?: BatchPaymentError | null,}
export type BatchResultLocal = {readonly startTime: TimeMs,readonly preparedTime: TimeMs,readonly allSubmittedTime: TimeMs,readonly allCompleteTime: TimeMs,readonly endTime: TimeMs,readonly payments?: ReadonlyArray<BatchPaymentResult> | null,readonly overallDurationMs: TimeMs,readonly prepareDurationMs: TimeMs,readonly submitDurationMs: TimeMs,readonly waitPaymentsDurationMs: TimeMs,readonly waitChatDurationMs: TimeMs,readonly countSuccess: number,readonly countDirect: number,readonly countRelay: number,readonly countError: number,readonly countPending: number,readonly avgDurationMs: TimeMs,readonly avgSuccessDurationMs: TimeMs,readonly avgDirectDurationMs: TimeMs,readonly avgRelayDurationMs: TimeMs,readonly avgErrorDurationMs: TimeMs,}
export type BuildPaymentID = string
export type BuildPaymentResLocal = {readonly readyToReview: boolean,readonly from: AccountID,readonly toErrMsg: string,readonly amountErrMsg: string,readonly secretNoteErrMsg: string,readonly publicMemoErrMsg: string,readonly publicMemoOverride: string,readonly worthDescription: string,readonly worthInfo: string,readonly worthAmount: string,readonly worthCurrency: string,readonly displayAmountXLM: string,readonly displayAmountFiat: string,readonly sendingIntentionXLM: boolean,readonly amountAvailable: string,readonly banners?: ReadonlyArray<SendBannerLocal> | null,}
export type BuildRequestResLocal = {readonly readyToRequest: boolean,readonly toErrMsg: string,readonly amountErrMsg: string,readonly secretNoteErrMsg: string,readonly worthDescription: string,readonly worthInfo: string,readonly displayAmountXLM: string,readonly displayAmountFiat: string,readonly sendingIntentionXLM: boolean,readonly banners?: ReadonlyArray<SendBannerLocal> | null,}
export type Bundle = {readonly revision: BundleRevision,readonly prev: Hash,readonly ownHash: Hash,readonly accounts?: ReadonlyArray<BundleEntry> | null,readonly accountBundles?: {[key: string]: AccountBundle} | null,}
export type BundleEntry = {readonly accountID: AccountID,readonly mode: AccountMode,readonly isPrimary: boolean,readonly name: string,readonly acctBundleRevision: BundleRevision,readonly encAcctBundleHash: Hash,}
export type BundleRevision = number
export type BundleSecretEntryV2 = {readonly accountID: AccountID,readonly name: string,}
export type BundleSecretUnsupported = {}
export type BundleSecretV2 = {readonly visibleHash: Hash,readonly accounts?: ReadonlyArray<BundleSecretEntryV2> | null,}
export type BundleSecretVersioned ={ version: BundleVersion.v1, v1: BundleSecretUnsupported } | { version: BundleVersion.v2, v2: BundleSecretV2 } | { version: BundleVersion.v3, v3: BundleSecretUnsupported } | { version: BundleVersion.v4, v4: BundleSecretUnsupported } | { version: BundleVersion.v5, v5: BundleSecretUnsupported } | { version: BundleVersion.v6, v6: BundleSecretUnsupported } | { version: BundleVersion.v7, v7: BundleSecretUnsupported } | { version: BundleVersion.v8, v8: BundleSecretUnsupported } | { version: BundleVersion.v9, v9: BundleSecretUnsupported } | { version: BundleVersion.v10, v10: BundleSecretUnsupported }
export type BundleVisibleEntryV2 = {readonly accountID: AccountID,readonly mode: AccountMode,readonly isPrimary: boolean,readonly acctBundleRevision: BundleRevision,readonly encAcctBundleHash: Hash,}
export type BundleVisibleV2 = {readonly revision: BundleRevision,readonly prev: Hash,readonly accounts?: ReadonlyArray<BundleVisibleEntryV2> | null,}
export type ChatConversationID = string
export type ClaimSummary = {readonly txID: TransactionID,readonly txStatus: TransactionStatus,readonly txErrMsg: string,readonly dir: RelayDirection,readonly toStellar: AccountID,readonly to: Keybase1.UserVersion,}
export type CurrencyLocal = {readonly description: string,readonly code: OutsideCurrencyCode,readonly symbol: string,readonly name: string,}
export type CurrencySymbol = {readonly symbol: string,readonly ambigious: boolean,readonly postfix: boolean,}
export type DetailsPlusPayments = {readonly details: AccountDetails,readonly recentPayments: PaymentsPage,readonly pendingPayments?: ReadonlyArray<PaymentSummary> | null,}
export type DirectOp = {readonly noteB64: string,}
export type EncryptedAccountBundle = {readonly v: number,readonly e: Uint8Array,readonly n: Keybase1.BoxNonce,readonly gen: Keybase1.PerUserKeyGeneration,}
export type EncryptedBundle = {readonly v: number,readonly e: Uint8Array,readonly n: Keybase1.BoxNonce,readonly gen: Keybase1.PerUserKeyGeneration,}
export type EncryptedNote = {readonly v: number,readonly e: Uint8Array,readonly n: Keybase1.BoxNonce,readonly sender: NoteRecipient,readonly recipient?: NoteRecipient | null,}
export type EncryptedRelaySecret = {readonly v: number,readonly e: Uint8Array,readonly n: Keybase1.BoxNonce,readonly gen: Keybase1.PerTeamKeyGeneration,}
export type Hash = Uint8Array
export type InflationDestinationResultLocal = {readonly destination?: AccountID | null,readonly knownDestination?: PredefinedInflationDestination | null,readonly self: boolean,}
export type InflationDestinationTag = string
export type KeybaseRequestID = string
export type KeybaseTransactionID = string
export type LookupResultCLILocal = {readonly accountID: AccountID,readonly username?: string | null,}
export type NetworkOptions = {readonly baseFee: number,}
export type NoteContents = {readonly note: string,readonly stellarID: TransactionID,}
export type NoteRecipient = {readonly user: Keybase1.UserVersion,readonly pukGen: Keybase1.PerUserKeyGeneration,}
export type OutsideCurrencyCode = string
export type OutsideCurrencyDefinition = {readonly name: string,readonly symbol: CurrencySymbol,}
export type OutsideExchangeRate = {readonly currency: OutsideCurrencyCode,readonly rate: string,}
export type OwnAccountCLILocal = {readonly accountID: AccountID,readonly isPrimary: boolean,readonly name: string,readonly balance?: ReadonlyArray<Balance> | null,readonly exchangeRate?: OutsideExchangeRate | null,readonly accountMode: AccountMode,}
export type PageCursor = {readonly horizonCursor: string,readonly directCursor: string,readonly relayCursor: string,}
export type PartnerUrl = {readonly url: string,readonly title: string,readonly description: string,readonly iconFilename: string,readonly adminOnly: boolean,readonly canPurchase: boolean,readonly extra: string,}
export type PathPaymentPost = {readonly fromDeviceID: Keybase1.DeviceID,readonly to?: Keybase1.UserVersion | null,readonly noteB64: string,readonly signedTransaction: string,readonly quickReturn: boolean,readonly chatConversationID?: ChatConversationID | null,}
export type PaymentCLILocal = {readonly txID: TransactionID,readonly time: TimeMs,readonly status: string,readonly statusDetail: string,readonly amount: string,readonly asset: Asset,readonly displayAmount?: string | null,readonly displayCurrency?: string | null,readonly sourceAmountMax: string,readonly sourceAmountActual: string,readonly sourceAsset: Asset,readonly isAdvanced: boolean,readonly summaryAdvanced: string,readonly operations?: ReadonlyArray<string> | null,readonly fromStellar: AccountID,readonly toStellar?: AccountID | null,readonly fromUsername?: string | null,readonly toUsername?: string | null,readonly toAssertion?: string | null,readonly note: string,readonly noteErr: string,readonly unread: boolean,readonly publicNote: string,readonly publicNoteType: string,readonly feeChargedDescription: string,}
export type PaymentDetails = {readonly summary: PaymentSummary,readonly memo: string,readonly memoType: string,readonly externalTxURL: string,readonly feeCharged: string,readonly pathIntermediate?: ReadonlyArray<Asset> | null,}
export type PaymentDetailsLocal = {readonly summary: PaymentLocal,readonly details: PaymentDetailsOnlyLocal,}
export type PaymentDetailsOnlyLocal = {readonly publicNote: string,readonly publicNoteType: string,readonly externalTxURL: string,readonly feeChargedDescription: string,readonly pathIntermediate?: ReadonlyArray<Asset> | null,}
export type PaymentDirectPost = {readonly fromDeviceID: Keybase1.DeviceID,readonly to?: Keybase1.UserVersion | null,readonly displayAmount: string,readonly displayCurrency: string,readonly noteB64: string,readonly signedTransaction: string,readonly quickReturn: boolean,readonly chatConversationID?: ChatConversationID | null,readonly batchID: string,}
export type PaymentID = string
export type PaymentLocal = {readonly id: PaymentID,readonly txID: TransactionID,readonly time: TimeMs,readonly statusSimplified: PaymentStatus,readonly statusDescription: string,readonly statusDetail: string,readonly showCancel: boolean,readonly amountDescription: string,readonly delta: BalanceDelta,readonly worth: string,readonly worthAtSendTime: string,readonly issuerDescription: string,readonly issuerAccountID?: AccountID | null,readonly fromType: ParticipantType,readonly toType: ParticipantType,readonly assetCode: string,readonly fromAccountID: AccountID,readonly fromAccountName: string,readonly fromUsername: string,readonly toAccountID?: AccountID | null,readonly toAccountName: string,readonly toUsername: string,readonly toAssertion: string,readonly originalToAssertion: string,readonly note: string,readonly noteErr: string,readonly sourceAmountMax: string,readonly sourceAmountActual: string,readonly sourceAsset: Asset,readonly sourceConvRate: string,readonly isAdvanced: boolean,readonly summaryAdvanced: string,readonly operations?: ReadonlyArray<string> | null,readonly unread: boolean,readonly batchID: string,readonly fromAirdrop: boolean,readonly isInflation: boolean,readonly inflationSource?: string | null,readonly trustline?: PaymentTrustlineLocal | null,}
export type PaymentMultiPost = {readonly fromDeviceID: Keybase1.DeviceID,readonly signedTransaction: string,readonly operations?: ReadonlyArray<PaymentOp> | null,readonly batchID: string,}
export type PaymentNotificationMsg = {readonly accountID: AccountID,readonly paymentID: PaymentID,}
export type PaymentOp = {readonly to?: Keybase1.UserVersion | null,readonly direct?: DirectOp | null,readonly relay?: RelayOp | null,}
export type PaymentOrErrorCLILocal = {readonly payment?: PaymentCLILocal | null,readonly err?: string | null,}
export type PaymentOrErrorLocal = {readonly payment?: PaymentLocal | null,readonly err?: string | null,}
export type PaymentPath = {readonly sourceAmount: string,readonly sourceAmountMax: string,readonly sourceAsset: Asset,readonly path?: ReadonlyArray<Asset> | null,readonly destinationAmount: string,readonly destinationAsset: Asset,readonly sourceInsufficientBalance: string,}
export type PaymentPathLocal = {readonly sourceDisplay: string,readonly sourceMaxDisplay: string,readonly destinationDisplay: string,readonly exchangeRate: string,readonly amountError: string,readonly destinationAccount: AccountID,readonly fullPath: PaymentPath,}
export type PaymentPathQuery = {readonly source: AccountID,readonly destination: AccountID,readonly sourceAsset: Asset,readonly destinationAsset: Asset,readonly amount: string,}
export type PaymentRelayPost = {readonly fromDeviceID: Keybase1.DeviceID,readonly to?: Keybase1.UserVersion | null,readonly toAssertion: string,readonly relayAccount: AccountID,readonly teamID: Keybase1.TeamID,readonly displayAmount: string,readonly displayCurrency: string,readonly boxB64: string,readonly signedTransaction: string,readonly quickReturn: boolean,readonly chatConversationID?: ChatConversationID | null,readonly batchID: string,}
export type PaymentResult = {readonly senderAccountID: AccountID,readonly keybaseID: KeybaseTransactionID,readonly stellarID: TransactionID,readonly pending: boolean,}
export type PaymentStatusMsg = {readonly accountID: AccountID,readonly kbTxID: KeybaseTransactionID,readonly txID: TransactionID,}
export type PaymentSummary ={ typ: PaymentSummaryType.stellar, stellar: PaymentSummaryStellar } | { typ: PaymentSummaryType.direct, direct: PaymentSummaryDirect } | { typ: PaymentSummaryType.relay, relay: PaymentSummaryRelay } | { typ: PaymentSummaryType.none}
export type PaymentSummaryDirect = {readonly kbTxID: KeybaseTransactionID,readonly txID: TransactionID,readonly txStatus: TransactionStatus,readonly txErrMsg: string,readonly fromStellar: AccountID,readonly from: Keybase1.UserVersion,readonly fromDeviceID: Keybase1.DeviceID,readonly toStellar: AccountID,readonly to?: Keybase1.UserVersion | null,readonly amount: string,readonly asset: Asset,readonly displayAmount?: string | null,readonly displayCurrency?: string | null,readonly noteB64: string,readonly fromDisplayAmount: string,readonly fromDisplayCurrency: string,readonly toDisplayAmount: string,readonly toDisplayCurrency: string,readonly ctime: TimeMs,readonly rtime: TimeMs,readonly cursorToken: string,readonly unread: boolean,readonly fromPrimary: boolean,readonly batchID: string,readonly fromAirdrop: boolean,readonly sourceAmountMax: string,readonly sourceAmountActual: string,readonly sourceAsset: Asset,}
export type PaymentSummaryRelay = {readonly kbTxID: KeybaseTransactionID,readonly txID: TransactionID,readonly txStatus: TransactionStatus,readonly txErrMsg: string,readonly fromStellar: AccountID,readonly from: Keybase1.UserVersion,readonly fromDeviceID: Keybase1.DeviceID,readonly to?: Keybase1.UserVersion | null,readonly toAssertion: string,readonly relayAccount: AccountID,readonly amount: string,readonly displayAmount?: string | null,readonly displayCurrency?: string | null,readonly ctime: TimeMs,readonly rtime: TimeMs,readonly boxB64: string,readonly teamID: Keybase1.TeamID,readonly claim?: ClaimSummary | null,readonly cursorToken: string,readonly batchID: string,readonly fromAirdrop: boolean,}
export type PaymentSummaryStellar = {readonly txID: TransactionID,readonly from: AccountID,readonly to: AccountID,readonly amount: string,readonly asset: Asset,readonly ctime: TimeMs,readonly cursorToken: string,readonly unread: boolean,readonly isInflation: boolean,readonly inflationSource?: string | null,readonly sourceAmountMax: string,readonly sourceAmountActual: string,readonly sourceAsset: Asset,readonly isAdvanced: boolean,readonly summaryAdvanced: string,readonly operations?: ReadonlyArray<string> | null,readonly trustline?: PaymentTrustlineLocal | null,}
export type PaymentTrustlineLocal = {readonly asset: Asset,readonly remove: boolean,}
export type PaymentsPage = {readonly payments?: ReadonlyArray<PaymentSummary> | null,readonly cursor?: PageCursor | null,readonly oldestUnread?: TransactionID | null,}
export type PaymentsPageLocal = {readonly payments?: ReadonlyArray<PaymentOrErrorLocal> | null,readonly cursor?: PageCursor | null,readonly oldestUnread?: PaymentID | null,}
export type PredefinedInflationDestination = {readonly tag: InflationDestinationTag,readonly name: string,readonly recommended: boolean,readonly accountID: AccountID,readonly url: string,}
export type RecipientTrustlinesLocal = {readonly trustlines?: ReadonlyArray<Balance> | null,readonly recipientType: ParticipantType,}
export type RelayClaimPost = {readonly keybaseID: KeybaseTransactionID,readonly dir: RelayDirection,readonly signedTransaction: string,readonly autoClaimToken?: string | null,}
export type RelayClaimResult = {readonly claimStellarID: TransactionID,}
export type RelayContents = {readonly stellarID: TransactionID,readonly sk: SecretKey,readonly note: string,}
export type RelayOp = {readonly toAssertion: string,readonly relayAccount: AccountID,readonly teamID: Keybase1.TeamID,readonly boxB64: string,}
export type RequestDetails = {readonly id: KeybaseRequestID,readonly fromUser: Keybase1.UserVersion,readonly toUser?: Keybase1.UserVersion | null,readonly toAssertion: string,readonly amount: string,readonly asset?: Asset | null,readonly currency?: OutsideCurrencyCode | null,readonly fromDisplayAmount: string,readonly fromDisplayCurrency: string,readonly toDisplayAmount: string,readonly toDisplayCurrency: string,readonly fundingKbTxID: KeybaseTransactionID,readonly status: RequestStatus,}
export type RequestDetailsLocal = {readonly id: KeybaseRequestID,readonly fromAssertion: string,readonly fromCurrentUser: boolean,readonly toUserType: ParticipantType,readonly toAssertion: string,readonly amount: string,readonly asset?: Asset | null,readonly currency?: OutsideCurrencyCode | null,readonly amountDescription: string,readonly worthAtRequestTime: string,readonly status: RequestStatus,}
export type RequestPost = {readonly toUser?: Keybase1.UserVersion | null,readonly toAssertion: string,readonly amount: string,readonly asset?: Asset | null,readonly currency?: OutsideCurrencyCode | null,}
export type RequestStatusMsg = {readonly reqID: KeybaseRequestID,}
export type SecretKey = string
export type SendAssetChoiceLocal = {readonly asset: Asset,readonly enabled: boolean,readonly left: string,readonly right: string,readonly subtext: string,}
export type SendBannerLocal = {readonly level: string,readonly message: string,readonly proofsChanged: boolean,readonly offerAdvancedSendForm: AdvancedBanner,}
export type SendPaymentResLocal = {readonly kbTxID: KeybaseTransactionID,readonly pending: boolean,readonly jumpToChat: string,}
export type SendResultCLILocal = {readonly kbTxID: KeybaseTransactionID,readonly txID: TransactionID,}
export type SignXdrResult = {readonly singedTx: string,readonly accountID: AccountID,readonly submitErr?: string | null,readonly submitTxID?: TransactionID | null,}
export type StaticConfig = {readonly paymentNoteMaxLength: number,readonly requestNoteMaxLength: number,readonly publicMemoMaxLength: number,}
export type StellarServerDefinitions = {readonly revision: number,readonly currencies?: {[key: string]: OutsideCurrencyDefinition} | null,}
export type SubmitMultiRes = {readonly txID: TransactionID,}
export type TimeMs = number
export type TimeboundsRecommendation = {readonly timeNow: Keybase1.UnixTime,readonly timeout: number,}
export type TransactionID = string
export type Trustline = {readonly assetCode: AssetCode,readonly issuer: AccountID,}
export type TxDisplaySummary = {readonly source: AccountID,readonly fee: number,readonly memo: string,readonly memoType: string,readonly operations?: ReadonlyArray<string> | null,}
export type UIPaymentReviewed = {readonly bid: BuildPaymentID,readonly reviewID: number,readonly seqno: number,readonly banners?: ReadonlyArray<SendBannerLocal> | null,readonly nextButton: string,}
export type ValidateStellarURIResultLocal = {readonly operation: string,readonly originDomain: string,readonly message: string,readonly callbackURL: string,readonly xdr: string,readonly summary: TxDisplaySummary,readonly recipient: string,readonly amount: string,readonly assetCode: string,readonly assetIssuer: string,readonly memo: string,readonly memoType: string,readonly displayAmountFiat: string,readonly availableToSendNative: string,readonly availableToSendFiat: string,readonly signed: boolean,}
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
// 'stellar.1.local.getWalletAccountLocal'
// 'stellar.1.local.getAccountAssetsLocal'
// 'stellar.1.local.getPaymentsLocal'
// 'stellar.1.local.getPendingPaymentsLocal'
// 'stellar.1.local.markAsReadLocal'
// 'stellar.1.local.getPaymentDetailsLocal'
// 'stellar.1.local.getGenericPaymentDetailsLocal'
// 'stellar.1.local.getDisplayCurrenciesLocal'
// 'stellar.1.local.validateAccountIDLocal'
// 'stellar.1.local.validateSecretKeyLocal'
// 'stellar.1.local.validateAccountNameLocal'
// 'stellar.1.local.changeWalletAccountNameLocal'
// 'stellar.1.local.setWalletAccountAsDefaultLocal'
// 'stellar.1.local.linkNewWalletAccountLocal'
// 'stellar.1.local.createWalletAccountLocal'
// 'stellar.1.local.changeDisplayCurrencyLocal'
// 'stellar.1.local.getDisplayCurrencyLocal'
// 'stellar.1.local.acceptDisclaimerLocal'
// 'stellar.1.local.getWalletAccountPublicKeyLocal'
// 'stellar.1.local.getSendAssetChoicesLocal'
// 'stellar.1.local.startBuildPaymentLocal'
// 'stellar.1.local.stopBuildPaymentLocal'
// 'stellar.1.local.buildPaymentLocal'
// 'stellar.1.local.reviewPaymentLocal'
// 'stellar.1.local.sendPaymentLocal'
// 'stellar.1.local.sendPathLocal'
// 'stellar.1.local.buildRequestLocal'
// 'stellar.1.local.getRequestDetailsLocal'
// 'stellar.1.local.cancelRequestLocal'
// 'stellar.1.local.makeRequestLocal'
// 'stellar.1.local.setAccountMobileOnlyLocal'
// 'stellar.1.local.setAccountAllDevicesLocal'
// 'stellar.1.local.isAccountMobileOnlyLocal'
// 'stellar.1.local.cancelPaymentLocal'
// 'stellar.1.local.getPredefinedInflationDestinationsLocal'
// 'stellar.1.local.setInflationDestinationLocal'
// 'stellar.1.local.getInflationDestinationLocal'
// 'stellar.1.local.airdropDetailsLocal'
// 'stellar.1.local.airdropStatusLocal'
// 'stellar.1.local.airdropRegisterLocal'
// 'stellar.1.local.fuzzyAssetSearchLocal'
// 'stellar.1.local.listPopularAssetsLocal'
// 'stellar.1.local.addTrustlineLocal'
// 'stellar.1.local.deleteTrustlineLocal'
// 'stellar.1.local.changeTrustlineLimitLocal'
// 'stellar.1.local.getTrustlinesLocal'
// 'stellar.1.local.getTrustlinesForRecipientLocal'
// 'stellar.1.local.findPaymentPathLocal'
// 'stellar.1.local.assetDepositLocal'
// 'stellar.1.local.assetWithdrawLocal'
// 'stellar.1.local.balancesLocal'
// 'stellar.1.local.sendCLILocal'
// 'stellar.1.local.sendPathCLILocal'
// 'stellar.1.local.accountMergeCLILocal'
// 'stellar.1.local.claimCLILocal'
// 'stellar.1.local.recentPaymentsCLILocal'
// 'stellar.1.local.paymentDetailCLILocal'
// 'stellar.1.local.walletInitLocal'
// 'stellar.1.local.walletDumpLocal'
// 'stellar.1.local.walletGetAccountsCLILocal'
// 'stellar.1.local.ownAccountLocal'
// 'stellar.1.local.importSecretKeyLocal'
// 'stellar.1.local.exportSecretKeyLocal'
// 'stellar.1.local.setDisplayCurrency'
// 'stellar.1.local.exchangeRateLocal'
// 'stellar.1.local.getAvailableLocalCurrencies'
// 'stellar.1.local.formatLocalCurrencyString'
// 'stellar.1.local.makeRequestCLILocal'
// 'stellar.1.local.lookupCLILocal'
// 'stellar.1.local.batchLocal'
// 'stellar.1.local.validateStellarURILocal'
// 'stellar.1.local.approveTxURILocal'
// 'stellar.1.local.approvePayURILocal'
// 'stellar.1.local.approvePathURILocal'
// 'stellar.1.local.getPartnerUrlsLocal'
// 'stellar.1.local.signTransactionXdrLocal'
// 'stellar.1.local.getStaticConfigLocal'
// 'stellar.1.notify.paymentNotification'
// 'stellar.1.notify.paymentStatusNotification'
// 'stellar.1.notify.requestStatusNotification'
// 'stellar.1.notify.accountDetailsUpdate'
// 'stellar.1.notify.accountsUpdate'
// 'stellar.1.notify.pendingPaymentsUpdate'
// 'stellar.1.notify.recentPaymentsUpdate'
// 'stellar.1.remote.balances'
// 'stellar.1.remote.details'
// 'stellar.1.remote.recentPayments'
// 'stellar.1.remote.pendingPayments'
// 'stellar.1.remote.markAsRead'
// 'stellar.1.remote.paymentDetails'
// 'stellar.1.remote.accountSeqno'
// 'stellar.1.remote.submitPayment'
// 'stellar.1.remote.submitRelayPayment'
// 'stellar.1.remote.submitRelayClaim'
// 'stellar.1.remote.submitPathPayment'
// 'stellar.1.remote.submitMultiPayment'
// 'stellar.1.remote.acquireAutoClaimLock'
// 'stellar.1.remote.releaseAutoClaimLock'
// 'stellar.1.remote.nextAutoClaim'
// 'stellar.1.remote.isMasterKeyActive'
// 'stellar.1.remote.submitRequest'
// 'stellar.1.remote.requestDetails'
// 'stellar.1.remote.cancelRequest'
// 'stellar.1.remote.setInflationDestination'
// 'stellar.1.remote.ping'
// 'stellar.1.remote.networkOptions'
// 'stellar.1.remote.detailsPlusPayments'
// 'stellar.1.remote.allDetailsPlusPayments'
// 'stellar.1.remote.assetSearch'
// 'stellar.1.remote.fuzzyAssetSearch'
// 'stellar.1.remote.listPopularAssets'
// 'stellar.1.remote.changeTrustline'
// 'stellar.1.remote.findPaymentPath'
// 'stellar.1.remote.postAnyTransaction'
// 'stellar.1.ui.paymentReviewed'