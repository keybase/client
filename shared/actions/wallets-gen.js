// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define,import/no-duplicates */

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
export const accountUpdateReceived = 'wallets:accountUpdateReceived'
export const accountsReceived = 'wallets:accountsReceived'
export const addNewPayment = 'wallets:addNewPayment'
export const assetsReceived = 'wallets:assetsReceived'
export const badgesUpdated = 'wallets:badgesUpdated'
export const buildPayment = 'wallets:buildPayment'
export const buildingPaymentIDReceived = 'wallets:buildingPaymentIDReceived'
export const builtPaymentReceived = 'wallets:builtPaymentReceived'
export const builtRequestReceived = 'wallets:builtRequestReceived'
export const cancelPayment = 'wallets:cancelPayment'
export const cancelRequest = 'wallets:cancelRequest'
export const changeAccountName = 'wallets:changeAccountName'
export const changeDisplayCurrency = 'wallets:changeDisplayCurrency'
export const changeMobileOnlyMode = 'wallets:changeMobileOnlyMode'
export const changedAccountName = 'wallets:changedAccountName'
export const checkDisclaimer = 'wallets:checkDisclaimer'
export const clearBuilding = 'wallets:clearBuilding'
export const clearBuiltPayment = 'wallets:clearBuiltPayment'
export const clearBuiltRequest = 'wallets:clearBuiltRequest'
export const clearErrors = 'wallets:clearErrors'
export const clearNewPayments = 'wallets:clearNewPayments'
export const createNewAccount = 'wallets:createNewAccount'
export const createdNewAccount = 'wallets:createdNewAccount'
export const deleteAccount = 'wallets:deleteAccount'
export const deletedAccount = 'wallets:deletedAccount'
export const didSetAccountAsDefault = 'wallets:didSetAccountAsDefault'
export const displayCurrenciesReceived = 'wallets:displayCurrenciesReceived'
export const displayCurrencyReceived = 'wallets:displayCurrencyReceived'
export const exitFailedPayment = 'wallets:exitFailedPayment'
export const exportSecretKey = 'wallets:exportSecretKey'
export const inflationDestinationReceived = 'wallets:inflationDestinationReceived'
export const linkExistingAccount = 'wallets:linkExistingAccount'
export const linkedExistingAccount = 'wallets:linkedExistingAccount'
export const loadAccounts = 'wallets:loadAccounts'
export const loadAssets = 'wallets:loadAssets'
export const loadDisplayCurrencies = 'wallets:loadDisplayCurrencies'
export const loadDisplayCurrency = 'wallets:loadDisplayCurrency'
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
export const sentPayment = 'wallets:sentPayment'
export const sentPaymentError = 'wallets:sentPaymentError'
export const setAccountAsDefault = 'wallets:setAccountAsDefault'
export const setBuildingAmount = 'wallets:setBuildingAmount'
export const setBuildingCurrency = 'wallets:setBuildingCurrency'
export const setBuildingFrom = 'wallets:setBuildingFrom'
export const setBuildingIsRequest = 'wallets:setBuildingIsRequest'
export const setBuildingPublicMemo = 'wallets:setBuildingPublicMemo'
export const setBuildingRecipientType = 'wallets:setBuildingRecipientType'
export const setBuildingSecretNote = 'wallets:setBuildingSecretNote'
export const setBuildingTo = 'wallets:setBuildingTo'
export const setInflationDestination = 'wallets:setInflationDestination'
export const setLastSentXLM = 'wallets:setLastSentXLM'
export const setReadyToReview = 'wallets:setReadyToReview'
export const validateAccountName = 'wallets:validateAccountName'
export const validateSecretKey = 'wallets:validateSecretKey'
export const validatedAccountName = 'wallets:validatedAccountName'
export const validatedSecretKey = 'wallets:validatedSecretKey'
export const walletDisclaimerReceived = 'wallets:walletDisclaimerReceived'

