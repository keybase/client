// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from '../constants/types/wallets'
import * as ChatTypes from '../constants/types/chat2'
import * as StellarRPCTypes from '../constants/types/rpc-stellar-gen'
import HiddenString from '../util/hidden-string'

// Constants
export const resetStore = 'common:resetStore' // not a part of wallets but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'wallets:'
export const abandonPayment = 'wallets:abandonPayment'
export const acceptDisclaimer = 'wallets:acceptDisclaimer'
export const acceptSEP7Path = 'wallets:acceptSEP7Path'
export const acceptSEP7Pay = 'wallets:acceptSEP7Pay'
export const acceptSEP7Tx = 'wallets:acceptSEP7Tx'
export const accountUpdateReceived = 'wallets:accountUpdateReceived'
export const accountsReceived = 'wallets:accountsReceived'
export const addTrustline = 'wallets:addTrustline'
export const assetDeposit = 'wallets:assetDeposit'
export const assetWithdraw = 'wallets:assetWithdraw'
export const assetsReceived = 'wallets:assetsReceived'
export const badgesUpdated = 'wallets:badgesUpdated'
export const buildPayment = 'wallets:buildPayment'
export const buildingPaymentIDReceived = 'wallets:buildingPaymentIDReceived'
export const builtPaymentReceived = 'wallets:builtPaymentReceived'
export const builtRequestReceived = 'wallets:builtRequestReceived'
export const calculateBuildingAdvanced = 'wallets:calculateBuildingAdvanced'
export const cancelPayment = 'wallets:cancelPayment'
export const cancelRequest = 'wallets:cancelRequest'
export const changeAccountName = 'wallets:changeAccountName'
export const changeAirdrop = 'wallets:changeAirdrop'
export const changeDisplayCurrency = 'wallets:changeDisplayCurrency'
export const changeMobileOnlyMode = 'wallets:changeMobileOnlyMode'
export const changedAccountName = 'wallets:changedAccountName'
export const changedTrustline = 'wallets:changedTrustline'
export const checkDisclaimer = 'wallets:checkDisclaimer'
export const clearBuilding = 'wallets:clearBuilding'
export const clearBuildingAdvanced = 'wallets:clearBuildingAdvanced'
export const clearBuiltPayment = 'wallets:clearBuiltPayment'
export const clearBuiltRequest = 'wallets:clearBuiltRequest'
export const clearErrors = 'wallets:clearErrors'
export const clearTrustlineSearchResults = 'wallets:clearTrustlineSearchResults'
export const createNewAccount = 'wallets:createNewAccount'
export const createdNewAccount = 'wallets:createdNewAccount'
export const deleteAccount = 'wallets:deleteAccount'
export const deleteTrustline = 'wallets:deleteTrustline'
export const deletedAccount = 'wallets:deletedAccount'
export const didSetAccountAsDefault = 'wallets:didSetAccountAsDefault'
export const displayCurrenciesReceived = 'wallets:displayCurrenciesReceived'
export const displayCurrencyReceived = 'wallets:displayCurrencyReceived'
export const exitFailedPayment = 'wallets:exitFailedPayment'
export const exportSecretKey = 'wallets:exportSecretKey'
export const externalPartnersReceived = 'wallets:externalPartnersReceived'
export const hideAirdropBanner = 'wallets:hideAirdropBanner'
export const inflationDestinationReceived = 'wallets:inflationDestinationReceived'
export const linkExistingAccount = 'wallets:linkExistingAccount'
export const linkedExistingAccount = 'wallets:linkedExistingAccount'
export const loadAccounts = 'wallets:loadAccounts'
export const loadAssets = 'wallets:loadAssets'
export const loadDisplayCurrencies = 'wallets:loadDisplayCurrencies'
export const loadDisplayCurrency = 'wallets:loadDisplayCurrency'
export const loadExternalPartners = 'wallets:loadExternalPartners'
export const loadInflationDestination = 'wallets:loadInflationDestination'
export const loadMobileOnlyMode = 'wallets:loadMobileOnlyMode'
export const loadMorePayments = 'wallets:loadMorePayments'
export const loadPaymentDetail = 'wallets:loadPaymentDetail'
export const loadPayments = 'wallets:loadPayments'
export const loadSendAssetChoices = 'wallets:loadSendAssetChoices'
export const loadWalletDisclaimer = 'wallets:loadWalletDisclaimer'
export const loadedMobileOnlyMode = 'wallets:loadedMobileOnlyMode'
export const markAsRead = 'wallets:markAsRead'
export const openSendRequestForm = 'wallets:openSendRequestForm'
export const paymentDetailReceived = 'wallets:paymentDetailReceived'
export const paymentsReceived = 'wallets:paymentsReceived'
export const pendingPaymentsReceived = 'wallets:pendingPaymentsReceived'
export const recentPaymentsReceived = 'wallets:recentPaymentsReceived'
export const refreshTrustlineAcceptedAssets = 'wallets:refreshTrustlineAcceptedAssets'
export const refreshTrustlineAcceptedAssetsByUsername = 'wallets:refreshTrustlineAcceptedAssetsByUsername'
export const refreshTrustlinePopularAssets = 'wallets:refreshTrustlinePopularAssets'
export const rejectDisclaimer = 'wallets:rejectDisclaimer'
export const requestPayment = 'wallets:requestPayment'
export const requestedPayment = 'wallets:requestedPayment'
export const resetAcceptingDisclaimer = 'wallets:resetAcceptingDisclaimer'
export const reviewPayment = 'wallets:reviewPayment'
export const reviewedPaymentReceived = 'wallets:reviewedPaymentReceived'
export const secretKeyReceived = 'wallets:secretKeyReceived'
export const secretKeySeen = 'wallets:secretKeySeen'
export const selectAccount = 'wallets:selectAccount'
export const sendAssetChoicesReceived = 'wallets:sendAssetChoicesReceived'
export const sendPayment = 'wallets:sendPayment'
export const sendPaymentAdvanced = 'wallets:sendPaymentAdvanced'
export const sentPayment = 'wallets:sentPayment'
export const sentPaymentError = 'wallets:sentPaymentError'
export const setAccountAsDefault = 'wallets:setAccountAsDefault'
export const setBuildingAdvancedPublicMemo = 'wallets:setBuildingAdvancedPublicMemo'
export const setBuildingAdvancedRecipient = 'wallets:setBuildingAdvancedRecipient'
export const setBuildingAdvancedRecipientAmount = 'wallets:setBuildingAdvancedRecipientAmount'
export const setBuildingAdvancedRecipientAsset = 'wallets:setBuildingAdvancedRecipientAsset'
export const setBuildingAdvancedRecipientType = 'wallets:setBuildingAdvancedRecipientType'
export const setBuildingAdvancedSecretNote = 'wallets:setBuildingAdvancedSecretNote'
export const setBuildingAdvancedSenderAccountID = 'wallets:setBuildingAdvancedSenderAccountID'
export const setBuildingAdvancedSenderAsset = 'wallets:setBuildingAdvancedSenderAsset'
export const setBuildingAmount = 'wallets:setBuildingAmount'
export const setBuildingCurrency = 'wallets:setBuildingCurrency'
export const setBuildingFrom = 'wallets:setBuildingFrom'
export const setBuildingIsRequest = 'wallets:setBuildingIsRequest'
export const setBuildingPublicMemo = 'wallets:setBuildingPublicMemo'
export const setBuildingRecipientType = 'wallets:setBuildingRecipientType'
export const setBuildingSecretNote = 'wallets:setBuildingSecretNote'
export const setBuildingTo = 'wallets:setBuildingTo'
export const setBuiltPaymentAdvanced = 'wallets:setBuiltPaymentAdvanced'
export const setInflationDestination = 'wallets:setInflationDestination'
export const setLastSentXLM = 'wallets:setLastSentXLM'
export const setReadyToReview = 'wallets:setReadyToReview'
export const setSEP6Message = 'wallets:setSEP6Message'
export const setSEP7Tx = 'wallets:setSEP7Tx'
export const setTrustlineAcceptedAssets = 'wallets:setTrustlineAcceptedAssets'
export const setTrustlineAcceptedAssetsByUsername = 'wallets:setTrustlineAcceptedAssetsByUsername'
export const setTrustlineExpanded = 'wallets:setTrustlineExpanded'
export const setTrustlinePopularAssets = 'wallets:setTrustlinePopularAssets'
export const setTrustlineSearchResults = 'wallets:setTrustlineSearchResults'
export const setTrustlineSearchText = 'wallets:setTrustlineSearchText'
export const showTransaction = 'wallets:showTransaction'
export const staticConfigLoaded = 'wallets:staticConfigLoaded'
export const updateAirdropBannerState = 'wallets:updateAirdropBannerState'
export const updateAirdropDetails = 'wallets:updateAirdropDetails'
export const updateAirdropState = 'wallets:updateAirdropState'
export const updatedAirdropDetails = 'wallets:updatedAirdropDetails'
export const updatedAirdropState = 'wallets:updatedAirdropState'
export const validateAccountName = 'wallets:validateAccountName'
export const validateSEP7Link = 'wallets:validateSEP7Link'
export const validateSEP7LinkError = 'wallets:validateSEP7LinkError'
export const validateSecretKey = 'wallets:validateSecretKey'
export const validatedAccountName = 'wallets:validatedAccountName'
export const validatedSecretKey = 'wallets:validatedSecretKey'
export const walletDisclaimerReceived = 'wallets:walletDisclaimerReceived'

