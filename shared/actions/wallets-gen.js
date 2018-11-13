// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define */

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
export const accountsReceived = 'wallets:accountsReceived'
export const addNewPayment = 'wallets:addNewPayment'
export const assetsReceived = 'wallets:assetsReceived'
export const badgesUpdated = 'wallets:badgesUpdated'
export const buildPayment = 'wallets:buildPayment'
export const builtPaymentReceived = 'wallets:builtPaymentReceived'
export const builtRequestReceived = 'wallets:builtRequestReceived'
export const cancelPayment = 'wallets:cancelPayment'
export const cancelRequest = 'wallets:cancelRequest'
export const changeAccountName = 'wallets:changeAccountName'
export const changeDisplayCurrency = 'wallets:changeDisplayCurrency'
export const changedAccountName = 'wallets:changedAccountName'
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
export const exportSecretKey = 'wallets:exportSecretKey'
export const linkExistingAccount = 'wallets:linkExistingAccount'
export const linkedExistingAccount = 'wallets:linkedExistingAccount'
export const loadAccounts = 'wallets:loadAccounts'
export const loadAssets = 'wallets:loadAssets'
export const loadDisplayCurrencies = 'wallets:loadDisplayCurrencies'
export const loadDisplayCurrency = 'wallets:loadDisplayCurrency'
export const loadMorePayments = 'wallets:loadMorePayments'
export const loadPaymentDetail = 'wallets:loadPaymentDetail'
export const loadPayments = 'wallets:loadPayments'
export const loadRequestDetail = 'wallets:loadRequestDetail'
export const loadSendAssetChoices = 'wallets:loadSendAssetChoices'
export const loadWalletDisclaimer = 'wallets:loadWalletDisclaimer'
export const markAsRead = 'wallets:markAsRead'
export const openSendRequestForm = 'wallets:openSendRequestForm'
export const paymentDetailReceived = 'wallets:paymentDetailReceived'
export const paymentsReceived = 'wallets:paymentsReceived'
export const refreshPayments = 'wallets:refreshPayments'
export const rejectDisclaimer = 'wallets:rejectDisclaimer'
export const requestDetailReceived = 'wallets:requestDetailReceived'
export const requestPayment = 'wallets:requestPayment'
export const requestedPayment = 'wallets:requestedPayment'
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
export const setLastSentXLM = 'wallets:setLastSentXLM'
export const validateAccountName = 'wallets:validateAccountName'
export const validateSecretKey = 'wallets:validateSecretKey'
export const validatedAccountName = 'wallets:validatedAccountName'
export const validatedSecretKey = 'wallets:validatedSecretKey'
export const walletDisclaimerReceived = 'wallets:walletDisclaimerReceived'