// Payload Types
type _AbandonPaymentPayload = void
type _AcceptDisclaimerPayload = void
type _AccountUpdateReceivedPayload = $ReadOnly<{|account: Types.Account|}>
type _AccountsReceivedPayload = $ReadOnly<{|accounts: Array<Types.Account>|}>
type _AddNewPaymentPayload = $ReadOnly<{|accountID: Types.AccountID, paymentID: Types.PaymentID|}>
type _AssetsReceivedPayload = $ReadOnly<{|accountID: Types.AccountID, assets: Array<Types.Assets>|}>
type _BadgesUpdatedPayload = $ReadOnly<{|accounts: Array<RPCTypes.WalletAccountInfo>|}>
type _BuildPaymentPayload = void
type _BuildingPaymentIDReceivedPayload = $ReadOnly<{|bid: string|}>
type _BuiltPaymentReceivedPayload = $ReadOnly<{|build: Types.BuiltPayment, forBuildCounter: number|}>
type _BuiltRequestReceivedPayload = $ReadOnly<{|build: Types.BuiltRequest, forBuildCounter: number|}>
type _CancelPaymentPayload = $ReadOnly<{|showAccount?: boolean, paymentID: Types.PaymentID|}>
type _CancelRequestPayload = $ReadOnly<{|conversationIDKey?: ChatTypes.ConversationIDKey, ordinal?: ChatTypes.Ordinal, requestID: StellarRPCTypes.KeybaseRequestID|}>
type _ChangeAccountNamePayload = $ReadOnly<{|accountID: Types.AccountID, name: string|}>
type _ChangeDisplayCurrencyPayload = $ReadOnly<{|accountID: Types.AccountID, code: Types.CurrencyCode|}>
type _ChangeMobileOnlyModePayload = $ReadOnly<{|accountID: Types.AccountID, enabled: boolean|}>
type _ChangedAccountNamePayload = $ReadOnly<{|accountID: Types.AccountID|}>
type _ChangedAccountNamePayloadError = $ReadOnly<{|name: string, error: string|}>
type _CheckDisclaimerPayload = $ReadOnly<{|nextScreen: Types.NextScreenAfterAcceptance|}>
type _ClearBuildingPayload = void
type _ClearBuiltPaymentPayload = void
type _ClearBuiltRequestPayload = void
type _ClearErrorsPayload = void
type _ClearNewPaymentsPayload = $ReadOnly<{|accountID: Types.AccountID|}>
type _CreateNewAccountPayload = $ReadOnly<{|name: string, showOnCreation?: boolean, setBuildingTo?: boolean|}>
type _CreatedNewAccountPayload = $ReadOnly<{|accountID: Types.AccountID, showOnCreation?: boolean, setBuildingTo?: boolean|}>
type _CreatedNewAccountPayloadError = $ReadOnly<{|name: string, error: string|}>
type _DeleteAccountPayload = $ReadOnly<{|accountID: Types.AccountID|}>
type _DeletedAccountPayload = void
type _DidSetAccountAsDefaultPayload = $ReadOnly<{|accountID: Types.AccountID|}>
type _DisplayCurrenciesReceivedPayload = $ReadOnly<{|currencies: Array<Types.Currency>|}>
type _DisplayCurrencyReceivedPayload = $ReadOnly<{|accountID: ?Types.AccountID, currency: Types.Currency, setBuildingCurrency?: boolean|}>
type _ExitFailedPaymentPayload = void
type _ExportSecretKeyPayload = $ReadOnly<{|accountID: Types.AccountID|}>
type _InflationDestinationReceivedPayload = $ReadOnly<{|accountID: Types.AccountID, selected: Types.AccountInflationDestination, options?: Array<Types.InflationDestination>|}>
type _InflationDestinationReceivedPayloadError = $ReadOnly<{|error: string|}>
type _LinkExistingAccountPayload = $ReadOnly<{|name: string, secretKey: HiddenString, showOnCreation?: boolean, setBuildingTo?: boolean|}>
type _LinkedExistingAccountPayload = $ReadOnly<{|accountID: Types.AccountID, showOnCreation?: boolean, setBuildingTo?: boolean|}>
type _LinkedExistingAccountPayloadError = $ReadOnly<{|name: string, secretKey: HiddenString, error: string|}>
type _LoadAccountsPayload = $ReadOnly<{|reason: 'initial-load' | 'open-send-req-form'|}>
type _LoadAssetsPayload = $ReadOnly<{|accountID: Types.AccountID|}>
type _LoadDisplayCurrenciesPayload = void
type _LoadDisplayCurrencyPayload = $ReadOnly<{|accountID: ?Types.AccountID, setBuildingCurrency?: boolean|}>
type _LoadInflationDestinationPayload = $ReadOnly<{|accountID: Types.AccountID|}>
type _LoadMobileOnlyModePayload = $ReadOnly<{|accountID: Types.AccountID|}>
type _LoadMorePaymentsPayload = $ReadOnly<{|accountID: Types.AccountID|}>
type _LoadPaymentDetailPayload = $ReadOnly<{|accountID: Types.AccountID, paymentID: Types.PaymentID|}>
type _LoadPaymentsPayload = $ReadOnly<{|accountID: Types.AccountID|}>
type _LoadSendAssetChoicesPayload = $ReadOnly<{|from: Types.AccountID, to: string|}>
type _LoadWalletDisclaimerPayload = void
type _LoadedMobileOnlyModePayload = $ReadOnly<{|accountID: Types.AccountID, enabled: boolean|}>
type _MarkAsReadPayload = $ReadOnly<{|accountID: Types.AccountID, mostRecentID: Types.PaymentID|}>
type _OpenSendRequestFormPayload = $ReadOnly<{|amount?: string, currency?: string, from?: Types.AccountID, isRequest?: boolean, publicMemo?: HiddenString, recipientType?: Types.CounterpartyType, secretNote?: HiddenString, to?: string|}>
type _PaymentDetailReceivedPayload = $ReadOnly<{|accountID: Types.AccountID, payment: Types.PaymentDetail|}>
type _PaymentsReceivedPayload = $ReadOnly<{|accountID: Types.AccountID, paymentCursor: ?StellarRPCTypes.PageCursor, oldestUnread: Types.PaymentID, payments: Array<Types.PaymentResult>, pending: Array<Types.PaymentResult>|}>
type _PendingPaymentsReceivedPayload = $ReadOnly<{|accountID: Types.AccountID, pending: Array<Types.PaymentResult>|}>
type _RecentPaymentsReceivedPayload = $ReadOnly<{|accountID: Types.AccountID, paymentCursor: ?StellarRPCTypes.PageCursor, oldestUnread: Types.PaymentID, payments: Array<Types.PaymentResult>|}>
type _RejectDisclaimerPayload = void
type _RequestPaymentPayload = void
type _RequestedPaymentPayload = $ReadOnly<{|kbRqID: HiddenString, lastSentXLM: boolean, requestee: string|}>
type _ResetAcceptingDisclaimerPayload = void
type _ReviewPaymentPayload = void
type _ReviewedPaymentReceivedPayload = $ReadOnly<{|bid: string, reviewID: number, seqno: number, nextButton: string, banners?: ?Array<StellarRPCTypes.SendBannerLocal>|}>
type _SecretKeyReceivedPayload = $ReadOnly<{|accountID: Types.AccountID, secretKey: HiddenString|}>
type _SecretKeySeenPayload = $ReadOnly<{|accountID: Types.AccountID|}>
type _SelectAccountPayload = $ReadOnly<{|accountID: Types.AccountID, reason: 'user-selected' | 'auto-selected' | 'from-chat', show?: boolean|}>
type _SendAssetChoicesReceivedPayload = $ReadOnly<{|sendAssetChoices: Array<StellarRPCTypes.SendAssetChoiceLocal>|}>
type _SendPaymentPayload = void
type _SentPaymentErrorPayload = $ReadOnly<{|error: string|}>
type _SentPaymentPayload = $ReadOnly<{|kbTxID: HiddenString, lastSentXLM: boolean|}>
type _SetAccountAsDefaultPayload = $ReadOnly<{|accountID: Types.AccountID|}>
type _SetBuildingAmountPayload = $ReadOnly<{|amount: string|}>
type _SetBuildingCurrencyPayload = $ReadOnly<{|currency: string|}>
type _SetBuildingFromPayload = $ReadOnly<{|from: Types.AccountID|}>
type _SetBuildingIsRequestPayload = $ReadOnly<{|isRequest: boolean|}>
type _SetBuildingPublicMemoPayload = $ReadOnly<{|publicMemo: HiddenString|}>
type _SetBuildingRecipientTypePayload = $ReadOnly<{|recipientType: Types.CounterpartyType|}>
type _SetBuildingSecretNotePayload = $ReadOnly<{|secretNote: HiddenString|}>
type _SetBuildingToPayload = $ReadOnly<{|to: string|}>
type _SetInflationDestinationPayload = $ReadOnly<{|accountID: Types.AccountID, destination: Types.AccountID, name: string|}>
type _SetLastSentXLMPayload = $ReadOnly<{|lastSentXLM: boolean, writeFile: boolean|}>
type _SetReadyToReviewPayload = $ReadOnly<{|readyToReview: boolean|}>
type _ValidateAccountNamePayload = $ReadOnly<{|name: string|}>
type _ValidateSecretKeyPayload = $ReadOnly<{|secretKey: HiddenString|}>
type _ValidatedAccountNamePayload = $ReadOnly<{|name: string|}>
type _ValidatedAccountNamePayloadError = $ReadOnly<{|name: string, error: string|}>
type _ValidatedSecretKeyPayload = $ReadOnly<{|secretKey: HiddenString|}>
type _ValidatedSecretKeyPayloadError = $ReadOnly<{|secretKey: HiddenString, error: string|}>
type _WalletDisclaimerReceivedPayload = $ReadOnly<{|accepted: boolean|}>