// Payload Types
type _AbandonPaymentPayload = void
type _AcceptDisclaimerPayload = void
type _AcceptSEP7PathPayload = {readonly inputURI: string}
type _AcceptSEP7PayPayload = {readonly amount: string; readonly inputURI: string}
type _AcceptSEP7TxPayload = {readonly inputURI: string}
type _AccountUpdateReceivedPayload = {readonly account: Types.Account}
type _AccountsReceivedPayload = {readonly accounts: Array<Types.Account>}
type _AddTrustlinePayload = {readonly accountID: Types.AccountID; readonly assetID: Types.AssetID}
type _AssetDepositPayload = {
  readonly accountID: Types.AccountID
  readonly code: Types.CurrencyCode
  readonly issuerAccountID: Types.AccountID
}
type _AssetWithdrawPayload = {
  readonly accountID: Types.AccountID
  readonly code: Types.CurrencyCode
  readonly issuerAccountID: Types.AccountID
}
type _AssetsReceivedPayload = {readonly accountID: Types.AccountID; readonly assets: Array<Types.Assets>}
type _BadgesUpdatedPayload = {readonly accounts: Array<RPCTypes.WalletAccountInfo>}
type _BuildPaymentPayload = void
type _BuildingPaymentIDReceivedPayload = {readonly bid: string}
type _BuiltPaymentReceivedPayload = {readonly build: Types.BuiltPayment; readonly forBuildCounter: number}
type _BuiltRequestReceivedPayload = {readonly build: Types.BuiltRequest; readonly forBuildCounter: number}
type _CalculateBuildingAdvancedPayload = {readonly forSEP7: boolean}
type _CancelPaymentPayload = {readonly showAccount?: boolean; readonly paymentID: Types.PaymentID}
type _CancelRequestPayload = {
  readonly conversationIDKey?: ChatTypes.ConversationIDKey
  readonly ordinal?: ChatTypes.Ordinal
  readonly requestID: StellarRPCTypes.KeybaseRequestID
}
type _ChangeAccountNamePayload = {readonly accountID: Types.AccountID; readonly name: string}
type _ChangeAirdropPayload = {readonly accept: boolean}
type _ChangeDisplayCurrencyPayload = {readonly accountID: Types.AccountID; readonly code: Types.CurrencyCode}
type _ChangeMobileOnlyModePayload = {readonly accountID: Types.AccountID; readonly enabled: boolean}
type _ChangedAccountNamePayload = {readonly account: Types.Account}
type _ChangedAccountNamePayloadError = {
  readonly name: string
  readonly account: Types.Account
  readonly error: string
}
type _ChangedTrustlinePayload = void
type _ChangedTrustlinePayloadError = {readonly error: string}
type _CheckDisclaimerPayload = {readonly nextScreen: Types.NextScreenAfterAcceptance}
type _ClearBuildingAdvancedPayload = void
type _ClearBuildingPayload = void
type _ClearBuiltPaymentPayload = void
type _ClearBuiltRequestPayload = void
type _ClearErrorsPayload = void
type _ClearTrustlineSearchResultsPayload = void
type _CreateNewAccountPayload = {
  readonly name: string
  readonly showOnCreation?: boolean
  readonly setBuildingTo?: boolean
}
type _CreatedNewAccountPayload = {
  readonly accountID: Types.AccountID
  readonly showOnCreation?: boolean
  readonly setBuildingTo?: boolean
}
type _CreatedNewAccountPayloadError = {readonly name: string; readonly error: string}
type _DeleteAccountPayload = {readonly accountID: Types.AccountID}
type _DeleteTrustlinePayload = {readonly accountID: Types.AccountID; readonly assetID: Types.AssetID}
type _DeletedAccountPayload = void
type _DidSetAccountAsDefaultPayload = {readonly accounts: Array<Types.Account>}
type _DisplayCurrenciesReceivedPayload = {readonly currencies: Array<Types.Currency>}
type _DisplayCurrencyReceivedPayload = {
  readonly accountID: Types.AccountID | null
  readonly currency: Types.Currency
  readonly setBuildingCurrency?: boolean
}
type _ExitFailedPaymentPayload = void
type _ExportSecretKeyPayload = {readonly accountID: Types.AccountID}
type _ExternalPartnersReceivedPayload = {readonly externalPartners: I.List<Types.PartnerUrl>}
type _HideAirdropBannerPayload = void
type _InflationDestinationReceivedPayload = {
  readonly accountID: Types.AccountID
  readonly selected: Types.AccountInflationDestination
  readonly options?: Array<Types.InflationDestination>
}
type _InflationDestinationReceivedPayloadError = {readonly error: string}
type _LinkExistingAccountPayload = {
  readonly name: string
  readonly secretKey: HiddenString
  readonly showOnCreation?: boolean
  readonly setBuildingTo?: boolean
}
type _LinkedExistingAccountPayload = {
  readonly accountID: Types.AccountID
  readonly showOnCreation?: boolean
  readonly setBuildingTo?: boolean
}
type _LinkedExistingAccountPayloadError = {
  readonly name: string
  readonly secretKey: HiddenString
  readonly error: string
}
type _LoadAccountsPayload = {readonly reason: 'initial-load' | 'open-send-req-form'}
type _LoadAssetsPayload = {readonly accountID: Types.AccountID}
type _LoadDisplayCurrenciesPayload = void
type _LoadDisplayCurrencyPayload = {
  readonly accountID: Types.AccountID | null
  readonly setBuildingCurrency?: boolean
}
type _LoadExternalPartnersPayload = void
type _LoadInflationDestinationPayload = {readonly accountID: Types.AccountID}
type _LoadMobileOnlyModePayload = {readonly accountID: Types.AccountID}
type _LoadMorePaymentsPayload = {readonly accountID: Types.AccountID}
type _LoadPaymentDetailPayload = {readonly accountID: Types.AccountID; readonly paymentID: Types.PaymentID}
type _LoadPaymentsPayload = {readonly accountID: Types.AccountID}
type _LoadSendAssetChoicesPayload = {readonly from: Types.AccountID; readonly to: string}
type _LoadWalletDisclaimerPayload = void
type _LoadedMobileOnlyModePayload = {readonly accountID: Types.AccountID; readonly enabled: boolean}
type _MarkAsReadPayload = {readonly accountID: Types.AccountID; readonly mostRecentID: Types.PaymentID}
type _OpenSendRequestFormPayload = {
  readonly amount?: string
  readonly currency?: string
  readonly from?: Types.AccountID
  readonly isRequest?: boolean
  readonly publicMemo?: HiddenString
  readonly recipientType?: Types.CounterpartyType
  readonly secretNote?: HiddenString
  readonly to?: string
}
type _PaymentDetailReceivedPayload = {
  readonly accountID: Types.AccountID
  readonly payment: Types.PaymentDetail
}
type _PaymentsReceivedPayload = {
  readonly accountID: Types.AccountID
  readonly allowClearOldestUnread: boolean
  readonly paymentCursor: StellarRPCTypes.PageCursor | null
  readonly oldestUnread: Types.PaymentID
  readonly payments: Array<Types.PaymentResult>
  readonly pending: Array<Types.PaymentResult>
}
type _PendingPaymentsReceivedPayload = {
  readonly accountID: Types.AccountID
  readonly pending: Array<Types.PaymentResult>
}
type _RecentPaymentsReceivedPayload = {
  readonly accountID: Types.AccountID
  readonly paymentCursor: StellarRPCTypes.PageCursor | null
  readonly oldestUnread: Types.PaymentID
  readonly payments: Array<Types.PaymentResult>
}
type _RefreshTrustlineAcceptedAssetsByUsernamePayload = {readonly username: string}
type _RefreshTrustlineAcceptedAssetsPayload = {readonly accountID: Types.AccountID}
type _RefreshTrustlinePopularAssetsPayload = void
type _RejectDisclaimerPayload = void
type _RequestPaymentPayload = void
type _RequestedPaymentPayload = {
  readonly kbRqID: HiddenString
  readonly lastSentXLM: boolean
  readonly requestee: string
}
type _ResetAcceptingDisclaimerPayload = void
type _ReviewPaymentPayload = void
type _ReviewedPaymentReceivedPayload = {
  readonly bid: string
  readonly reviewID: number
  readonly seqno: number
  readonly nextButton: string
  readonly banners?: Array<StellarRPCTypes.SendBannerLocal> | null
}
type _SecretKeyReceivedPayload = {readonly accountID: Types.AccountID; readonly secretKey: HiddenString}
type _SecretKeySeenPayload = {readonly accountID: Types.AccountID}
type _SelectAccountPayload = {
  readonly accountID: Types.AccountID
  readonly reason: 'user-selected' | 'auto-selected' | 'from-chat' | 'show-transaction'
  readonly show?: boolean
}
type _SendAssetChoicesReceivedPayload = {
  readonly sendAssetChoices: Array<StellarRPCTypes.SendAssetChoiceLocal>
}
type _SendPaymentAdvancedPayload = void
type _SendPaymentPayload = void
type _SentPaymentErrorPayload = {readonly error: string}
type _SentPaymentPayload = {
  readonly kbTxID: HiddenString
  readonly lastSentXLM: boolean
  readonly jumpToChat: string
}
type _SetAccountAsDefaultPayload = {readonly accountID: Types.AccountID}
type _SetBuildingAdvancedPublicMemoPayload = {readonly publicMemo: HiddenString}
type _SetBuildingAdvancedRecipientAmountPayload = {readonly recipientAmount: string}
type _SetBuildingAdvancedRecipientAssetPayload = {readonly recipientAsset: Types.AssetDescriptionOrNative}
type _SetBuildingAdvancedRecipientPayload = {readonly recipient: string}
type _SetBuildingAdvancedRecipientTypePayload = {readonly recipientType: Types.CounterpartyType}
type _SetBuildingAdvancedSecretNotePayload = {readonly secretNote: HiddenString}
type _SetBuildingAdvancedSenderAccountIDPayload = {readonly senderAccountID: Types.AccountID}
type _SetBuildingAdvancedSenderAssetPayload = {readonly senderAsset: Types.AssetDescriptionOrNative}
type _SetBuildingAmountPayload = {readonly amount: string}
type _SetBuildingCurrencyPayload = {readonly currency: string}
type _SetBuildingFromPayload = {readonly from: Types.AccountID}
type _SetBuildingIsRequestPayload = {readonly isRequest: boolean}
type _SetBuildingPublicMemoPayload = {readonly publicMemo: HiddenString}
type _SetBuildingRecipientTypePayload = {readonly recipientType: Types.CounterpartyType}
type _SetBuildingSecretNotePayload = {readonly secretNote: HiddenString}
type _SetBuildingToPayload = {readonly to: string}
type _SetBuiltPaymentAdvancedPayload = {
  readonly builtPaymentAdvanced: Types.BuiltPaymentAdvanced
  readonly forSEP7: boolean
}
type _SetInflationDestinationPayload = {
  readonly accountID: Types.AccountID
  readonly destination: Types.AccountID
  readonly name: string
}
type _SetLastSentXLMPayload = {readonly lastSentXLM: boolean; readonly writeFile: boolean}
type _SetReadyToReviewPayload = {readonly readyToReview: boolean}
type _SetSEP6MessagePayload = {readonly error: boolean; readonly message: string}
type _SetSEP7TxPayload = {readonly confirmURI: string; readonly tx: Types.SEP7ConfirmInfo}
type _SetTrustlineAcceptedAssetsByUsernamePayload = {
  readonly username: string
  readonly assets: Array<Types.AssetDescription>
  readonly limits: I.Map<Types.AssetID, number>
}
type _SetTrustlineAcceptedAssetsPayload = {
  readonly accountID: Types.AccountID
  readonly assets: Array<Types.AssetDescription>
  readonly limits: I.Map<Types.AssetID, number>
}
type _SetTrustlineExpandedPayload = {readonly expanded: boolean; readonly assetID: Types.AssetID}
type _SetTrustlinePopularAssetsPayload = {
  readonly assets: Array<Types.AssetDescription>
  readonly totalCount: number
}
type _SetTrustlineSearchResultsPayload = {readonly assets: Array<Types.AssetDescription>}
type _SetTrustlineSearchTextPayload = {readonly text: string}
type _ShowTransactionPayload = {readonly accountID: Types.AccountID; readonly paymentID: Types.PaymentID}
type _StaticConfigLoadedPayload = {readonly staticConfig: Types.StaticConfig}
type _UpdateAirdropBannerStatePayload = {readonly show: boolean}
type _UpdateAirdropDetailsPayload = void
type _UpdateAirdropStatePayload = void
type _UpdatedAirdropDetailsPayload = {
  readonly details: Types.StellarDetailsResponse
  readonly disclaimer: Types.StellarDetailsResponse
  readonly isPromoted: boolean
}
type _UpdatedAirdropStatePayload = {
  readonly airdropQualifications: Array<Types.AirdropQualification>
  readonly airdropState: Types.AirdropState
}
type _ValidateAccountNamePayload = {readonly name: string}
type _ValidateSEP7LinkErrorPayload = {readonly error: string}
type _ValidateSEP7LinkPayload = {readonly link: string}
type _ValidateSecretKeyPayload = {readonly secretKey: HiddenString}
type _ValidatedAccountNamePayload = {readonly name: string}
type _ValidatedAccountNamePayloadError = {readonly name: string; readonly error: string}
type _ValidatedSecretKeyPayload = {readonly secretKey: HiddenString}
type _ValidatedSecretKeyPayloadError = {readonly secretKey: HiddenString; readonly error: string}
type _WalletDisclaimerReceivedPayload = {readonly accepted: boolean}