// Payload Types
type _AbandonPaymentPayload = void
type _AcceptDisclaimerPayload = $ReadOnly<{|nextScreen: Types.NextScreenAfterAcceptance|}>
type _AccountsReceivedPayload = $ReadOnly<{|accounts: Array<Types.Account>|}>
type _AddNewPaymentPayload = $ReadOnly<{|
  accountID: Types.AccountID,
  paymentID: Types.PaymentID,
|}>
type _AssetsReceivedPayload = $ReadOnly<{|
  accountID: Types.AccountID,
  assets: Array<Types.Assets>,
|}>
type _BadgesUpdatedPayload = $ReadOnly<{|accounts: Array<RPCTypes.WalletAccountInfo>|}>
type _BuildPaymentPayload = void
type _BuiltPaymentReceivedPayload = $ReadOnly<{|
  build: Types.BuiltPayment,
  forBuilding: Types.Building,
|}>
type _BuiltRequestReceivedPayload = $ReadOnly<{|
  build: Types.BuiltRequest,
  forBuilding: Types.Building,
|}>
type _CancelPaymentPayload = $ReadOnly<{|
  showAccount?: boolean,
  paymentID: Types.PaymentID,
|}>
type _CancelRequestPayload = $ReadOnly<{|
  conversationIDKey?: ChatTypes.ConversationIDKey,
  ordinal?: ChatTypes.Ordinal,
  requestID: StellarRPCTypes.KeybaseRequestID,
|}>
type _ChangeAccountNamePayload = $ReadOnly<{|
  accountID: Types.AccountID,
  name: string,
|}>
type _ChangeDisplayCurrencyPayload = $ReadOnly<{|
  accountID: Types.AccountID,
  code: Types.CurrencyCode,
|}>
type _ChangedAccountNamePayload = $ReadOnly<{|accountID: Types.AccountID|}>
type _ChangedAccountNamePayloadError = $ReadOnly<{|
  name: string,
  error: string,
|}>
type _ClearBuildingPayload = void
type _ClearBuiltPaymentPayload = void
type _ClearBuiltRequestPayload = void
type _ClearErrorsPayload = void
type _ClearNewPaymentsPayload = $ReadOnly<{|accountID: Types.AccountID|}>
type _CreateNewAccountPayload = $ReadOnly<{|
  name: string,
  showOnCreation?: boolean,
  setBuildingTo?: boolean,
|}>
type _CreatedNewAccountPayload = $ReadOnly<{|
  accountID: Types.AccountID,
  showOnCreation?: boolean,
  setBuildingTo?: boolean,
|}>
type _CreatedNewAccountPayloadError = $ReadOnly<{|
  name: string,
  error: string,
|}>
type _DeleteAccountPayload = $ReadOnly<{|accountID: Types.AccountID|}>
type _DeletedAccountPayload = void
type _DidSetAccountAsDefaultPayload = $ReadOnly<{|accountID: Types.AccountID|}>
type _DisplayCurrenciesReceivedPayload = $ReadOnly<{|currencies: Array<Types.Currency>|}>
type _DisplayCurrencyReceivedPayload = $ReadOnly<{|
  accountID: ?Types.AccountID,
  currency: Types.Currency,
  setBuildingCurrency?: boolean,
|}>
type _ExportSecretKeyPayload = $ReadOnly<{|accountID: Types.AccountID|}>
type _LinkExistingAccountPayload = $ReadOnly<{|
  name: string,
  secretKey: HiddenString,
  showOnCreation?: boolean,
  setBuildingTo?: boolean,
|}>
type _LinkedExistingAccountPayload = $ReadOnly<{|
  accountID: Types.AccountID,
  showOnCreation?: boolean,
  setBuildingTo?: boolean,
|}>
type _LinkedExistingAccountPayloadError = $ReadOnly<{|
  name: string,
  secretKey: HiddenString,
  error: string,
|}>
type _LoadAccountsPayload = void
type _LoadAssetsPayload = $ReadOnly<{|accountID: Types.AccountID|}>
type _LoadDisplayCurrenciesPayload = void
type _LoadDisplayCurrencyPayload = $ReadOnly<{|
  accountID: ?Types.AccountID,
  setBuildingCurrency?: boolean,
|}>
type _LoadMorePaymentsPayload = $ReadOnly<{|accountID: Types.AccountID|}>
type _LoadPaymentDetailPayload = $ReadOnly<{|
  accountID: Types.AccountID,
  paymentID: Types.PaymentID,
|}>
type _LoadPaymentsPayload = $ReadOnly<{|accountID: Types.AccountID|}>
type _LoadRequestDetailPayload = $ReadOnly<{|requestID: StellarRPCTypes.KeybaseRequestID|}>
type _LoadSendAssetChoicesPayload = $ReadOnly<{|
  from: Types.AccountID,
  to: string,
|}>
type _LoadWalletDisclaimerPayload = void
type _MarkAsReadPayload = $ReadOnly<{|
  accountID: Types.AccountID,
  mostRecentID: Types.PaymentID,
|}>
type _OpenSendRequestFormPayload = $ReadOnly<{|
  amount?: string,
  currency?: string,
  from?: Types.AccountID,
  isRequest?: boolean,
  publicMemo?: HiddenString,
  recipientType?: Types.CounterpartyType,
  secretNote?: HiddenString,
  to?: string,
|}>
type _PaymentDetailReceivedPayload = $ReadOnly<{|
  accountID: Types.AccountID,
  payment: Types.PaymentDetail,
|}>
type _PaymentsReceivedPayload = $ReadOnly<{|
  accountID: Types.AccountID,
  paymentCursor: ?StellarRPCTypes.PageCursor,
  oldestUnread: Types.PaymentID,
  payments: Array<Types.PaymentResult>,
  pending: Array<Types.PaymentResult>,
|}>
type _RefreshPaymentsPayload = $ReadOnly<{|
  accountID: Types.AccountID,
  paymentID: Types.PaymentID,
|}>
type _RejectDisclaimerPayload = void
type _RequestDetailReceivedPayload = $ReadOnly<{|request: StellarRPCTypes.RequestDetailsLocal|}>
type _RequestPaymentPayload = void
type _RequestedPaymentPayload = $ReadOnly<{|
  kbRqID: HiddenString,
  lastSentXLM: boolean,
|}>
type _SecretKeyReceivedPayload = $ReadOnly<{|
  accountID: Types.AccountID,
  secretKey: HiddenString,
|}>
type _SecretKeySeenPayload = $ReadOnly<{|accountID: Types.AccountID|}>
type _SelectAccountPayload = $ReadOnly<{|
  accountID: Types.AccountID,
  show?: boolean,
|}>
type _SendAssetChoicesReceivedPayload = $ReadOnly<{|sendAssetChoices: Array<StellarRPCTypes.SendAssetChoiceLocal>|}>
type _SendPaymentPayload = void
type _SentPaymentErrorPayload = $ReadOnly<{|error: string|}>
type _SentPaymentPayload = $ReadOnly<{|
  kbTxID: HiddenString,
  lastSentXLM: boolean,
|}>
type _SetAccountAsDefaultPayload = $ReadOnly<{|accountID: Types.AccountID|}>
type _SetBuildingAmountPayload = $ReadOnly<{|amount: string|}>
type _SetBuildingCurrencyPayload = $ReadOnly<{|currency: string|}>
type _SetBuildingFromPayload = $ReadOnly<{|from: Types.AccountID|}>
type _SetBuildingIsRequestPayload = $ReadOnly<{|isRequest: boolean|}>
type _SetBuildingPublicMemoPayload = $ReadOnly<{|publicMemo: HiddenString|}>
type _SetBuildingRecipientTypePayload = $ReadOnly<{|recipientType: Types.CounterpartyType|}>
type _SetBuildingSecretNotePayload = $ReadOnly<{|secretNote: HiddenString|}>
type _SetBuildingToPayload = $ReadOnly<{|to: string|}>
type _SetLastSentXLMPayload = $ReadOnly<{|
  lastSentXLM: boolean,
  writeFile: boolean,
|}>
type _ValidateAccountNamePayload = $ReadOnly<{|name: string|}>
type _ValidateSecretKeyPayload = $ReadOnly<{|secretKey: HiddenString|}>
type _ValidatedAccountNamePayload = $ReadOnly<{|name: string|}>
type _ValidatedAccountNamePayloadError = $ReadOnly<{|
  name: string,
  error: string,
|}>
type _ValidatedSecretKeyPayload = $ReadOnly<{|secretKey: HiddenString|}>
type _ValidatedSecretKeyPayloadError = $ReadOnly<{|
  secretKey: HiddenString,
  error: string,
|}>
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
 * Ask the service to validate an account name.
 */