// Action Creators
/**
 * A response from the service after an account is deleted.
 */
export const createDeletedAccount = (payload: _DeletedAccountPayload) => ({payload, type: deletedAccount})
/**
 * A response from the service after an account is set as the default
 */
export const createDidSetAccountAsDefault = (payload: _DidSetAccountAsDefaultPayload) => ({payload, type: didSetAccountAsDefault})
/**
 * A response from the service after an account's name is changed
 */
export const createChangedAccountName = (payload: _ChangedAccountNamePayload) => ({payload, type: changedAccountName})
export const createChangedAccountNameError = (payload: _ChangedAccountNamePayloadError) => ({error: true, payload, type: changedAccountName})
/**
 * Accept the Stellar account disclaimer
 */
export const createAcceptDisclaimer = (payload: _AcceptDisclaimerPayload) => ({payload, type: acceptDisclaimer})
/**
 * Add a new wallet to your account
 */
export const createCreateNewAccount = (payload: _CreateNewAccountPayload) => ({payload, type: createNewAccount})
/**
 * Ask the service for current mobile only mode for Stellar account.
 */
export const createLoadMobileOnlyMode = (payload: _LoadMobileOnlyModePayload) => ({payload, type: loadMobileOnlyMode})
/**
 * Ask the service to validate an account name.
 */
export const createValidateAccountName = (payload: _ValidateAccountNamePayload) => ({payload, type: validateAccountName})
/**
 * Ask the service to validate an account secret key.
 */
export const createValidateSecretKey = (payload: _ValidateSecretKeyPayload) => ({payload, type: validateSecretKey})
/**
 * Cancel a payment. Valid for payments of status 'claimable'. If showAccount is true, nav to the currently selected account when done.
 */
export const createCancelPayment = (payload: _CancelPaymentPayload) => ({payload, type: cancelPayment})
/**
 * Cancel a request. Optionally delete an associated message
 */
export const createCancelRequest = (payload: _CancelRequestPayload) => ({payload, type: cancelRequest})
/**
 * Change display currency for an account
 */
export const createChangeDisplayCurrency = (payload: _ChangeDisplayCurrencyPayload) => ({payload, type: changeDisplayCurrency})
/**
 * Change mobile only mode for Stellar account.
 */
export const createChangeMobileOnlyMode = (payload: _ChangeMobileOnlyModePayload) => ({payload, type: changeMobileOnlyMode})
/**
 * Change the default account
 */
export const createSetAccountAsDefault = (payload: _SetAccountAsDefaultPayload) => ({payload, type: setAccountAsDefault})
/**
 * Change the name of an account
 */
export const createChangeAccountName = (payload: _ChangeAccountNamePayload) => ({payload, type: changeAccountName})
/**
 * Clear a payment or request that was being prepared
 */
export const createClearBuilding = (payload: _ClearBuildingPayload) => ({payload, type: clearBuilding})
/**
 * Clear a prepared payment once it has been sent or canceled
 */
export const createClearBuiltPayment = (payload: _ClearBuiltPaymentPayload) => ({payload, type: clearBuiltPayment})
/**
 * Clear a prepared request once it has been sent or canceled
 */