// Action Creators
/**
 * A response from the service after an account is deleted.
 */
export const createDeletedAccount = (payload: _DeletedAccountPayload): DeletedAccountPayload => ({
  payload,
  type: deletedAccount,
})
/**
 * A response from the service after an account is set as the default
 */
export const createDidSetAccountAsDefault = (
  payload: _DidSetAccountAsDefaultPayload
): DidSetAccountAsDefaultPayload => ({payload, type: didSetAccountAsDefault})
/**
 * A response from the service after an account's name is changed
 */
export const createChangedAccountName = (payload: _ChangedAccountNamePayload): ChangedAccountNamePayload => ({
  payload,
  type: changedAccountName,
})
export const createChangedAccountNameError = (
  payload: _ChangedAccountNamePayloadError
): ChangedAccountNamePayloadError => ({error: true, payload, type: changedAccountName})
/**
 * Accept the Stellar account disclaimer
 */
export const createAcceptDisclaimer = (payload: _AcceptDisclaimerPayload): AcceptDisclaimerPayload => ({
  payload,
  type: acceptDisclaimer,
})
/**
 * Accept the prepared SEP7 path payment
 */
export const createAcceptSEP7Path = (payload: _AcceptSEP7PathPayload): AcceptSEP7PathPayload => ({
  payload,
  type: acceptSEP7Path,
})
/**
 * Accept the prepared SEP7 payment
 */
export const createAcceptSEP7Pay = (payload: _AcceptSEP7PayPayload): AcceptSEP7PayPayload => ({
  payload,
  type: acceptSEP7Pay,
})
/**
 * Accept the prepared SEP7 tx
 */
export const createAcceptSEP7Tx = (payload: _AcceptSEP7TxPayload): AcceptSEP7TxPayload => ({
  payload,
  type: acceptSEP7Tx,
})
/**
 * Add a new wallet to your account
 */
export const createCreateNewAccount = (payload: _CreateNewAccountPayload): CreateNewAccountPayload => ({
  payload,
  type: createNewAccount,
})
/**
 * Ask the service for current mobile only mode for Stellar account.
 */
export const createLoadMobileOnlyMode = (payload: _LoadMobileOnlyModePayload): LoadMobileOnlyModePayload => ({
  payload,
  type: loadMobileOnlyMode,
})
/**
 * Ask the service to validate an account name.
 */
export const createValidateAccountName = (
  payload: _ValidateAccountNamePayload
): ValidateAccountNamePayload => ({payload, type: validateAccountName})
/**
 * Ask the service to validate an account secret key.
 */
export const createValidateSecretKey = (payload: _ValidateSecretKeyPayload): ValidateSecretKeyPayload => ({
  payload,
  type: validateSecretKey,
})
/**
 * Cancel a payment. Valid for payments of status 'claimable'. If showAccount is true, nav to the currently selected account when done.
 */
export const createCancelPayment = (payload: _CancelPaymentPayload): CancelPaymentPayload => ({
  payload,
  type: cancelPayment,
})
/**
 * Cancel a request. Optionally delete an associated message
 */
export const createCancelRequest = (payload: _CancelRequestPayload): CancelRequestPayload => ({
  payload,
  type: cancelRequest,
})
/**
 * Change display currency for an account
 */
export const createChangeDisplayCurrency = (
  payload: _ChangeDisplayCurrencyPayload
): ChangeDisplayCurrencyPayload => ({payload, type: changeDisplayCurrency})
/**
 * Change mobile only mode for Stellar account.
 */
export const createChangeMobileOnlyMode = (
  payload: _ChangeMobileOnlyModePayload
): ChangeMobileOnlyModePayload => ({payload, type: changeMobileOnlyMode})
/**
 * Change the default account
 */
export const createSetAccountAsDefault = (
  payload: _SetAccountAsDefaultPayload
): SetAccountAsDefaultPayload => ({payload, type: setAccountAsDefault})
/**
 * Change the name of an account
 */
export const createChangeAccountName = (payload: _ChangeAccountNamePayload): ChangeAccountNamePayload => ({
  payload,
  type: changeAccountName,
})
/**
 * Clear a payment or request that was being prepared
 */
export const createClearBuilding = (payload: _ClearBuildingPayload): ClearBuildingPayload => ({
  payload,
  type: clearBuilding,
})
/**
 * Clear a prepared payment once it has been sent or canceled
 */
export const createClearBuiltPayment = (payload: _ClearBuiltPaymentPayload): ClearBuiltPaymentPayload => ({
  payload,
  type: clearBuiltPayment,
})
/**
 * Clear a prepared request once it has been sent or canceled
 */
export const createClearBuiltRequest = (payload: _ClearBuiltRequestPayload): ClearBuiltRequestPayload => ({
  payload,
  type: clearBuiltRequest,
})
/**
 * Clear errors from the store at times like opening or closing a form dialog.
 */
export const createClearErrors = (payload: _ClearErrorsPayload): ClearErrorsPayload => ({
  payload,
  type: clearErrors,
})
/**
 * Clear exported secret keys from our store once they've been seen
 */
export const createSecretKeySeen = (payload: _SecretKeySeenPayload): SecretKeySeenPayload => ({
  payload,
  type: secretKeySeen,
})
/**
 * Close the send form and show the user their transactions so they can review.
 */
export const createExitFailedPayment = (payload: _ExitFailedPaymentPayload): ExitFailedPaymentPayload => ({
  payload,
  type: exitFailedPayment,
})
/**
 * Delete an account
 */
export const createDeleteAccount = (payload: _DeleteAccountPayload): DeleteAccountPayload => ({
  payload,
  type: deleteAccount,
})
/**
 * Discover whether the user has accepted the Stellar disclaimer
 */
export const createCheckDisclaimer = (payload: _CheckDisclaimerPayload): CheckDisclaimerPayload => ({
  payload,
  type: checkDisclaimer,
})
/**
 * Export a Stellar account's secret key
 */
export const createExportSecretKey = (payload: _ExportSecretKeyPayload): ExportSecretKeyPayload => ({
  payload,
  type: exportSecretKey,
})
/**
 * Failed to send a payment
 */
export const createSentPaymentError = (payload: _SentPaymentErrorPayload): SentPaymentErrorPayload => ({
  payload,
  type: sentPaymentError,
})
/**
 * Got inflation destination
 */