export const createValidateAccountName = (payload: _ValidateAccountNamePayload) => ({payload, type: validateAccountName})
/**
 * Ask the service to validate an account secret key.
 */
export const createValidateSecretKey = (payload: _ValidateSecretKeyPayload) => ({payload, type: validateSecretKey})
/**
 * Cancel a payment. Valid for payments of status 'cancelable'. If showAccount is true, nav to the currently selected account when done.
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
 * Delete an account
 */
export const createDeleteAccount = (payload: _DeleteAccountPayload) => ({payload, type: deleteAccount})
/**
 * Export a Stellar account's secret key
 */
export const createExportSecretKey = (payload: _ExportSecretKeyPayload) => ({payload, type: exportSecretKey})
/**
 * Failed to send a payment
 */
export const createSentPaymentError = (payload: _SentPaymentErrorPayload) => ({payload, type: sentPaymentError})
/**
 * In response to a notification, resync payment info
 */
export const createRefreshPayments = (payload: _RefreshPaymentsPayload) => ({payload, type: refreshPayments})
/**
 * Initialize and navigate to the send or request form. See docs for `setBuilding*` for param semantics.
 */
export const createOpenSendRequestForm = (payload: _OpenSendRequestFormPayload) => ({payload, type: openSendRequestForm})
/**
 * Link an existing Stellar account with this Keybase user.
 */
export const createLinkExistingAccount = (payload: _LinkExistingAccountPayload) => ({payload, type: linkExistingAccount})
/**
 * Load a request's details
 */