export const createClearBuiltRequest = (payload: _ClearBuiltRequestPayload) => ({payload, type: clearBuiltRequest})
/**
 * Clear errors from the store at times like opening or closing a form dialog.
 */
export const createClearErrors = (payload: _ClearErrorsPayload) => ({payload, type: clearErrors})
/**
 * Clear exported secret keys from our store once they've been seen
 */
export const createSecretKeySeen = (payload: _SecretKeySeenPayload) => ({payload, type: secretKeySeen})
/**
 * Clear our idea of which payments have not been seen by the user yet
 */
export const createClearNewPayments = (payload: _ClearNewPaymentsPayload) => ({payload, type: clearNewPayments})
/**
 * Close the send form and show the user their transactions so they can review.
 */
export const createExitFailedPayment = (payload: _ExitFailedPaymentPayload) => ({payload, type: exitFailedPayment})
/**
 * Delete an account
 */
export const createDeleteAccount = (payload: _DeleteAccountPayload) => ({payload, type: deleteAccount})
/**
 * Discover whether the user has accepted the Stellar disclaimer
 */
export const createCheckDisclaimer = (payload: _CheckDisclaimerPayload) => ({payload, type: checkDisclaimer})
/**
 * Export a Stellar account's secret key
 */
export const createExportSecretKey = (payload: _ExportSecretKeyPayload) => ({payload, type: exportSecretKey})
/**
 * Failed to send a payment
 */
export const createSentPaymentError = (payload: _SentPaymentErrorPayload) => ({payload, type: sentPaymentError})
/**
 * Got inflation destination
 */
export const createInflationDestinationReceived = (payload: _InflationDestinationReceivedPayload) => ({payload, type: inflationDestinationReceived})
export const createInflationDestinationReceivedError = (payload: _InflationDestinationReceivedPayloadError) => ({error: true, payload, type: inflationDestinationReceived})
/**
 * Initialize and navigate to the send or request form. See docs for `setBuilding*` for param semantics.
 */
export const createOpenSendRequestForm = (payload: _OpenSendRequestFormPayload) => ({payload, type: openSendRequestForm})
/**
 * Link an existing Stellar account with this Keybase user.
 */
export const createLinkExistingAccount = (payload: _LinkExistingAccountPayload) => ({payload, type: linkExistingAccount})
/**
 * Load display currency for an account
 */
export const createLoadDisplayCurrency = (payload: _LoadDisplayCurrencyPayload) => ({payload, type: loadDisplayCurrency})
/**
 * Load extra detail for one given payment
 */
export const createLoadPaymentDetail = (payload: _LoadPaymentDetailPayload) => ({payload, type: loadPaymentDetail})
/**
 * Load valid assets for sending to user
 */
export const createLoadSendAssetChoices = (payload: _LoadSendAssetChoicesPayload) => ({payload, type: loadSendAssetChoices})
/**
 * Load valid display currencies to choose from
 */
export const createLoadDisplayCurrencies = (payload: _LoadDisplayCurrenciesPayload) => ({payload, type: loadDisplayCurrencies})
/**
 * Load wallet disclaimer
 */
export const createLoadWalletDisclaimer = (payload: _LoadWalletDisclaimerPayload) => ({payload, type: loadWalletDisclaimer})
/**
 * Mark a payment we were just notified about as being unseen
 */
export const createAddNewPayment = (payload: _AddNewPaymentPayload) => ({payload, type: addNewPayment})
/**
 * Mark the given payment ID and anything older as read.
 */
export const createMarkAsRead = (payload: _MarkAsReadPayload) => ({payload, type: markAsRead})
/**
 * Move to the confirm screen on a built payment.
 */
export const createReviewPayment = (payload: _ReviewPaymentPayload) => ({payload, type: reviewPayment})
/**
 * Perform sending a payment
 */
export const createSendPayment = (payload: _SendPaymentPayload) => ({payload, type: sendPayment})
/**
 * Received a fresh first page of recent payments
 */
export const createRecentPaymentsReceived = (payload: _RecentPaymentsReceivedPayload) => ({payload, type: recentPaymentsReceived})
/**
 * Received a new set of pending payments; replace existing ones with these
 */
export const createPendingPaymentsReceived = (payload: _PendingPaymentsReceivedPayload) => ({payload, type: pendingPaymentsReceived})
/**
 * Received wallet disclaimer
 */
export const createWalletDisclaimerReceived = (payload: _WalletDisclaimerReceivedPayload) => ({payload, type: walletDisclaimerReceived})
/**
 * Refresh inflation destination and options
 */
export const createLoadInflationDestination = (payload: _LoadInflationDestinationPayload) => ({payload, type: loadInflationDestination})
/**
 * Refresh our list of accounts
 */
export const createLoadAccounts = (payload: _LoadAccountsPayload) => ({payload, type: loadAccounts})
/**
 * Refresh our list of assets for a given account
 */
export const createLoadAssets = (payload: _LoadAssetsPayload) => ({payload, type: loadAssets})
/**
 * Refresh our list of payments for a given account
 */
export const createLoadPayments = (payload: _LoadPaymentsPayload) => ({payload, type: loadPayments})
/**
 * Reject (temporarily) the Stellar account disclaimer
 */
export const createRejectDisclaimer = (payload: _RejectDisclaimerPayload) => ({payload, type: rejectDisclaimer})
/**
 * Request payment
 */
export const createRequestPayment = (payload: _RequestPaymentPayload) => ({payload, type: requestPayment})
/**
 * Reset to the pre-accepting-disclaimer state.
 */
export const createResetAcceptingDisclaimer = (payload: _ResetAcceptingDisclaimerPayload) => ({payload, type: resetAcceptingDisclaimer})
/**
 * Scrolled down the list of payments for a given account
 */