export const createInflationDestinationReceived = (
  payload: _InflationDestinationReceivedPayload
): InflationDestinationReceivedPayload => ({payload, type: inflationDestinationReceived})
export const createInflationDestinationReceivedError = (
  payload: _InflationDestinationReceivedPayloadError
): InflationDestinationReceivedPayloadError => ({error: true, payload, type: inflationDestinationReceived})
/**
 * Handle a SEP6 Deposit link
 */
export const createAssetDeposit = (payload: _AssetDepositPayload): AssetDepositPayload => ({
  payload,
  type: assetDeposit,
})
/**
 * Handle a SEP6 Withdraw link
 */
export const createAssetWithdraw = (payload: _AssetWithdrawPayload): AssetWithdrawPayload => ({
  payload,
  type: assetWithdraw,
})
/**
 * Initialize and navigate to the send or request form. See docs for `setBuilding*` for param semantics.
 */
export const createOpenSendRequestForm = (
  payload: _OpenSendRequestFormPayload = Object.freeze({})
): OpenSendRequestFormPayload => ({payload, type: openSendRequestForm})
/**
 * Link an existing Stellar account with this Keybase user.
 */
export const createLinkExistingAccount = (
  payload: _LinkExistingAccountPayload
): LinkExistingAccountPayload => ({payload, type: linkExistingAccount})
/**
 * Load display currency for an account
 */
export const createLoadDisplayCurrency = (
  payload: _LoadDisplayCurrencyPayload
): LoadDisplayCurrencyPayload => ({payload, type: loadDisplayCurrency})
/**
 * Load extra detail for one given payment
 */
export const createLoadPaymentDetail = (payload: _LoadPaymentDetailPayload): LoadPaymentDetailPayload => ({
  payload,
  type: loadPaymentDetail,
})
/**
 * Load valid assets for sending to user
 */
export const createLoadSendAssetChoices = (
  payload: _LoadSendAssetChoicesPayload
): LoadSendAssetChoicesPayload => ({payload, type: loadSendAssetChoices})
/**
 * Load valid display currencies to choose from
 */
export const createLoadDisplayCurrencies = (
  payload: _LoadDisplayCurrenciesPayload
): LoadDisplayCurrenciesPayload => ({payload, type: loadDisplayCurrencies})
/**
 * Load wallet disclaimer
 */
export const createLoadWalletDisclaimer = (
  payload: _LoadWalletDisclaimerPayload
): LoadWalletDisclaimerPayload => ({payload, type: loadWalletDisclaimer})
/**
 * Mark the given payment ID and anything older as read.
 */
export const createMarkAsRead = (payload: _MarkAsReadPayload): MarkAsReadPayload => ({
  payload,
  type: markAsRead,
})
/**
 * Move to the confirm screen on a built payment.
 */
export const createReviewPayment = (payload: _ReviewPaymentPayload): ReviewPaymentPayload => ({
  payload,
  type: reviewPayment,
})
/**
 * Navigate to the details page for the given transaction.
 */
export const createShowTransaction = (payload: _ShowTransactionPayload): ShowTransactionPayload => ({
  payload,
  type: showTransaction,
})
/**
 * Perform sending a payment
 */
export const createSendPayment = (payload: _SendPaymentPayload): SendPaymentPayload => ({
  payload,
  type: sendPayment,
})
/**
 * Prepare a SEP7 tx to be shown to the user for confirmation
 */
export const createSetSEP7Tx = (payload: _SetSEP7TxPayload): SetSEP7TxPayload => ({payload, type: setSEP7Tx})
/**
 * Received a fresh first page of recent payments
 */
export const createRecentPaymentsReceived = (
  payload: _RecentPaymentsReceivedPayload
): RecentPaymentsReceivedPayload => ({payload, type: recentPaymentsReceived})
/**
 * Received a new set of pending payments; replace existing ones with these
 */
export const createPendingPaymentsReceived = (
  payload: _PendingPaymentsReceivedPayload
): PendingPaymentsReceivedPayload => ({payload, type: pendingPaymentsReceived})
/**
 * Received wallet disclaimer
 */
export const createWalletDisclaimerReceived = (
  payload: _WalletDisclaimerReceivedPayload
): WalletDisclaimerReceivedPayload => ({payload, type: walletDisclaimerReceived})
/**
 * Refresh inflation destination and options
 */
export const createLoadInflationDestination = (
  payload: _LoadInflationDestinationPayload
): LoadInflationDestinationPayload => ({payload, type: loadInflationDestination})
/**
 * Refresh our list of accounts
 */
export const createLoadAccounts = (payload: _LoadAccountsPayload): LoadAccountsPayload => ({
  payload,
  type: loadAccounts,
})
/**
 * Refresh our list of assets for a given account
 */
export const createLoadAssets = (payload: _LoadAssetsPayload): LoadAssetsPayload => ({
  payload,
  type: loadAssets,
})
/**
 * Refresh our list of external tools and partner links
 */
export const createLoadExternalPartners = (
  payload: _LoadExternalPartnersPayload
): LoadExternalPartnersPayload => ({payload, type: loadExternalPartners})
/**
 * Refresh our list of payments for a given account
 */
export const createLoadPayments = (payload: _LoadPaymentsPayload): LoadPaymentsPayload => ({
  payload,
  type: loadPayments,
})
/**
 * Reject (temporarily) the Stellar account disclaimer
 */
export const createRejectDisclaimer = (payload: _RejectDisclaimerPayload): RejectDisclaimerPayload => ({
  payload,
  type: rejectDisclaimer,
})
/**
 * Request payment
 */
export const createRequestPayment = (payload: _RequestPaymentPayload): RequestPaymentPayload => ({
  payload,
  type: requestPayment,
})
/**
 * Reset to the pre-accepting-disclaimer state.
 */
export const createResetAcceptingDisclaimer = (
  payload: _ResetAcceptingDisclaimerPayload
): ResetAcceptingDisclaimerPayload => ({payload, type: resetAcceptingDisclaimer})
/**
 * Scrolled down the list of payments for a given account
 */
export const createLoadMorePayments = (payload: _LoadMorePaymentsPayload): LoadMorePaymentsPayload => ({
  payload,
  type: loadMorePayments,
})
/**
 * Select an account. Optionally navigate to the account page.
 */
export const createSelectAccount = (payload: _SelectAccountPayload): SelectAccountPayload => ({
  payload,
  type: selectAccount,
})
/**
 * Send a potential payment to the service for validation
 */
export const createBuildPayment = (payload: _BuildPaymentPayload): BuildPaymentPayload => ({
  payload,
  type: buildPayment,
})
/**
 * Set building amount
 */
export const createSetBuildingAmount = (payload: _SetBuildingAmountPayload): SetBuildingAmountPayload => ({
  payload,
  type: setBuildingAmount,
})
/**
 * Set building currency
 */
export const createSetBuildingCurrency = (
  payload: _SetBuildingCurrencyPayload
): SetBuildingCurrencyPayload => ({payload, type: setBuildingCurrency})
/**
 * Set building from
 */
export const createSetBuildingFrom = (payload: _SetBuildingFromPayload): SetBuildingFromPayload => ({
  payload,
  type: setBuildingFrom,
})
/**
 * Set building isRequest
 */
export const createSetBuildingIsRequest = (
  payload: _SetBuildingIsRequestPayload
): SetBuildingIsRequestPayload => ({payload, type: setBuildingIsRequest})
/**
 * Set building public memo
 */
export const createSetBuildingPublicMemo = (
  payload: _SetBuildingPublicMemoPayload
): SetBuildingPublicMemoPayload => ({payload, type: setBuildingPublicMemo})
/**
 * Set building recipient type
 */
export const createSetBuildingRecipientType = (
  payload: _SetBuildingRecipientTypePayload
): SetBuildingRecipientTypePayload => ({payload, type: setBuildingRecipientType})
/**
 * Set building secret note
 */
export const createSetBuildingSecretNote = (
  payload: _SetBuildingSecretNotePayload
): SetBuildingSecretNotePayload => ({payload, type: setBuildingSecretNote})
/**
 * Set building to -- depends on recipientType
 */
export const createSetBuildingTo = (payload: _SetBuildingToPayload): SetBuildingToPayload => ({
  payload,
  type: setBuildingTo,
})
/**
 * Set our inflation destination
 */
export const createSetInflationDestination = (
  payload: _SetInflationDestinationPayload
): SetInflationDestinationPayload => ({payload, type: setInflationDestination})
/**
 * Set the error field for a SEP7 validation.
 */
export const createValidateSEP7LinkError = (
  payload: _ValidateSEP7LinkErrorPayload
): ValidateSEP7LinkErrorPayload => ({payload, type: validateSEP7LinkError})
/**
 * Set whether last currency used to send was XLM
 */
export const createSetLastSentXLM = (payload: _SetLastSentXLMPayload): SetLastSentXLMPayload => ({
  payload,
  type: setLastSentXLM,
})
/**
 * Set whether the payment is ready to review
 */
export const createSetReadyToReview = (payload: _SetReadyToReviewPayload): SetReadyToReviewPayload => ({
  payload,
  type: setReadyToReview,
})
/**
 * Show the user an external message from a SEP6 action
 */
export const createSetSEP6Message = (payload: _SetSEP6MessagePayload): SetSEP6MessagePayload => ({
  payload,
  type: setSEP6Message,
})
/**
 * Signal that a payment being built is abandoned and reset the form fields to their initial states.
 */
export const createAbandonPayment = (payload: _AbandonPaymentPayload): AbandonPaymentPayload => ({
  payload,
  type: abandonPayment,
})
/**
 * Static configuration info was loaded from the service.
 */
export const createStaticConfigLoaded = (payload: _StaticConfigLoadedPayload): StaticConfigLoadedPayload => ({
  payload,
  type: staticConfigLoaded,
})
/**
 * Successfully request payment
 */