export const createLoadRequestDetail = (payload: _LoadRequestDetailPayload) => ({payload, type: loadRequestDetail})
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
 * Perform sending a payment
 */
export const createSendPayment = (payload: _SendPaymentPayload) => ({payload, type: sendPayment})
/**
 * Received wallet disclaimer
 */
export const createWalletDisclaimerReceived = (payload: _WalletDisclaimerReceivedPayload) => ({payload, type: walletDisclaimerReceived})
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
 * Signal that a payment being built is abandoned and reset the form fields to their initial states.
 */
export const createAbandonPayment = (payload: _AbandonPaymentPayload) => ({payload, type: abandonPayment})
/**
 * Store a request's details
 */
export const createRequestDetailReceived = (payload: _RequestDetailReceivedPayload) => ({payload, type: requestDetailReceived})
/**
 * Successfully request payment
 */
export const createRequestedPayment = (payload: _RequestedPaymentPayload) => ({payload, type: requestedPayment})
/**
 * Successfully sent a payment
 */
export const createSentPayment = (payload: _SentPaymentPayload) => ({payload, type: sentPayment})
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
 * Update our store with an exported secret key
 */
export const createSecretKeyReceived = (payload: _SecretKeyReceivedPayload) => ({payload, type: secretKeyReceived})
/**
 * Update valid display currencies to choose from
 */
export const createDisplayCurrenciesReceived = (payload: _DisplayCurrenciesReceivedPayload) => ({payload, type: displayCurrenciesReceived})
/**
 * Update valid send assets to choose from
 */
export const createSendAssetChoicesReceived = (payload: _SendAssetChoicesReceivedPayload) => ({payload, type: sendAssetChoicesReceived})
export const createSetLastSentXLM = (payload: _SetLastSentXLMPayload) => ({payload, type: setLastSentXLM})