export const createLoadMorePayments = (payload: _LoadMorePaymentsPayload) => ({payload, type: loadMorePayments})
/**
 * Select an account. Optionally navigate to the account page.
 */
export const createSelectAccount = (payload: _SelectAccountPayload) => ({payload, type: selectAccount})
/**
 * Send a potential payment to the service for validation
 */
export const createBuildPayment = (payload: _BuildPaymentPayload) => ({payload, type: buildPayment})
/**
 * Set building amount
 */
export const createSetBuildingAmount = (payload: _SetBuildingAmountPayload) => ({payload, type: setBuildingAmount})
/**
 * Set building currency
 */
export const createSetBuildingCurrency = (payload: _SetBuildingCurrencyPayload) => ({payload, type: setBuildingCurrency})
/**
 * Set building from
 */
export const createSetBuildingFrom = (payload: _SetBuildingFromPayload) => ({payload, type: setBuildingFrom})
/**
 * Set building isRequest
 */
export const createSetBuildingIsRequest = (payload: _SetBuildingIsRequestPayload) => ({payload, type: setBuildingIsRequest})
/**
 * Set building public memo
 */
export const createSetBuildingPublicMemo = (payload: _SetBuildingPublicMemoPayload) => ({payload, type: setBuildingPublicMemo})
/**
 * Set building recipient type
 */
export const createSetBuildingRecipientType = (payload: _SetBuildingRecipientTypePayload) => ({payload, type: setBuildingRecipientType})
/**
 * Set building secret note
 */
export const createSetBuildingSecretNote = (payload: _SetBuildingSecretNotePayload) => ({payload, type: setBuildingSecretNote})
/**
 * Set building to -- depends on recipientType
 */
export const createSetBuildingTo = (payload: _SetBuildingToPayload) => ({payload, type: setBuildingTo})
/**
 * Set our inflation destination
 */
export const createSetInflationDestination = (payload: _SetInflationDestinationPayload) => ({payload, type: setInflationDestination})
/**
 * Set whether last currency used to send was XLM
 */
export const createSetLastSentXLM = (payload: _SetLastSentXLMPayload) => ({payload, type: setLastSentXLM})
/**
 * Set whether the payment is ready to review
 */
export const createSetReadyToReview = (payload: _SetReadyToReviewPayload) => ({payload, type: setReadyToReview})
/**
 * Signal that a payment being built is abandoned and reset the form fields to their initial states.
 */
export const createAbandonPayment = (payload: _AbandonPaymentPayload) => ({payload, type: abandonPayment})
/**
 * Successfully request payment
 */
export const createRequestedPayment = (payload: _RequestedPaymentPayload) => ({payload, type: requestedPayment})
/**
 * Successfully sent a payment
 */
export const createSentPayment = (payload: _SentPaymentPayload) => ({payload, type: sentPayment})
/**
 * The service has responded with mobile only mode for Stellar account.
 */
export const createLoadedMobileOnlyMode = (payload: _LoadedMobileOnlyModePayload) => ({payload, type: loadedMobileOnlyMode})
/**
 * The service responded with an error or that the account name is valid.
 */
export const createValidatedAccountName = (payload: _ValidatedAccountNamePayload) => ({payload, type: validatedAccountName})
export const createValidatedAccountNameError = (payload: _ValidatedAccountNamePayloadError) => ({error: true, payload, type: validatedAccountName})
/**
 * The service responded with an error or that the create new account operation succeeded
 */
export const createCreatedNewAccount = (payload: _CreatedNewAccountPayload) => ({payload, type: createdNewAccount})
export const createCreatedNewAccountError = (payload: _CreatedNewAccountPayloadError) => ({error: true, payload, type: createdNewAccount})
/**
 * The service responded with an error or that the link existing operation succeeded
 */
export const createLinkedExistingAccount = (payload: _LinkedExistingAccountPayload) => ({payload, type: linkedExistingAccount})
export const createLinkedExistingAccountError = (payload: _LinkedExistingAccountPayloadError) => ({error: true, payload, type: linkedExistingAccount})
/**
 * The service responded with an error or that the secret key is valid.
 */
export const createValidatedSecretKey = (payload: _ValidatedSecretKeyPayload) => ({payload, type: validatedSecretKey})
export const createValidatedSecretKeyError = (payload: _ValidatedSecretKeyPayloadError) => ({error: true, payload, type: validatedSecretKey})
/**
 * Update a payment with additional detail
 */
export const createPaymentDetailReceived = (payload: _PaymentDetailReceivedPayload) => ({payload, type: paymentDetailReceived})
/**
 * Update badges in the nav
 */
export const createBadgesUpdated = (payload: _BadgesUpdatedPayload) => ({payload, type: badgesUpdated})
/**
 * Update display currency for a certain account
 */
export const createDisplayCurrencyReceived = (payload: _DisplayCurrencyReceivedPayload) => ({payload, type: displayCurrencyReceived})
/**
 * Update our store of account data
 */
export const createAccountsReceived = (payload: _AccountsReceivedPayload) => ({payload, type: accountsReceived})
/**
 * Update our store of assets data
 */
export const createAssetsReceived = (payload: _AssetsReceivedPayload) => ({payload, type: assetsReceived})
/**
 * Update our store of payments data
 */
export const createPaymentsReceived = (payload: _PaymentsReceivedPayload) => ({payload, type: paymentsReceived})
/**
 * Update our store with a prepared payment
 */
export const createBuiltPaymentReceived = (payload: _BuiltPaymentReceivedPayload) => ({payload, type: builtPaymentReceived})
/**
 * Update our store with a prepared payment
 */