export const createRequestedPayment = (payload: _RequestedPaymentPayload): RequestedPaymentPayload => ({
  payload,
  type: requestedPayment,
})
/**
 * Successfully sent a payment
 */
export const createSentPayment = (payload: _SentPaymentPayload): SentPaymentPayload => ({
  payload,
  type: sentPayment,
})
/**
 * The service has responded with mobile only mode for Stellar account.
 */
export const createLoadedMobileOnlyMode = (
  payload: _LoadedMobileOnlyModePayload
): LoadedMobileOnlyModePayload => ({payload, type: loadedMobileOnlyMode})
/**
 * The service responded with an error or that the account name is valid.
 */
export const createValidatedAccountName = (
  payload: _ValidatedAccountNamePayload
): ValidatedAccountNamePayload => ({payload, type: validatedAccountName})
export const createValidatedAccountNameError = (
  payload: _ValidatedAccountNamePayloadError
): ValidatedAccountNamePayloadError => ({error: true, payload, type: validatedAccountName})
/**
 * The service responded with an error or that the create new account operation succeeded
 */
export const createCreatedNewAccount = (payload: _CreatedNewAccountPayload): CreatedNewAccountPayload => ({
  payload,
  type: createdNewAccount,
})
export const createCreatedNewAccountError = (
  payload: _CreatedNewAccountPayloadError
): CreatedNewAccountPayloadError => ({error: true, payload, type: createdNewAccount})
/**
 * The service responded with an error or that the link existing operation succeeded
 */
export const createLinkedExistingAccount = (
  payload: _LinkedExistingAccountPayload
): LinkedExistingAccountPayload => ({payload, type: linkedExistingAccount})
export const createLinkedExistingAccountError = (
  payload: _LinkedExistingAccountPayloadError
): LinkedExistingAccountPayloadError => ({error: true, payload, type: linkedExistingAccount})
/**
 * The service responded with an error or that the secret key is valid.
 */
export const createValidatedSecretKey = (payload: _ValidatedSecretKeyPayload): ValidatedSecretKeyPayload => ({
  payload,
  type: validatedSecretKey,
})
export const createValidatedSecretKeyError = (
  payload: _ValidatedSecretKeyPayloadError
): ValidatedSecretKeyPayloadError => ({error: true, payload, type: validatedSecretKey})
/**
 * Turn participation in airdrop on/off
 */
export const createChangeAirdrop = (payload: _ChangeAirdropPayload): ChangeAirdropPayload => ({
  payload,
  type: changeAirdrop,
})
/**
 * Update a payment with additional detail
 */
export const createPaymentDetailReceived = (
  payload: _PaymentDetailReceivedPayload
): PaymentDetailReceivedPayload => ({payload, type: paymentDetailReceived})
/**
 * Update badges in the nav
 */
export const createBadgesUpdated = (payload: _BadgesUpdatedPayload): BadgesUpdatedPayload => ({
  payload,
  type: badgesUpdated,
})
/**
 * Update display currency for a certain account
 */
export const createDisplayCurrencyReceived = (
  payload: _DisplayCurrencyReceivedPayload
): DisplayCurrencyReceivedPayload => ({payload, type: displayCurrencyReceived})
/**
 * Update our list of external tools and partners
 */
export const createExternalPartnersReceived = (
  payload: _ExternalPartnersReceivedPayload
): ExternalPartnersReceivedPayload => ({payload, type: externalPartnersReceived})
/**
 * Update our store of account data
 */
export const createAccountsReceived = (payload: _AccountsReceivedPayload): AccountsReceivedPayload => ({
  payload,
  type: accountsReceived,
})
/**
 * Update our store of assets data
 */
export const createAssetsReceived = (payload: _AssetsReceivedPayload): AssetsReceivedPayload => ({
  payload,
  type: assetsReceived,
})
/**
 * Update our store of payments data
 */
export const createPaymentsReceived = (payload: _PaymentsReceivedPayload): PaymentsReceivedPayload => ({
  payload,
  type: paymentsReceived,
})
/**
 * Update our store with a prepared payment
 */
export const createBuiltPaymentReceived = (
  payload: _BuiltPaymentReceivedPayload
): BuiltPaymentReceivedPayload => ({payload, type: builtPaymentReceived})
/**
 * Update our store with a prepared payment
 */
export const createBuiltRequestReceived = (
  payload: _BuiltRequestReceivedPayload
): BuiltRequestReceivedPayload => ({payload, type: builtRequestReceived})
/**
 * Update our store with an ID for a new building payment
 */
export const createBuildingPaymentIDReceived = (
  payload: _BuildingPaymentIDReceivedPayload
): BuildingPaymentIDReceivedPayload => ({payload, type: buildingPaymentIDReceived})
/**
 * Update our store with an exported secret key
 */
export const createSecretKeyReceived = (payload: _SecretKeyReceivedPayload): SecretKeyReceivedPayload => ({
  payload,
  type: secretKeyReceived,
})
/**
 * Update our store with the results of reviewing a built payment
 */
export const createReviewedPaymentReceived = (
  payload: _ReviewedPaymentReceivedPayload
): ReviewedPaymentReceivedPayload => ({payload, type: reviewedPaymentReceived})
/**
 * Update valid display currencies to choose from
 */
export const createDisplayCurrenciesReceived = (
  payload: _DisplayCurrenciesReceivedPayload
): DisplayCurrenciesReceivedPayload => ({payload, type: displayCurrenciesReceived})
/**
 * Update valid send assets to choose from
 */
export const createSendAssetChoicesReceived = (
  payload: _SendAssetChoicesReceivedPayload
): SendAssetChoicesReceivedPayload => ({payload, type: sendAssetChoicesReceived})
/**
 * Validate and handle a SEP7 Stellar URL link sent to the app.
 */
export const createValidateSEP7Link = (payload: _ValidateSEP7LinkPayload): ValidateSEP7LinkPayload => ({
  payload,
  type: validateSEP7Link,
})
/**
 * We received an updated account record
 */
export const createAccountUpdateReceived = (
  payload: _AccountUpdateReceivedPayload
): AccountUpdateReceivedPayload => ({payload, type: accountUpdateReceived})
/**
 * replace the current buildingAdvanced builtPaymentAdvanced data with an empty ones
 */
export const createClearBuildingAdvanced = (
  payload: _ClearBuildingAdvancedPayload
): ClearBuildingAdvancedPayload => ({payload, type: clearBuildingAdvanced})
/**
 * tell service to send this path payment
 */
export const createSendPaymentAdvanced = (
  payload: _SendPaymentAdvancedPayload
): SendPaymentAdvancedPayload => ({payload, type: sendPaymentAdvanced})
export const createAddTrustline = (payload: _AddTrustlinePayload): AddTrustlinePayload => ({
  payload,
  type: addTrustline,
})
export const createCalculateBuildingAdvanced = (
  payload: _CalculateBuildingAdvancedPayload
): CalculateBuildingAdvancedPayload => ({payload, type: calculateBuildingAdvanced})
export const createChangedTrustline = (payload: _ChangedTrustlinePayload): ChangedTrustlinePayload => ({
  payload,
  type: changedTrustline,
})
export const createChangedTrustlineError = (
  payload: _ChangedTrustlinePayloadError
): ChangedTrustlinePayloadError => ({error: true, payload, type: changedTrustline})
export const createClearTrustlineSearchResults = (
  payload: _ClearTrustlineSearchResultsPayload
): ClearTrustlineSearchResultsPayload => ({payload, type: clearTrustlineSearchResults})
export const createDeleteTrustline = (payload: _DeleteTrustlinePayload): DeleteTrustlinePayload => ({
  payload,
  type: deleteTrustline,
})
export const createHideAirdropBanner = (payload: _HideAirdropBannerPayload): HideAirdropBannerPayload => ({
  payload,
  type: hideAirdropBanner,
})
export const createRefreshTrustlineAcceptedAssets = (
  payload: _RefreshTrustlineAcceptedAssetsPayload
): RefreshTrustlineAcceptedAssetsPayload => ({payload, type: refreshTrustlineAcceptedAssets})
export const createRefreshTrustlineAcceptedAssetsByUsername = (
  payload: _RefreshTrustlineAcceptedAssetsByUsernamePayload
): RefreshTrustlineAcceptedAssetsByUsernamePayload => ({
  payload,
  type: refreshTrustlineAcceptedAssetsByUsername,
})
export const createRefreshTrustlinePopularAssets = (
  payload: _RefreshTrustlinePopularAssetsPayload
): RefreshTrustlinePopularAssetsPayload => ({payload, type: refreshTrustlinePopularAssets})
export const createSetBuildingAdvancedPublicMemo = (
  payload: _SetBuildingAdvancedPublicMemoPayload
): SetBuildingAdvancedPublicMemoPayload => ({payload, type: setBuildingAdvancedPublicMemo})
export const createSetBuildingAdvancedRecipient = (
  payload: _SetBuildingAdvancedRecipientPayload
): SetBuildingAdvancedRecipientPayload => ({payload, type: setBuildingAdvancedRecipient})
export const createSetBuildingAdvancedRecipientAmount = (
  payload: _SetBuildingAdvancedRecipientAmountPayload
): SetBuildingAdvancedRecipientAmountPayload => ({payload, type: setBuildingAdvancedRecipientAmount})
export const createSetBuildingAdvancedRecipientAsset = (
  payload: _SetBuildingAdvancedRecipientAssetPayload
): SetBuildingAdvancedRecipientAssetPayload => ({payload, type: setBuildingAdvancedRecipientAsset})
export const createSetBuildingAdvancedRecipientType = (
  payload: _SetBuildingAdvancedRecipientTypePayload
): SetBuildingAdvancedRecipientTypePayload => ({payload, type: setBuildingAdvancedRecipientType})
export const createSetBuildingAdvancedSecretNote = (
  payload: _SetBuildingAdvancedSecretNotePayload
): SetBuildingAdvancedSecretNotePayload => ({payload, type: setBuildingAdvancedSecretNote})
export const createSetBuildingAdvancedSenderAccountID = (
  payload: _SetBuildingAdvancedSenderAccountIDPayload
): SetBuildingAdvancedSenderAccountIDPayload => ({payload, type: setBuildingAdvancedSenderAccountID})
export const createSetBuildingAdvancedSenderAsset = (
  payload: _SetBuildingAdvancedSenderAssetPayload
): SetBuildingAdvancedSenderAssetPayload => ({payload, type: setBuildingAdvancedSenderAsset})
export const createSetBuiltPaymentAdvanced = (
  payload: _SetBuiltPaymentAdvancedPayload
): SetBuiltPaymentAdvancedPayload => ({payload, type: setBuiltPaymentAdvanced})
export const createSetTrustlineAcceptedAssets = (
  payload: _SetTrustlineAcceptedAssetsPayload
): SetTrustlineAcceptedAssetsPayload => ({payload, type: setTrustlineAcceptedAssets})
export const createSetTrustlineAcceptedAssetsByUsername = (
  payload: _SetTrustlineAcceptedAssetsByUsernamePayload
): SetTrustlineAcceptedAssetsByUsernamePayload => ({payload, type: setTrustlineAcceptedAssetsByUsername})
export const createSetTrustlineExpanded = (
  payload: _SetTrustlineExpandedPayload
): SetTrustlineExpandedPayload => ({payload, type: setTrustlineExpanded})
export const createSetTrustlinePopularAssets = (
  payload: _SetTrustlinePopularAssetsPayload
): SetTrustlinePopularAssetsPayload => ({payload, type: setTrustlinePopularAssets})
export const createSetTrustlineSearchResults = (
  payload: _SetTrustlineSearchResultsPayload
): SetTrustlineSearchResultsPayload => ({payload, type: setTrustlineSearchResults})
export const createSetTrustlineSearchText = (
  payload: _SetTrustlineSearchTextPayload
): SetTrustlineSearchTextPayload => ({payload, type: setTrustlineSearchText})
export const createUpdateAirdropBannerState = (
  payload: _UpdateAirdropBannerStatePayload
): UpdateAirdropBannerStatePayload => ({payload, type: updateAirdropBannerState})
export const createUpdateAirdropDetails = (
  payload: _UpdateAirdropDetailsPayload
): UpdateAirdropDetailsPayload => ({payload, type: updateAirdropDetails})
export const createUpdateAirdropState = (payload: _UpdateAirdropStatePayload): UpdateAirdropStatePayload => ({
  payload,
  type: updateAirdropState,
})
export const createUpdatedAirdropDetails = (
  payload: _UpdatedAirdropDetailsPayload
): UpdatedAirdropDetailsPayload => ({payload, type: updatedAirdropDetails})
export const createUpdatedAirdropState = (
  payload: _UpdatedAirdropStatePayload
): UpdatedAirdropStatePayload => ({payload, type: updatedAirdropState})