// Action Payloads
export type AbandonPaymentPayload = $Call<typeof createAbandonPayment, _AbandonPaymentPayload>
export type AcceptDisclaimerPayload = $Call<typeof createAcceptDisclaimer, _AcceptDisclaimerPayload>
export type AccountsReceivedPayload = $Call<typeof createAccountsReceived, _AccountsReceivedPayload>
export type AddNewPaymentPayload = $Call<typeof createAddNewPayment, _AddNewPaymentPayload>
export type AssetsReceivedPayload = $Call<typeof createAssetsReceived, _AssetsReceivedPayload>
export type BadgesUpdatedPayload = $Call<typeof createBadgesUpdated, _BadgesUpdatedPayload>
export type BuildPaymentPayload = $Call<typeof createBuildPayment, _BuildPaymentPayload>
export type BuiltPaymentReceivedPayload = $Call<typeof createBuiltPaymentReceived, _BuiltPaymentReceivedPayload>
export type BuiltRequestReceivedPayload = $Call<typeof createBuiltRequestReceived, _BuiltRequestReceivedPayload>
export type CancelPaymentPayload = $Call<typeof createCancelPayment, _CancelPaymentPayload>
export type CancelRequestPayload = $Call<typeof createCancelRequest, _CancelRequestPayload>
export type ChangeAccountNamePayload = $Call<typeof createChangeAccountName, _ChangeAccountNamePayload>
export type ChangeDisplayCurrencyPayload = $Call<typeof createChangeDisplayCurrency, _ChangeDisplayCurrencyPayload>
export type ChangedAccountNamePayload = $Call<typeof createChangedAccountName, _ChangedAccountNamePayload>
export type ChangedAccountNamePayloadError = $Call<typeof createChangedAccountNameError, _ChangedAccountNamePayloadError>
export type ClearBuildingPayload = $Call<typeof createClearBuilding, _ClearBuildingPayload>
export type ClearBuiltPaymentPayload = $Call<typeof createClearBuiltPayment, _ClearBuiltPaymentPayload>
export type ClearBuiltRequestPayload = $Call<typeof createClearBuiltRequest, _ClearBuiltRequestPayload>
export type ClearErrorsPayload = $Call<typeof createClearErrors, _ClearErrorsPayload>
export type ClearNewPaymentsPayload = $Call<typeof createClearNewPayments, _ClearNewPaymentsPayload>
export type CreateNewAccountPayload = $Call<typeof createCreateNewAccount, _CreateNewAccountPayload>
export type CreatedNewAccountPayload = $Call<typeof createCreatedNewAccount, _CreatedNewAccountPayload>
export type CreatedNewAccountPayloadError = $Call<typeof createCreatedNewAccountError, _CreatedNewAccountPayloadError>
export type DeleteAccountPayload = $Call<typeof createDeleteAccount, _DeleteAccountPayload>
export type DeletedAccountPayload = $Call<typeof createDeletedAccount, _DeletedAccountPayload>
export type DidSetAccountAsDefaultPayload = $Call<typeof createDidSetAccountAsDefault, _DidSetAccountAsDefaultPayload>
export type DisplayCurrenciesReceivedPayload = $Call<typeof createDisplayCurrenciesReceived, _DisplayCurrenciesReceivedPayload>
export type DisplayCurrencyReceivedPayload = $Call<typeof createDisplayCurrencyReceived, _DisplayCurrencyReceivedPayload>
export type ExportSecretKeyPayload = $Call<typeof createExportSecretKey, _ExportSecretKeyPayload>
export type LinkExistingAccountPayload = $Call<typeof createLinkExistingAccount, _LinkExistingAccountPayload>
export type LinkedExistingAccountPayload = $Call<typeof createLinkedExistingAccount, _LinkedExistingAccountPayload>
export type LinkedExistingAccountPayloadError = $Call<typeof createLinkedExistingAccountError, _LinkedExistingAccountPayloadError>
export type LoadAccountsPayload = $Call<typeof createLoadAccounts, _LoadAccountsPayload>
export type LoadAssetsPayload = $Call<typeof createLoadAssets, _LoadAssetsPayload>
export type LoadDisplayCurrenciesPayload = $Call<typeof createLoadDisplayCurrencies, _LoadDisplayCurrenciesPayload>
export type LoadDisplayCurrencyPayload = $Call<typeof createLoadDisplayCurrency, _LoadDisplayCurrencyPayload>
export type LoadMorePaymentsPayload = $Call<typeof createLoadMorePayments, _LoadMorePaymentsPayload>
export type LoadPaymentDetailPayload = $Call<typeof createLoadPaymentDetail, _LoadPaymentDetailPayload>
export type LoadPaymentsPayload = $Call<typeof createLoadPayments, _LoadPaymentsPayload>
export type LoadRequestDetailPayload = $Call<typeof createLoadRequestDetail, _LoadRequestDetailPayload>
export type LoadSendAssetChoicesPayload = $Call<typeof createLoadSendAssetChoices, _LoadSendAssetChoicesPayload>
export type LoadWalletDisclaimerPayload = $Call<typeof createLoadWalletDisclaimer, _LoadWalletDisclaimerPayload>
export type MarkAsReadPayload = $Call<typeof createMarkAsRead, _MarkAsReadPayload>
export type OpenSendRequestFormPayload = $Call<typeof createOpenSendRequestForm, _OpenSendRequestFormPayload>
export type PaymentDetailReceivedPayload = $Call<typeof createPaymentDetailReceived, _PaymentDetailReceivedPayload>
export type PaymentsReceivedPayload = $Call<typeof createPaymentsReceived, _PaymentsReceivedPayload>
export type RefreshPaymentsPayload = $Call<typeof createRefreshPayments, _RefreshPaymentsPayload>
export type RejectDisclaimerPayload = $Call<typeof createRejectDisclaimer, _RejectDisclaimerPayload>
export type RequestDetailReceivedPayload = $Call<typeof createRequestDetailReceived, _RequestDetailReceivedPayload>
export type RequestPaymentPayload = $Call<typeof createRequestPayment, _RequestPaymentPayload>
export type RequestedPaymentPayload = $Call<typeof createRequestedPayment, _RequestedPaymentPayload>
export type SecretKeyReceivedPayload = $Call<typeof createSecretKeyReceived, _SecretKeyReceivedPayload>
export type SecretKeySeenPayload = $Call<typeof createSecretKeySeen, _SecretKeySeenPayload>
export type SelectAccountPayload = $Call<typeof createSelectAccount, _SelectAccountPayload>
export type SendAssetChoicesReceivedPayload = $Call<typeof createSendAssetChoicesReceived, _SendAssetChoicesReceivedPayload>
export type SendPaymentPayload = $Call<typeof createSendPayment, _SendPaymentPayload>
export type SentPaymentErrorPayload = $Call<typeof createSentPaymentError, _SentPaymentErrorPayload>
export type SentPaymentPayload = $Call<typeof createSentPayment, _SentPaymentPayload>
export type SetAccountAsDefaultPayload = $Call<typeof createSetAccountAsDefault, _SetAccountAsDefaultPayload>
export type SetBuildingAmountPayload = $Call<typeof createSetBuildingAmount, _SetBuildingAmountPayload>
export type SetBuildingCurrencyPayload = $Call<typeof createSetBuildingCurrency, _SetBuildingCurrencyPayload>
export type SetBuildingFromPayload = $Call<typeof createSetBuildingFrom, _SetBuildingFromPayload>
export type SetBuildingIsRequestPayload = $Call<typeof createSetBuildingIsRequest, _SetBuildingIsRequestPayload>
export type SetBuildingPublicMemoPayload = $Call<typeof createSetBuildingPublicMemo, _SetBuildingPublicMemoPayload>
export type SetBuildingRecipientTypePayload = $Call<typeof createSetBuildingRecipientType, _SetBuildingRecipientTypePayload>
export type SetBuildingSecretNotePayload = $Call<typeof createSetBuildingSecretNote, _SetBuildingSecretNotePayload>
export type SetBuildingToPayload = $Call<typeof createSetBuildingTo, _SetBuildingToPayload>
export type SetLastSentXLMPayload = $Call<typeof createSetLastSentXLM, _SetLastSentXLMPayload>
export type ValidateAccountNamePayload = $Call<typeof createValidateAccountName, _ValidateAccountNamePayload>
export type ValidateSecretKeyPayload = $Call<typeof createValidateSecretKey, _ValidateSecretKeyPayload>
export type ValidatedAccountNamePayload = $Call<typeof createValidatedAccountName, _ValidatedAccountNamePayload>
export type ValidatedAccountNamePayloadError = $Call<typeof createValidatedAccountNameError, _ValidatedAccountNamePayloadError>
export type ValidatedSecretKeyPayload = $Call<typeof createValidatedSecretKey, _ValidatedSecretKeyPayload>
export type ValidatedSecretKeyPayloadError = $Call<typeof createValidatedSecretKeyError, _ValidatedSecretKeyPayloadError>
export type WalletDisclaimerReceivedPayload = $Call<typeof createWalletDisclaimerReceived, _WalletDisclaimerReceivedPayload>