export const createBuiltRequestReceived = (payload: _BuiltRequestReceivedPayload) => ({payload, type: builtRequestReceived})
/**
 * Update our store with an ID for a new building payment
 */
export const createBuildingPaymentIDReceived = (payload: _BuildingPaymentIDReceivedPayload) => ({payload, type: buildingPaymentIDReceived})
/**
 * Update our store with an exported secret key
 */
export const createSecretKeyReceived = (payload: _SecretKeyReceivedPayload) => ({payload, type: secretKeyReceived})
/**
 * Update our store with the results of reviewing a built payment
 */
export const createReviewedPaymentReceived = (payload: _ReviewedPaymentReceivedPayload) => ({payload, type: reviewedPaymentReceived})
/**
 * Update valid display currencies to choose from
 */
export const createDisplayCurrenciesReceived = (payload: _DisplayCurrenciesReceivedPayload) => ({payload, type: displayCurrenciesReceived})
/**
 * Update valid send assets to choose from
 */
export const createSendAssetChoicesReceived = (payload: _SendAssetChoicesReceivedPayload) => ({payload, type: sendAssetChoicesReceived})
/**
 * We received an updated account record
 */
export const createAccountUpdateReceived = (payload: _AccountUpdateReceivedPayload) => ({payload, type: accountUpdateReceived})