// Action Payloads
export type AbandonPaymentPayload = {
  readonly payload: _AbandonPaymentPayload
  readonly type: typeof abandonPayment
}
export type AcceptDisclaimerPayload = {
  readonly payload: _AcceptDisclaimerPayload
  readonly type: typeof acceptDisclaimer
}
export type AcceptSEP7PathPayload = {
  readonly payload: _AcceptSEP7PathPayload
  readonly type: typeof acceptSEP7Path
}
export type AcceptSEP7PayPayload = {
  readonly payload: _AcceptSEP7PayPayload
  readonly type: typeof acceptSEP7Pay
}
export type AcceptSEP7TxPayload = {readonly payload: _AcceptSEP7TxPayload; readonly type: typeof acceptSEP7Tx}
export type AccountUpdateReceivedPayload = {
  readonly payload: _AccountUpdateReceivedPayload
  readonly type: typeof accountUpdateReceived
}
export type AccountsReceivedPayload = {
  readonly payload: _AccountsReceivedPayload
  readonly type: typeof accountsReceived
}
export type AddTrustlinePayload = {readonly payload: _AddTrustlinePayload; readonly type: typeof addTrustline}
export type AssetDepositPayload = {readonly payload: _AssetDepositPayload; readonly type: typeof assetDeposit}
export type AssetWithdrawPayload = {
  readonly payload: _AssetWithdrawPayload
  readonly type: typeof assetWithdraw
}
export type AssetsReceivedPayload = {
  readonly payload: _AssetsReceivedPayload
  readonly type: typeof assetsReceived
}
export type BadgesUpdatedPayload = {
  readonly payload: _BadgesUpdatedPayload
  readonly type: typeof badgesUpdated
}
export type BuildPaymentPayload = {readonly payload: _BuildPaymentPayload; readonly type: typeof buildPayment}
export type BuildingPaymentIDReceivedPayload = {
  readonly payload: _BuildingPaymentIDReceivedPayload
  readonly type: typeof buildingPaymentIDReceived
}
export type BuiltPaymentReceivedPayload = {
  readonly payload: _BuiltPaymentReceivedPayload
  readonly type: typeof builtPaymentReceived
}
export type BuiltRequestReceivedPayload = {
  readonly payload: _BuiltRequestReceivedPayload
  readonly type: typeof builtRequestReceived
}
export type CalculateBuildingAdvancedPayload = {
  readonly payload: _CalculateBuildingAdvancedPayload
  readonly type: typeof calculateBuildingAdvanced
}
export type CancelPaymentPayload = {
  readonly payload: _CancelPaymentPayload
  readonly type: typeof cancelPayment
}
export type CancelRequestPayload = {
  readonly payload: _CancelRequestPayload
  readonly type: typeof cancelRequest
}
export type ChangeAccountNamePayload = {
  readonly payload: _ChangeAccountNamePayload
  readonly type: typeof changeAccountName
}
export type ChangeAirdropPayload = {
  readonly payload: _ChangeAirdropPayload
  readonly type: typeof changeAirdrop
}
export type ChangeDisplayCurrencyPayload = {
  readonly payload: _ChangeDisplayCurrencyPayload
  readonly type: typeof changeDisplayCurrency
}
export type ChangeMobileOnlyModePayload = {
  readonly payload: _ChangeMobileOnlyModePayload
  readonly type: typeof changeMobileOnlyMode
}
export type ChangedAccountNamePayload = {
  readonly payload: _ChangedAccountNamePayload
  readonly type: typeof changedAccountName
}
export type ChangedAccountNamePayloadError = {
  readonly error: true
  readonly payload: _ChangedAccountNamePayloadError
  readonly type: typeof changedAccountName
}
export type ChangedTrustlinePayload = {
  readonly payload: _ChangedTrustlinePayload
  readonly type: typeof changedTrustline
}
export type ChangedTrustlinePayloadError = {
  readonly error: true
  readonly payload: _ChangedTrustlinePayloadError
  readonly type: typeof changedTrustline
}
export type CheckDisclaimerPayload = {
  readonly payload: _CheckDisclaimerPayload
  readonly type: typeof checkDisclaimer
}
export type ClearBuildingAdvancedPayload = {
  readonly payload: _ClearBuildingAdvancedPayload
  readonly type: typeof clearBuildingAdvanced
}
export type ClearBuildingPayload = {
  readonly payload: _ClearBuildingPayload
  readonly type: typeof clearBuilding
}
export type ClearBuiltPaymentPayload = {
  readonly payload: _ClearBuiltPaymentPayload
  readonly type: typeof clearBuiltPayment
}
export type ClearBuiltRequestPayload = {
  readonly payload: _ClearBuiltRequestPayload
  readonly type: typeof clearBuiltRequest
}
export type ClearErrorsPayload = {readonly payload: _ClearErrorsPayload; readonly type: typeof clearErrors}
export type ClearTrustlineSearchResultsPayload = {
  readonly payload: _ClearTrustlineSearchResultsPayload
  readonly type: typeof clearTrustlineSearchResults
}
export type CreateNewAccountPayload = {
  readonly payload: _CreateNewAccountPayload
  readonly type: typeof createNewAccount
}
export type CreatedNewAccountPayload = {
  readonly payload: _CreatedNewAccountPayload
  readonly type: typeof createdNewAccount
}
export type CreatedNewAccountPayloadError = {
  readonly error: true
  readonly payload: _CreatedNewAccountPayloadError
  readonly type: typeof createdNewAccount
}
export type DeleteAccountPayload = {
  readonly payload: _DeleteAccountPayload
  readonly type: typeof deleteAccount
}
export type DeleteTrustlinePayload = {
  readonly payload: _DeleteTrustlinePayload
  readonly type: typeof deleteTrustline
}
export type DeletedAccountPayload = {
  readonly payload: _DeletedAccountPayload
  readonly type: typeof deletedAccount
}
export type DidSetAccountAsDefaultPayload = {
  readonly payload: _DidSetAccountAsDefaultPayload
  readonly type: typeof didSetAccountAsDefault
}
export type DisplayCurrenciesReceivedPayload = {
  readonly payload: _DisplayCurrenciesReceivedPayload
  readonly type: typeof displayCurrenciesReceived
}
export type DisplayCurrencyReceivedPayload = {
  readonly payload: _DisplayCurrencyReceivedPayload
  readonly type: typeof displayCurrencyReceived
}
export type ExitFailedPaymentPayload = {
  readonly payload: _ExitFailedPaymentPayload
  readonly type: typeof exitFailedPayment
}
export type ExportSecretKeyPayload = {
  readonly payload: _ExportSecretKeyPayload
  readonly type: typeof exportSecretKey
}
export type ExternalPartnersReceivedPayload = {
  readonly payload: _ExternalPartnersReceivedPayload
  readonly type: typeof externalPartnersReceived
}
export type HideAirdropBannerPayload = {
  readonly payload: _HideAirdropBannerPayload
  readonly type: typeof hideAirdropBanner
}
export type InflationDestinationReceivedPayload = {
  readonly payload: _InflationDestinationReceivedPayload
  readonly type: typeof inflationDestinationReceived
}
export type InflationDestinationReceivedPayloadError = {
  readonly error: true
  readonly payload: _InflationDestinationReceivedPayloadError
  readonly type: typeof inflationDestinationReceived
}
export type LinkExistingAccountPayload = {
  readonly payload: _LinkExistingAccountPayload
  readonly type: typeof linkExistingAccount
}
export type LinkedExistingAccountPayload = {
  readonly payload: _LinkedExistingAccountPayload
  readonly type: typeof linkedExistingAccount
}
export type LinkedExistingAccountPayloadError = {
  readonly error: true
  readonly payload: _LinkedExistingAccountPayloadError
  readonly type: typeof linkedExistingAccount
}
export type LoadAccountsPayload = {readonly payload: _LoadAccountsPayload; readonly type: typeof loadAccounts}
export type LoadAssetsPayload = {readonly payload: _LoadAssetsPayload; readonly type: typeof loadAssets}
export type LoadDisplayCurrenciesPayload = {
  readonly payload: _LoadDisplayCurrenciesPayload
  readonly type: typeof loadDisplayCurrencies
}
export type LoadDisplayCurrencyPayload = {
  readonly payload: _LoadDisplayCurrencyPayload
  readonly type: typeof loadDisplayCurrency
}
export type LoadExternalPartnersPayload = {
  readonly payload: _LoadExternalPartnersPayload
  readonly type: typeof loadExternalPartners
}
export type LoadInflationDestinationPayload = {
  readonly payload: _LoadInflationDestinationPayload
  readonly type: typeof loadInflationDestination
}
export type LoadMobileOnlyModePayload = {
  readonly payload: _LoadMobileOnlyModePayload
  readonly type: typeof loadMobileOnlyMode
}
export type LoadMorePaymentsPayload = {
  readonly payload: _LoadMorePaymentsPayload
  readonly type: typeof loadMorePayments
}
export type LoadPaymentDetailPayload = {
  readonly payload: _LoadPaymentDetailPayload
  readonly type: typeof loadPaymentDetail
}
export type LoadPaymentsPayload = {readonly payload: _LoadPaymentsPayload; readonly type: typeof loadPayments}
export type LoadSendAssetChoicesPayload = {
  readonly payload: _LoadSendAssetChoicesPayload
  readonly type: typeof loadSendAssetChoices
}
export type LoadWalletDisclaimerPayload = {
  readonly payload: _LoadWalletDisclaimerPayload
  readonly type: typeof loadWalletDisclaimer
}
export type LoadedMobileOnlyModePayload = {
  readonly payload: _LoadedMobileOnlyModePayload
  readonly type: typeof loadedMobileOnlyMode
}
export type MarkAsReadPayload = {readonly payload: _MarkAsReadPayload; readonly type: typeof markAsRead}
export type OpenSendRequestFormPayload = {
  readonly payload: _OpenSendRequestFormPayload
  readonly type: typeof openSendRequestForm
}
export type PaymentDetailReceivedPayload = {
  readonly payload: _PaymentDetailReceivedPayload
  readonly type: typeof paymentDetailReceived
}
export type PaymentsReceivedPayload = {
  readonly payload: _PaymentsReceivedPayload
  readonly type: typeof paymentsReceived
}
export type PendingPaymentsReceivedPayload = {
  readonly payload: _PendingPaymentsReceivedPayload
  readonly type: typeof pendingPaymentsReceived
}
export type RecentPaymentsReceivedPayload = {
  readonly payload: _RecentPaymentsReceivedPayload
  readonly type: typeof recentPaymentsReceived
}
export type RefreshTrustlineAcceptedAssetsByUsernamePayload = {
  readonly payload: _RefreshTrustlineAcceptedAssetsByUsernamePayload
  readonly type: typeof refreshTrustlineAcceptedAssetsByUsername
}
export type RefreshTrustlineAcceptedAssetsPayload = {
  readonly payload: _RefreshTrustlineAcceptedAssetsPayload
  readonly type: typeof refreshTrustlineAcceptedAssets
}
export type RefreshTrustlinePopularAssetsPayload = {
  readonly payload: _RefreshTrustlinePopularAssetsPayload
  readonly type: typeof refreshTrustlinePopularAssets
}
export type RejectDisclaimerPayload = {
  readonly payload: _RejectDisclaimerPayload
  readonly type: typeof rejectDisclaimer
}
export type RequestPaymentPayload = {
  readonly payload: _RequestPaymentPayload
  readonly type: typeof requestPayment
}
export type RequestedPaymentPayload = {
  readonly payload: _RequestedPaymentPayload
  readonly type: typeof requestedPayment
}
export type ResetAcceptingDisclaimerPayload = {
  readonly payload: _ResetAcceptingDisclaimerPayload
  readonly type: typeof resetAcceptingDisclaimer
}
export type ReviewPaymentPayload = {
  readonly payload: _ReviewPaymentPayload
  readonly type: typeof reviewPayment
}
export type ReviewedPaymentReceivedPayload = {
  readonly payload: _ReviewedPaymentReceivedPayload
  readonly type: typeof reviewedPaymentReceived
}
export type SecretKeyReceivedPayload = {
  readonly payload: _SecretKeyReceivedPayload
  readonly type: typeof secretKeyReceived
}
export type SecretKeySeenPayload = {
  readonly payload: _SecretKeySeenPayload
  readonly type: typeof secretKeySeen
}
export type SelectAccountPayload = {
  readonly payload: _SelectAccountPayload
  readonly type: typeof selectAccount
}
export type SendAssetChoicesReceivedPayload = {
  readonly payload: _SendAssetChoicesReceivedPayload
  readonly type: typeof sendAssetChoicesReceived
}
export type SendPaymentAdvancedPayload = {
  readonly payload: _SendPaymentAdvancedPayload
  readonly type: typeof sendPaymentAdvanced
}
export type SendPaymentPayload = {readonly payload: _SendPaymentPayload; readonly type: typeof sendPayment}
export type SentPaymentErrorPayload = {
  readonly payload: _SentPaymentErrorPayload
  readonly type: typeof sentPaymentError
}
export type SentPaymentPayload = {readonly payload: _SentPaymentPayload; readonly type: typeof sentPayment}
export type SetAccountAsDefaultPayload = {
  readonly payload: _SetAccountAsDefaultPayload
  readonly type: typeof setAccountAsDefault
}
export type SetBuildingAdvancedPublicMemoPayload = {
  readonly payload: _SetBuildingAdvancedPublicMemoPayload
  readonly type: typeof setBuildingAdvancedPublicMemo
}
export type SetBuildingAdvancedRecipientAmountPayload = {
  readonly payload: _SetBuildingAdvancedRecipientAmountPayload
  readonly type: typeof setBuildingAdvancedRecipientAmount
}
export type SetBuildingAdvancedRecipientAssetPayload = {
  readonly payload: _SetBuildingAdvancedRecipientAssetPayload
  readonly type: typeof setBuildingAdvancedRecipientAsset
}
export type SetBuildingAdvancedRecipientPayload = {
  readonly payload: _SetBuildingAdvancedRecipientPayload
  readonly type: typeof setBuildingAdvancedRecipient
}
export type SetBuildingAdvancedRecipientTypePayload = {
  readonly payload: _SetBuildingAdvancedRecipientTypePayload
  readonly type: typeof setBuildingAdvancedRecipientType
}
export type SetBuildingAdvancedSecretNotePayload = {
  readonly payload: _SetBuildingAdvancedSecretNotePayload
  readonly type: typeof setBuildingAdvancedSecretNote
}
export type SetBuildingAdvancedSenderAccountIDPayload = {
  readonly payload: _SetBuildingAdvancedSenderAccountIDPayload
  readonly type: typeof setBuildingAdvancedSenderAccountID
}
export type SetBuildingAdvancedSenderAssetPayload = {
  readonly payload: _SetBuildingAdvancedSenderAssetPayload
  readonly type: typeof setBuildingAdvancedSenderAsset
}
export type SetBuildingAmountPayload = {
  readonly payload: _SetBuildingAmountPayload
  readonly type: typeof setBuildingAmount
}
export type SetBuildingCurrencyPayload = {
  readonly payload: _SetBuildingCurrencyPayload
  readonly type: typeof setBuildingCurrency
}
export type SetBuildingFromPayload = {
  readonly payload: _SetBuildingFromPayload
  readonly type: typeof setBuildingFrom
}
export type SetBuildingIsRequestPayload = {
  readonly payload: _SetBuildingIsRequestPayload
  readonly type: typeof setBuildingIsRequest
}
export type SetBuildingPublicMemoPayload = {
  readonly payload: _SetBuildingPublicMemoPayload
  readonly type: typeof setBuildingPublicMemo
}
export type SetBuildingRecipientTypePayload = {
  readonly payload: _SetBuildingRecipientTypePayload
  readonly type: typeof setBuildingRecipientType
}
export type SetBuildingSecretNotePayload = {
  readonly payload: _SetBuildingSecretNotePayload
  readonly type: typeof setBuildingSecretNote
}
export type SetBuildingToPayload = {
  readonly payload: _SetBuildingToPayload
  readonly type: typeof setBuildingTo
}
export type SetBuiltPaymentAdvancedPayload = {
  readonly payload: _SetBuiltPaymentAdvancedPayload
  readonly type: typeof setBuiltPaymentAdvanced
}
export type SetInflationDestinationPayload = {
  readonly payload: _SetInflationDestinationPayload
  readonly type: typeof setInflationDestination
}
export type SetLastSentXLMPayload = {
  readonly payload: _SetLastSentXLMPayload
  readonly type: typeof setLastSentXLM
}
export type SetReadyToReviewPayload = {
  readonly payload: _SetReadyToReviewPayload
  readonly type: typeof setReadyToReview
}
export type SetSEP6MessagePayload = {
  readonly payload: _SetSEP6MessagePayload
  readonly type: typeof setSEP6Message
}
export type SetSEP7TxPayload = {readonly payload: _SetSEP7TxPayload; readonly type: typeof setSEP7Tx}
export type SetTrustlineAcceptedAssetsByUsernamePayload = {
  readonly payload: _SetTrustlineAcceptedAssetsByUsernamePayload
  readonly type: typeof setTrustlineAcceptedAssetsByUsername
}
export type SetTrustlineAcceptedAssetsPayload = {
  readonly payload: _SetTrustlineAcceptedAssetsPayload
  readonly type: typeof setTrustlineAcceptedAssets
}
export type SetTrustlineExpandedPayload = {
  readonly payload: _SetTrustlineExpandedPayload
  readonly type: typeof setTrustlineExpanded
}
export type SetTrustlinePopularAssetsPayload = {
  readonly payload: _SetTrustlinePopularAssetsPayload
  readonly type: typeof setTrustlinePopularAssets
}
export type SetTrustlineSearchResultsPayload = {
  readonly payload: _SetTrustlineSearchResultsPayload
  readonly type: typeof setTrustlineSearchResults
}
export type SetTrustlineSearchTextPayload = {
  readonly payload: _SetTrustlineSearchTextPayload
  readonly type: typeof setTrustlineSearchText
}
export type ShowTransactionPayload = {
  readonly payload: _ShowTransactionPayload
  readonly type: typeof showTransaction
}
export type StaticConfigLoadedPayload = {
  readonly payload: _StaticConfigLoadedPayload
  readonly type: typeof staticConfigLoaded
}
export type UpdateAirdropBannerStatePayload = {
  readonly payload: _UpdateAirdropBannerStatePayload
  readonly type: typeof updateAirdropBannerState
}
export type UpdateAirdropDetailsPayload = {
  readonly payload: _UpdateAirdropDetailsPayload
  readonly type: typeof updateAirdropDetails
}
export type UpdateAirdropStatePayload = {
  readonly payload: _UpdateAirdropStatePayload
  readonly type: typeof updateAirdropState
}
export type UpdatedAirdropDetailsPayload = {
  readonly payload: _UpdatedAirdropDetailsPayload
  readonly type: typeof updatedAirdropDetails
}
export type UpdatedAirdropStatePayload = {
  readonly payload: _UpdatedAirdropStatePayload
  readonly type: typeof updatedAirdropState
}
export type ValidateAccountNamePayload = {
  readonly payload: _ValidateAccountNamePayload
  readonly type: typeof validateAccountName
}
export type ValidateSEP7LinkErrorPayload = {
  readonly payload: _ValidateSEP7LinkErrorPayload
  readonly type: typeof validateSEP7LinkError
}
export type ValidateSEP7LinkPayload = {
  readonly payload: _ValidateSEP7LinkPayload
  readonly type: typeof validateSEP7Link
}
export type ValidateSecretKeyPayload = {
  readonly payload: _ValidateSecretKeyPayload
  readonly type: typeof validateSecretKey
}
export type ValidatedAccountNamePayload = {
  readonly payload: _ValidatedAccountNamePayload
  readonly type: typeof validatedAccountName
}
export type ValidatedAccountNamePayloadError = {
  readonly error: true
  readonly payload: _ValidatedAccountNamePayloadError
  readonly type: typeof validatedAccountName
}
export type ValidatedSecretKeyPayload = {
  readonly payload: _ValidatedSecretKeyPayload
  readonly type: typeof validatedSecretKey
}
export type ValidatedSecretKeyPayloadError = {
  readonly error: true
  readonly payload: _ValidatedSecretKeyPayloadError
  readonly type: typeof validatedSecretKey
}
export type WalletDisclaimerReceivedPayload = {
  readonly payload: _WalletDisclaimerReceivedPayload
  readonly type: typeof walletDisclaimerReceived
}