// All Actions
// prettier-ignore
export type Actions =
  | AbandonPaymentPayload
  | AcceptDisclaimerPayload
  | AccountsReceivedPayload
  | AddNewPaymentPayload
  | AssetsReceivedPayload
  | BadgesUpdatedPayload
  | BuildPaymentPayload
  | BuiltPaymentReceivedPayload
  | BuiltRequestReceivedPayload
  | CancelPaymentPayload
  | CancelRequestPayload
  | ChangeAccountNamePayload
  | ChangeDisplayCurrencyPayload
  | ChangedAccountNamePayload
  | ChangedAccountNamePayloadError
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
  | ExportSecretKeyPayload
  | LinkExistingAccountPayload
  | LinkedExistingAccountPayload
  | LinkedExistingAccountPayloadError
  | LoadAccountsPayload
  | LoadAssetsPayload
  | LoadDisplayCurrenciesPayload
  | LoadDisplayCurrencyPayload
  | LoadMorePaymentsPayload
  | LoadPaymentDetailPayload
  | LoadPaymentsPayload
  | LoadRequestDetailPayload
  | LoadSendAssetChoicesPayload
  | LoadWalletDisclaimerPayload
  | MarkAsReadPayload
  | OpenSendRequestFormPayload
  | PaymentDetailReceivedPayload
  | PaymentsReceivedPayload
  | RefreshPaymentsPayload
  | RejectDisclaimerPayload
  | RequestDetailReceivedPayload
  | RequestPaymentPayload
  | RequestedPaymentPayload
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
  | SetLastSentXLMPayload
  | ValidateAccountNamePayload
  | ValidateSecretKeyPayload
  | ValidatedAccountNamePayload
  | ValidatedAccountNamePayloadError
  | ValidatedSecretKeyPayload
  | ValidatedSecretKeyPayloadError
  | WalletDisclaimerReceivedPayload
  | {type: 'common:resetStore', payload: void}