// Action Payloads
export type AbandonPaymentPayload = {|+payload: _AbandonPaymentPayload, +type: 'wallets:abandonPayment'|}
export type AcceptDisclaimerPayload = {|+payload: _AcceptDisclaimerPayload, +type: 'wallets:acceptDisclaimer'|}
export type AccountUpdateReceivedPayload = {|+payload: _AccountUpdateReceivedPayload, +type: 'wallets:accountUpdateReceived'|}
export type AccountsReceivedPayload = {|+payload: _AccountsReceivedPayload, +type: 'wallets:accountsReceived'|}
export type AddNewPaymentPayload = {|+payload: _AddNewPaymentPayload, +type: 'wallets:addNewPayment'|}
export type AssetsReceivedPayload = {|+payload: _AssetsReceivedPayload, +type: 'wallets:assetsReceived'|}
export type BadgesUpdatedPayload = {|+payload: _BadgesUpdatedPayload, +type: 'wallets:badgesUpdated'|}
export type BuildPaymentPayload = {|+payload: _BuildPaymentPayload, +type: 'wallets:buildPayment'|}
export type BuildingPaymentIDReceivedPayload = {|+payload: _BuildingPaymentIDReceivedPayload, +type: 'wallets:buildingPaymentIDReceived'|}
export type BuiltPaymentReceivedPayload = {|+payload: _BuiltPaymentReceivedPayload, +type: 'wallets:builtPaymentReceived'|}
export type BuiltRequestReceivedPayload = {|+payload: _BuiltRequestReceivedPayload, +type: 'wallets:builtRequestReceived'|}
export type CancelPaymentPayload = {|+payload: _CancelPaymentPayload, +type: 'wallets:cancelPayment'|}
export type CancelRequestPayload = {|+payload: _CancelRequestPayload, +type: 'wallets:cancelRequest'|}
export type ChangeAccountNamePayload = {|+payload: _ChangeAccountNamePayload, +type: 'wallets:changeAccountName'|}
export type ChangeDisplayCurrencyPayload = {|+payload: _ChangeDisplayCurrencyPayload, +type: 'wallets:changeDisplayCurrency'|}
export type ChangeMobileOnlyModePayload = {|+payload: _ChangeMobileOnlyModePayload, +type: 'wallets:changeMobileOnlyMode'|}
export type ChangedAccountNamePayload = {|+payload: _ChangedAccountNamePayload, +type: 'wallets:changedAccountName'|}
export type ChangedAccountNamePayloadError = {|+error: true, +payload: _ChangedAccountNamePayloadError, +type: 'wallets:changedAccountName'|}
export type CheckDisclaimerPayload = {|+payload: _CheckDisclaimerPayload, +type: 'wallets:checkDisclaimer'|}
export type ClearBuildingPayload = {|+payload: _ClearBuildingPayload, +type: 'wallets:clearBuilding'|}
export type ClearBuiltPaymentPayload = {|+payload: _ClearBuiltPaymentPayload, +type: 'wallets:clearBuiltPayment'|}
export type ClearBuiltRequestPayload = {|+payload: _ClearBuiltRequestPayload, +type: 'wallets:clearBuiltRequest'|}
export type ClearErrorsPayload = {|+payload: _ClearErrorsPayload, +type: 'wallets:clearErrors'|}
export type ClearNewPaymentsPayload = {|+payload: _ClearNewPaymentsPayload, +type: 'wallets:clearNewPayments'|}
export type CreateNewAccountPayload = {|+payload: _CreateNewAccountPayload, +type: 'wallets:createNewAccount'|}
export type CreatedNewAccountPayload = {|+payload: _CreatedNewAccountPayload, +type: 'wallets:createdNewAccount'|}
export type CreatedNewAccountPayloadError = {|+error: true, +payload: _CreatedNewAccountPayloadError, +type: 'wallets:createdNewAccount'|}
export type DeleteAccountPayload = {|+payload: _DeleteAccountPayload, +type: 'wallets:deleteAccount'|}
export type DeletedAccountPayload = {|+payload: _DeletedAccountPayload, +type: 'wallets:deletedAccount'|}
export type DidSetAccountAsDefaultPayload = {|+payload: _DidSetAccountAsDefaultPayload, +type: 'wallets:didSetAccountAsDefault'|}
export type DisplayCurrenciesReceivedPayload = {|+payload: _DisplayCurrenciesReceivedPayload, +type: 'wallets:displayCurrenciesReceived'|}
export type DisplayCurrencyReceivedPayload = {|+payload: _DisplayCurrencyReceivedPayload, +type: 'wallets:displayCurrencyReceived'|}
export type ExitFailedPaymentPayload = {|+payload: _ExitFailedPaymentPayload, +type: 'wallets:exitFailedPayment'|}
export type ExportSecretKeyPayload = {|+payload: _ExportSecretKeyPayload, +type: 'wallets:exportSecretKey'|}
export type InflationDestinationReceivedPayload = {|+payload: _InflationDestinationReceivedPayload, +type: 'wallets:inflationDestinationReceived'|}
export type InflationDestinationReceivedPayloadError = {|+error: true, +payload: _InflationDestinationReceivedPayloadError, +type: 'wallets:inflationDestinationReceived'|}
export type LinkExistingAccountPayload = {|+payload: _LinkExistingAccountPayload, +type: 'wallets:linkExistingAccount'|}
export type LinkedExistingAccountPayload = {|+payload: _LinkedExistingAccountPayload, +type: 'wallets:linkedExistingAccount'|}
export type LinkedExistingAccountPayloadError = {|+error: true, +payload: _LinkedExistingAccountPayloadError, +type: 'wallets:linkedExistingAccount'|}
export type LoadAccountsPayload = {|+payload: _LoadAccountsPayload, +type: 'wallets:loadAccounts'|}
export type LoadAssetsPayload = {|+payload: _LoadAssetsPayload, +type: 'wallets:loadAssets'|}
export type LoadDisplayCurrenciesPayload = {|+payload: _LoadDisplayCurrenciesPayload, +type: 'wallets:loadDisplayCurrencies'|}
export type LoadDisplayCurrencyPayload = {|+payload: _LoadDisplayCurrencyPayload, +type: 'wallets:loadDisplayCurrency'|}
export type LoadInflationDestinationPayload = {|+payload: _LoadInflationDestinationPayload, +type: 'wallets:loadInflationDestination'|}
export type LoadMobileOnlyModePayload = {|+payload: _LoadMobileOnlyModePayload, +type: 'wallets:loadMobileOnlyMode'|}
export type LoadMorePaymentsPayload = {|+payload: _LoadMorePaymentsPayload, +type: 'wallets:loadMorePayments'|}
export type LoadPaymentDetailPayload = {|+payload: _LoadPaymentDetailPayload, +type: 'wallets:loadPaymentDetail'|}
export type LoadPaymentsPayload = {|+payload: _LoadPaymentsPayload, +type: 'wallets:loadPayments'|}
export type LoadSendAssetChoicesPayload = {|+payload: _LoadSendAssetChoicesPayload, +type: 'wallets:loadSendAssetChoices'|}
export type LoadWalletDisclaimerPayload = {|+payload: _LoadWalletDisclaimerPayload, +type: 'wallets:loadWalletDisclaimer'|}
export type LoadedMobileOnlyModePayload = {|+payload: _LoadedMobileOnlyModePayload, +type: 'wallets:loadedMobileOnlyMode'|}
export type MarkAsReadPayload = {|+payload: _MarkAsReadPayload, +type: 'wallets:markAsRead'|}
export type OpenSendRequestFormPayload = {|+payload: _OpenSendRequestFormPayload, +type: 'wallets:openSendRequestForm'|}
export type PaymentDetailReceivedPayload = {|+payload: _PaymentDetailReceivedPayload, +type: 'wallets:paymentDetailReceived'|}
export type PaymentsReceivedPayload = {|+payload: _PaymentsReceivedPayload, +type: 'wallets:paymentsReceived'|}
export type PendingPaymentsReceivedPayload = {|+payload: _PendingPaymentsReceivedPayload, +type: 'wallets:pendingPaymentsReceived'|}
export type RecentPaymentsReceivedPayload = {|+payload: _RecentPaymentsReceivedPayload, +type: 'wallets:recentPaymentsReceived'|}
export type RejectDisclaimerPayload = {|+payload: _RejectDisclaimerPayload, +type: 'wallets:rejectDisclaimer'|}
export type RequestPaymentPayload = {|+payload: _RequestPaymentPayload, +type: 'wallets:requestPayment'|}
export type RequestedPaymentPayload = {|+payload: _RequestedPaymentPayload, +type: 'wallets:requestedPayment'|}
export type ResetAcceptingDisclaimerPayload = {|+payload: _ResetAcceptingDisclaimerPayload, +type: 'wallets:resetAcceptingDisclaimer'|}
export type ReviewPaymentPayload = {|+payload: _ReviewPaymentPayload, +type: 'wallets:reviewPayment'|}
export type ReviewedPaymentReceivedPayload = {|+payload: _ReviewedPaymentReceivedPayload, +type: 'wallets:reviewedPaymentReceived'|}
export type SecretKeyReceivedPayload = {|+payload: _SecretKeyReceivedPayload, +type: 'wallets:secretKeyReceived'|}
export type SecretKeySeenPayload = {|+payload: _SecretKeySeenPayload, +type: 'wallets:secretKeySeen'|}
export type SelectAccountPayload = {|+payload: _SelectAccountPayload, +type: 'wallets:selectAccount'|}
export type SendAssetChoicesReceivedPayload = {|+payload: _SendAssetChoicesReceivedPayload, +type: 'wallets:sendAssetChoicesReceived'|}
export type SendPaymentPayload = {|+payload: _SendPaymentPayload, +type: 'wallets:sendPayment'|}
export type SentPaymentErrorPayload = {|+payload: _SentPaymentErrorPayload, +type: 'wallets:sentPaymentError'|}
export type SentPaymentPayload = {|+payload: _SentPaymentPayload, +type: 'wallets:sentPayment'|}
export type SetAccountAsDefaultPayload = {|+payload: _SetAccountAsDefaultPayload, +type: 'wallets:setAccountAsDefault'|}
export type SetBuildingAmountPayload = {|+payload: _SetBuildingAmountPayload, +type: 'wallets:setBuildingAmount'|}
export type SetBuildingCurrencyPayload = {|+payload: _SetBuildingCurrencyPayload, +type: 'wallets:setBuildingCurrency'|}
export type SetBuildingFromPayload = {|+payload: _SetBuildingFromPayload, +type: 'wallets:setBuildingFrom'|}
export type SetBuildingIsRequestPayload = {|+payload: _SetBuildingIsRequestPayload, +type: 'wallets:setBuildingIsRequest'|}
export type SetBuildingPublicMemoPayload = {|+payload: _SetBuildingPublicMemoPayload, +type: 'wallets:setBuildingPublicMemo'|}
export type SetBuildingRecipientTypePayload = {|+payload: _SetBuildingRecipientTypePayload, +type: 'wallets:setBuildingRecipientType'|}
export type SetBuildingSecretNotePayload = {|+payload: _SetBuildingSecretNotePayload, +type: 'wallets:setBuildingSecretNote'|}
export type SetBuildingToPayload = {|+payload: _SetBuildingToPayload, +type: 'wallets:setBuildingTo'|}
export type SetInflationDestinationPayload = {|+payload: _SetInflationDestinationPayload, +type: 'wallets:setInflationDestination'|}
export type SetLastSentXLMPayload = {|+payload: _SetLastSentXLMPayload, +type: 'wallets:setLastSentXLM'|}
export type SetReadyToReviewPayload = {|+payload: _SetReadyToReviewPayload, +type: 'wallets:setReadyToReview'|}
export type ValidateAccountNamePayload = {|+payload: _ValidateAccountNamePayload, +type: 'wallets:validateAccountName'|}
export type ValidateSecretKeyPayload = {|+payload: _ValidateSecretKeyPayload, +type: 'wallets:validateSecretKey'|}
export type ValidatedAccountNamePayload = {|+payload: _ValidatedAccountNamePayload, +type: 'wallets:validatedAccountName'|}
export type ValidatedAccountNamePayloadError = {|+error: true, +payload: _ValidatedAccountNamePayloadError, +type: 'wallets:validatedAccountName'|}
export type ValidatedSecretKeyPayload = {|+payload: _ValidatedSecretKeyPayload, +type: 'wallets:validatedSecretKey'|}
export type ValidatedSecretKeyPayloadError = {|+error: true, +payload: _ValidatedSecretKeyPayloadError, +type: 'wallets:validatedSecretKey'|}
export type WalletDisclaimerReceivedPayload = {|+payload: _WalletDisclaimerReceivedPayload, +type: 'wallets:walletDisclaimerReceived'|}