// All Actions
// prettier-ignore
export type Actions =
  | AbandonPaymentPayload
  | AcceptDisclaimerPayload
  | AcceptSEP7PathPayload
  | AcceptSEP7PayPayload
  | AcceptSEP7TxPayload
  | AccountUpdateReceivedPayload
  | AccountsReceivedPayload
  | AddTrustlinePayload
  | AssetDepositPayload
  | AssetWithdrawPayload
  | AssetsReceivedPayload
  | BadgesUpdatedPayload
  | BuildPaymentPayload
  | BuildingPaymentIDReceivedPayload
  | BuiltPaymentReceivedPayload
  | BuiltRequestReceivedPayload
  | CalculateBuildingAdvancedPayload
  | CancelPaymentPayload
  | CancelRequestPayload
  | ChangeAccountNamePayload
  | ChangeAirdropPayload
  | ChangeDisplayCurrencyPayload
  | ChangeMobileOnlyModePayload
  | ChangedAccountNamePayload
  | ChangedAccountNamePayloadError
  | ChangedTrustlinePayload
  | ChangedTrustlinePayloadError
  | CheckDisclaimerPayload
  | ClearBuildingAdvancedPayload
  | ClearBuildingPayload
  | ClearBuiltPaymentPayload
  | ClearBuiltRequestPayload
  | ClearErrorsPayload
  | ClearTrustlineSearchResultsPayload
  | CreateNewAccountPayload
  | CreatedNewAccountPayload
  | CreatedNewAccountPayloadError
  | DeleteAccountPayload
  | DeleteTrustlinePayload
  | DeletedAccountPayload
  | DidSetAccountAsDefaultPayload
  | DisplayCurrenciesReceivedPayload
  | DisplayCurrencyReceivedPayload
  | ExitFailedPaymentPayload
  | ExportSecretKeyPayload
  | ExternalPartnersReceivedPayload
  | HideAirdropBannerPayload
  | InflationDestinationReceivedPayload
  | InflationDestinationReceivedPayloadError
  | LinkExistingAccountPayload
  | LinkedExistingAccountPayload
  | LinkedExistingAccountPayloadError
  | LoadAccountsPayload
  | LoadAssetsPayload
  | LoadDisplayCurrenciesPayload
  | LoadDisplayCurrencyPayload
  | LoadExternalPartnersPayload
  | LoadInflationDestinationPayload
  | LoadMobileOnlyModePayload
  | LoadMorePaymentsPayload
  | LoadPaymentDetailPayload
  | LoadPaymentsPayload
  | LoadSendAssetChoicesPayload
  | LoadWalletDisclaimerPayload
  | LoadedMobileOnlyModePayload
  | MarkAsReadPayload
  | OpenSendRequestFormPayload
  | PaymentDetailReceivedPayload
  | PaymentsReceivedPayload
  | PendingPaymentsReceivedPayload
  | RecentPaymentsReceivedPayload
  | RefreshTrustlineAcceptedAssetsByUsernamePayload
  | RefreshTrustlineAcceptedAssetsPayload
  | RefreshTrustlinePopularAssetsPayload
  | RejectDisclaimerPayload
  | RequestPaymentPayload
  | RequestedPaymentPayload
  | ResetAcceptingDisclaimerPayload
  | ReviewPaymentPayload
  | ReviewedPaymentReceivedPayload
  | SecretKeyReceivedPayload
  | SecretKeySeenPayload
  | SelectAccountPayload
  | SendAssetChoicesReceivedPayload
  | SendPaymentAdvancedPayload
  | SendPaymentPayload
  | SentPaymentErrorPayload
  | SentPaymentPayload
  | SetAccountAsDefaultPayload
  | SetBuildingAdvancedPublicMemoPayload
  | SetBuildingAdvancedRecipientAmountPayload
  | SetBuildingAdvancedRecipientAssetPayload
  | SetBuildingAdvancedRecipientPayload
  | SetBuildingAdvancedRecipientTypePayload
  | SetBuildingAdvancedSecretNotePayload
  | SetBuildingAdvancedSenderAccountIDPayload
  | SetBuildingAdvancedSenderAssetPayload
  | SetBuildingAmountPayload
  | SetBuildingCurrencyPayload
  | SetBuildingFromPayload
  | SetBuildingIsRequestPayload
  | SetBuildingPublicMemoPayload
  | SetBuildingRecipientTypePayload
  | SetBuildingSecretNotePayload
  | SetBuildingToPayload
  | SetBuiltPaymentAdvancedPayload
  | SetInflationDestinationPayload
  | SetLastSentXLMPayload
  | SetReadyToReviewPayload
  | SetSEP6MessagePayload
  | SetSEP7TxPayload
  | SetTrustlineAcceptedAssetsByUsernamePayload
  | SetTrustlineAcceptedAssetsPayload
  | SetTrustlineExpandedPayload
  | SetTrustlinePopularAssetsPayload
  | SetTrustlineSearchResultsPayload
  | SetTrustlineSearchTextPayload
  | ShowTransactionPayload
  | StaticConfigLoadedPayload
  | UpdateAirdropBannerStatePayload
  | UpdateAirdropDetailsPayload
  | UpdateAirdropStatePayload
  | UpdatedAirdropDetailsPayload
  | UpdatedAirdropStatePayload
  | ValidateAccountNamePayload
  | ValidateSEP7LinkErrorPayload
  | ValidateSEP7LinkPayload
  | ValidateSecretKeyPayload
  | ValidatedAccountNamePayload
  | ValidatedAccountNamePayloadError
  | ValidatedSecretKeyPayload
  | ValidatedSecretKeyPayloadError
  | WalletDisclaimerReceivedPayload
  | {type: 'common:resetStore', payload: {}}