// All Actions
// prettier-ignore
export type Actions =
  | AbandonPaymentPayload
  | AcceptDisclaimerPayload
  | AccountUpdateReceivedPayload
  | AccountsReceivedPayload
  | AddNewPaymentPayload
  | AssetsReceivedPayload
  | BadgesUpdatedPayload
  | BuildPaymentPayload
  | BuildingPaymentIDReceivedPayload
  | BuiltPaymentReceivedPayload
  | BuiltRequestReceivedPayload
  | CancelPaymentPayload
  | CancelRequestPayload
  | ChangeAccountNamePayload
  | ChangeDisplayCurrencyPayload
  | ChangeMobileOnlyModePayload
  | ChangedAccountNamePayload
  | ChangedAccountNamePayloadError
  | CheckDisclaimerPayload
  | ClearBuildingPayload
  | ClearBuiltPaymentPayload
  | ClearBuiltRequestPayload
  | ClearErrorsPayload
  | ClearNewPaymentsPayload
  | CreateNewAccountPayload
  | CreatedNewAccountPayload
  | CreatedNewAccountPayloadError
  | DeleteAccountPayload
  | DeletedAccountPayload
  | DidSetAccountAsDefaultPayload
  | DisplayCurrenciesReceivedPayload
  | DisplayCurrencyReceivedPayload
  | ExitFailedPaymentPayload
  | ExportSecretKeyPayload
  | InflationDestinationReceivedPayload
  | InflationDestinationReceivedPayloadError
  | LinkExistingAccountPayload
  | LinkedExistingAccountPayload
  | LinkedExistingAccountPayloadError
  | LoadAccountsPayload
  | LoadAssetsPayload
  | LoadDisplayCurrenciesPayload
  | LoadDisplayCurrencyPayload
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
  | SendPaymentPayload
  | SentPaymentErrorPayload
  | SentPaymentPayload
  | SetAccountAsDefaultPayload
  | SetBuildingAmountPayload
  | SetBuildingCurrencyPayload
  | SetBuildingFromPayload
  | SetBuildingIsRequestPayload
  | SetBuildingPublicMemoPayload
  | SetBuildingRecipientTypePayload
  | SetBuildingSecretNotePayload
  | SetBuildingToPayload
  | SetInflationDestinationPayload
  | SetLastSentXLMPayload
  | SetReadyToReviewPayload
  | ValidateAccountNamePayload
  | ValidateSecretKeyPayload
  | ValidatedAccountNamePayload
  | ValidatedAccountNamePayloadError
  | ValidatedSecretKeyPayload
  | ValidatedSecretKeyPayloadError
  | WalletDisclaimerReceivedPayload
  | {type: 'common:resetStore', payload: null}
