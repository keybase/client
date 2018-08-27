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
export const accountsReceived = 'wallets:accountsReceived'
export const assetsReceived = 'wallets:assetsReceived'
export const buildPayment = 'wallets:buildPayment'
export const builtPaymentReceived = 'wallets:builtPaymentReceived'
export const cancelRequest = 'wallets:cancelRequest'
export const clearBuildingPayment = 'wallets:clearBuildingPayment'
export const clearBuiltPayment = 'wallets:clearBuiltPayment'
export const clearErrors = 'wallets:clearErrors'
export const createNewAccount = 'wallets:createNewAccount'
export const createdNewAccount = 'wallets:createdNewAccount'
export const exportSecretKey = 'wallets:exportSecretKey'
export const linkExistingAccount = 'wallets:linkExistingAccount'
export const linkedExistingAccount = 'wallets:linkedExistingAccount'
export const loadAccounts = 'wallets:loadAccounts'
export const loadAssets = 'wallets:loadAssets'
export const loadPaymentDetail = 'wallets:loadPaymentDetail'
export const loadPayments = 'wallets:loadPayments'
<<<<<<< HEAD
export const loadRequestDetail = 'wallets:loadRequestDetail'
=======
export const makeRequestLocal = 'wallets:makeRequestLocal'
>>>>>>> 0726f20aac... Update generated actions with makeRequestLocal
export const paymentDetailReceived = 'wallets:paymentDetailReceived'
export const paymentsReceived = 'wallets:paymentsReceived'
export const refreshPayments = 'wallets:refreshPayments'
export const requestDetailReceived = 'wallets:requestDetailReceived'
export const secretKeyReceived = 'wallets:secretKeyReceived'
export const secretKeySeen = 'wallets:secretKeySeen'
export const selectAccount = 'wallets:selectAccount'
export const sendPayment = 'wallets:sendPayment'
export const sentPayment = 'wallets:sentPayment'
export const setBuildingAmount = 'wallets:setBuildingAmount'
export const setBuildingCurrency = 'wallets:setBuildingCurrency'
export const setBuildingFrom = 'wallets:setBuildingFrom'
export const setBuildingPublicMemo = 'wallets:setBuildingPublicMemo'
export const setBuildingRecipientType = 'wallets:setBuildingRecipientType'
export const setBuildingSecretNote = 'wallets:setBuildingSecretNote'
export const setBuildingTo = 'wallets:setBuildingTo'
export const validateAccountName = 'wallets:validateAccountName'
export const validateSecretKey = 'wallets:validateSecretKey'
export const validatedAccountName = 'wallets:validatedAccountName'
export const validatedSecretKey = 'wallets:validatedSecretKey'

// Payload Types
type _AccountsReceivedPayload = $ReadOnly<{|accounts: Array<Types.Account>|}>
type _AssetsReceivedPayload = $ReadOnly<{|
  accountID: Types.AccountID,
  assets: Array<Types.Assets>,
|}>
type _BuildPaymentPayload = void
type _BuiltPaymentReceivedPayload = $ReadOnly<{|build: Types.BuiltPayment|}>
type _CancelRequestPayload = $ReadOnly<{|
  conversationIDKey?: ChatTypes.ConversationIDKey,
  ordinal?: ChatTypes.Ordinal,
  requestID: StellarRPCTypes.KeybaseRequestID,
|}>
type _ClearBuildingPaymentPayload = void
type _ClearBuiltPaymentPayload = void
type _ClearErrorsPayload = void
type _CreateNewAccountPayload = $ReadOnly<{|name: string|}>
type _CreatedNewAccountPayload = $ReadOnly<{|accountID: Types.AccountID|}>
type _CreatedNewAccountPayloadError = $ReadOnly<{|
  name: string,
  error: string,
|}>
type _ExportSecretKeyPayload = $ReadOnly<{|accountID: Types.AccountID|}>
type _LinkExistingAccountPayload = $ReadOnly<{|
  name: string,
  secretKey: HiddenString,
|}>
type _LinkedExistingAccountPayload = $ReadOnly<{|accountID: Types.AccountID|}>
type _LinkedExistingAccountPayloadError = $ReadOnly<{|
  name: string,
  secretKey: HiddenString,
  error: string,
|}>
type _LoadAccountsPayload = void
type _LoadAssetsPayload = $ReadOnly<{|accountID: Types.AccountID|}>
type _LoadPaymentDetailPayload = $ReadOnly<{|
  accountID: Types.AccountID,
  paymentID: StellarRPCTypes.PaymentID,
|}>
type _LoadPaymentsPayload = $ReadOnly<{|accountID: Types.AccountID|}>
<<<<<<< HEAD
type _LoadRequestDetailPayload = $ReadOnly<{|requestID: StellarRPCTypes.KeybaseRequestID|}>
=======
type _MakeRequestLocalPayload = void
>>>>>>> 0726f20aac... Update generated actions with makeRequestLocal
type _PaymentDetailReceivedPayload = $ReadOnly<{|
  accountID: Types.AccountID,
  paymentID: StellarRPCTypes.PaymentID,
  publicMemo: HiddenString,
  publicMemoType: string,
  txID: string,
|}>
type _PaymentsReceivedPayload = $ReadOnly<{|
  accountID: Types.AccountID,
  payments: Array<Types.Payment>,
  pending: Array<Types.Payment>,
|}>
type _RefreshPaymentsPayload = $ReadOnly<{|accountID: Types.AccountID|}>
type _RequestDetailReceivedPayload = $ReadOnly<{|request: StellarRPCTypes.RequestDetailsLocal|}>
type _SecretKeyReceivedPayload = $ReadOnly<{|
  accountID: Types.AccountID,
  secretKey: HiddenString,
|}>
type _SecretKeySeenPayload = $ReadOnly<{|accountID: Types.AccountID|}>
type _SelectAccountPayload = $ReadOnly<{|
  accountID: Types.AccountID,
  show?: boolean,
|}>
type _SendPaymentPayload = void
type _SentPaymentPayload = $ReadOnly<{|kbTxID: HiddenString|}>
type _SetBuildingAmountPayload = $ReadOnly<{|amount: string|}>
type _SetBuildingCurrencyPayload = $ReadOnly<{|currency: string|}>
type _SetBuildingFromPayload = $ReadOnly<{|from: string|}>
type _SetBuildingPublicMemoPayload = $ReadOnly<{|publicMemo: HiddenString|}>
type _SetBuildingRecipientTypePayload = $ReadOnly<{|recipientType: Types.CounterpartyType|}>
type _SetBuildingSecretNotePayload = $ReadOnly<{|secretNote: HiddenString|}>
type _SetBuildingToPayload = $ReadOnly<{|to: string|}>
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

// Action Creators
/**
 * Add a new wallet to your account
 */
export const createCreateNewAccount = (payload: _CreateNewAccountPayload) => ({error: false, payload, type: createNewAccount})
/**
 * Ask the service to validate an account name.
 */
export const createValidateAccountName = (payload: _ValidateAccountNamePayload) => ({error: false, payload, type: validateAccountName})
/**
 * Ask the service to validate an account secret key.
 */
export const createValidateSecretKey = (payload: _ValidateSecretKeyPayload) => ({error: false, payload, type: validateSecretKey})
/**
 * Cancel a request. Optionally delete an associated message
 */
export const createCancelRequest = (payload: _CancelRequestPayload) => ({error: false, payload, type: cancelRequest})
/**
 * Clear a payment that was being prepared
 */
export const createClearBuildingPayment = (payload: _ClearBuildingPaymentPayload) => ({error: false, payload, type: clearBuildingPayment})
/**
 * Clear a prepared payment once it has been sent or canceled
 */
export const createClearBuiltPayment = (payload: _ClearBuiltPaymentPayload) => ({error: false, payload, type: clearBuiltPayment})
/**
 * Clear errors from the store at times like opening or closing a form dialog.
 */
export const createClearErrors = (payload: _ClearErrorsPayload) => ({error: false, payload, type: clearErrors})
/**
 * Clear exported secret keys from our store once they've been seen
 */
export const createSecretKeySeen = (payload: _SecretKeySeenPayload) => ({error: false, payload, type: secretKeySeen})
/**
 * Export a Stellar account's secret key
 */
export const createExportSecretKey = (payload: _ExportSecretKeyPayload) => ({error: false, payload, type: exportSecretKey})
/**
 * In response to a notification, resync payment info
 */
export const createRefreshPayments = (payload: _RefreshPaymentsPayload) => ({error: false, payload, type: refreshPayments})
/**
 * Link an existing Stellar account with this Keybase user.
 */
export const createLinkExistingAccount = (payload: _LinkExistingAccountPayload) => ({error: false, payload, type: linkExistingAccount})
/**
 * Load a request's details
 */
export const createLoadRequestDetail = (payload: _LoadRequestDetailPayload) => ({error: false, payload, type: loadRequestDetail})
/**
 * Load extra detail for one given payment
 */
export const createLoadPaymentDetail = (payload: _LoadPaymentDetailPayload) => ({error: false, payload, type: loadPaymentDetail})
/**
 * Perform sending a payment
 */
export const createSendPayment = (payload: _SendPaymentPayload) => ({error: false, payload, type: sendPayment})
/**
 * Prepare a payment for sending
 */
export const createBuildPayment = (payload: _BuildPaymentPayload) => ({error: false, payload, type: buildPayment})
/**
 * Refresh our list of accounts
 */
export const createLoadAccounts = (payload: _LoadAccountsPayload) => ({error: false, payload, type: loadAccounts})
/**
 * Refresh our list of assets for a given account
 */
export const createLoadAssets = (payload: _LoadAssetsPayload) => ({error: false, payload, type: loadAssets})
/**
 * Refresh our list of payments for a given account
 */
export const createLoadPayments = (payload: _LoadPaymentsPayload) => ({error: false, payload, type: loadPayments})
/**
 * Request payment
 */
export const createMakeRequestLocal = (payload: _MakeRequestLocalPayload) => ({error: false, payload, type: makeRequestLocal})
/**
 * Select an account. Optionally navigate to the account page.
 */
export const createSelectAccount = (payload: _SelectAccountPayload) => ({error: false, payload, type: selectAccount})
/**
 * Set building amount
 */
export const createSetBuildingAmount = (payload: _SetBuildingAmountPayload) => ({error: false, payload, type: setBuildingAmount})
/**
 * Set building currency
 */
export const createSetBuildingCurrency = (payload: _SetBuildingCurrencyPayload) => ({error: false, payload, type: setBuildingCurrency})
/**
 * Set building from
 */
export const createSetBuildingFrom = (payload: _SetBuildingFromPayload) => ({error: false, payload, type: setBuildingFrom})
/**
 * Set building public memo
 */
export const createSetBuildingPublicMemo = (payload: _SetBuildingPublicMemoPayload) => ({error: false, payload, type: setBuildingPublicMemo})
/**
 * Set building recipient type
 */
export const createSetBuildingRecipientType = (payload: _SetBuildingRecipientTypePayload) => ({error: false, payload, type: setBuildingRecipientType})
/**
 * Set building secret note
 */
export const createSetBuildingSecretNote = (payload: _SetBuildingSecretNotePayload) => ({error: false, payload, type: setBuildingSecretNote})
/**
 * Set building to -- depends on recipientType
 */
export const createSetBuildingTo = (payload: _SetBuildingToPayload) => ({error: false, payload, type: setBuildingTo})
/**
 * Store a request's details
 */
export const createRequestDetailReceived = (payload: _RequestDetailReceivedPayload) => ({error: false, payload, type: requestDetailReceived})
/**
 * Successfully sent a payment
 */
export const createSentPayment = (payload: _SentPaymentPayload) => ({error: false, payload, type: sentPayment})
/**
 * The service responded with an error or that the account name is valid.
 */
export const createValidatedAccountName = (payload: _ValidatedAccountNamePayload) => ({error: false, payload, type: validatedAccountName})
export const createValidatedAccountNameError = (payload: _ValidatedAccountNamePayloadError) => ({error: true, payload, type: validatedAccountName})
/**
 * The service responded with an error or that the create new account operation succeeded
 */
export const createCreatedNewAccount = (payload: _CreatedNewAccountPayload) => ({error: false, payload, type: createdNewAccount})
export const createCreatedNewAccountError = (payload: _CreatedNewAccountPayloadError) => ({error: true, payload, type: createdNewAccount})
/**
 * The service responded with an error or that the link existing operation succeeded
 */
export const createLinkedExistingAccount = (payload: _LinkedExistingAccountPayload) => ({error: false, payload, type: linkedExistingAccount})
export const createLinkedExistingAccountError = (payload: _LinkedExistingAccountPayloadError) => ({error: true, payload, type: linkedExistingAccount})
/**
 * The service responded with an error or that the secret key is valid.
 */
export const createValidatedSecretKey = (payload: _ValidatedSecretKeyPayload) => ({error: false, payload, type: validatedSecretKey})
export const createValidatedSecretKeyError = (payload: _ValidatedSecretKeyPayloadError) => ({error: true, payload, type: validatedSecretKey})
/**
 * Update a payment with additional detail
 */
export const createPaymentDetailReceived = (payload: _PaymentDetailReceivedPayload) => ({error: false, payload, type: paymentDetailReceived})
/**
 * Update our store of account data
 */
export const createAccountsReceived = (payload: _AccountsReceivedPayload) => ({error: false, payload, type: accountsReceived})
/**
 * Update our store of assets data
 */
export const createAssetsReceived = (payload: _AssetsReceivedPayload) => ({error: false, payload, type: assetsReceived})
/**
 * Update our store of payments data
 */
export const createPaymentsReceived = (payload: _PaymentsReceivedPayload) => ({error: false, payload, type: paymentsReceived})
/**
 * Update our store with a prepared payment
 */
export const createBuiltPaymentReceived = (payload: _BuiltPaymentReceivedPayload) => ({error: false, payload, type: builtPaymentReceived})
/**
 * Update our store with an exported secret key
 */
export const createSecretKeyReceived = (payload: _SecretKeyReceivedPayload) => ({error: false, payload, type: secretKeyReceived})

// Action Payloads
export type AccountsReceivedPayload = $Call<typeof createAccountsReceived, _AccountsReceivedPayload>
export type AssetsReceivedPayload = $Call<typeof createAssetsReceived, _AssetsReceivedPayload>
export type BuildPaymentPayload = $Call<typeof createBuildPayment, _BuildPaymentPayload>
export type BuiltPaymentReceivedPayload = $Call<typeof createBuiltPaymentReceived, _BuiltPaymentReceivedPayload>
export type CancelRequestPayload = $Call<typeof createCancelRequest, _CancelRequestPayload>
export type ClearBuildingPaymentPayload = $Call<typeof createClearBuildingPayment, _ClearBuildingPaymentPayload>
export type ClearBuiltPaymentPayload = $Call<typeof createClearBuiltPayment, _ClearBuiltPaymentPayload>
export type ClearErrorsPayload = $Call<typeof createClearErrors, _ClearErrorsPayload>
export type CreateNewAccountPayload = $Call<typeof createCreateNewAccount, _CreateNewAccountPayload>
export type CreatedNewAccountPayload = $Call<typeof createCreatedNewAccount, _CreatedNewAccountPayload>
export type CreatedNewAccountPayloadError = $Call<typeof createCreatedNewAccountError, _CreatedNewAccountPayloadError>
export type ExportSecretKeyPayload = $Call<typeof createExportSecretKey, _ExportSecretKeyPayload>
export type LinkExistingAccountPayload = $Call<typeof createLinkExistingAccount, _LinkExistingAccountPayload>
export type LinkedExistingAccountPayload = $Call<typeof createLinkedExistingAccount, _LinkedExistingAccountPayload>
export type LinkedExistingAccountPayloadError = $Call<typeof createLinkedExistingAccountError, _LinkedExistingAccountPayloadError>
export type LoadAccountsPayload = $Call<typeof createLoadAccounts, _LoadAccountsPayload>
export type LoadAssetsPayload = $Call<typeof createLoadAssets, _LoadAssetsPayload>
export type LoadPaymentDetailPayload = $Call<typeof createLoadPaymentDetail, _LoadPaymentDetailPayload>
export type LoadPaymentsPayload = $Call<typeof createLoadPayments, _LoadPaymentsPayload>
export type LoadRequestDetailPayload = $Call<typeof createLoadRequestDetail, _LoadRequestDetailPayload>
export type MakeRequestLocalPayload = $Call<typeof createMakeRequestLocal, _MakeRequestLocalPayload>
export type PaymentDetailReceivedPayload = $Call<typeof createPaymentDetailReceived, _PaymentDetailReceivedPayload>
export type PaymentsReceivedPayload = $Call<typeof createPaymentsReceived, _PaymentsReceivedPayload>
export type RefreshPaymentsPayload = $Call<typeof createRefreshPayments, _RefreshPaymentsPayload>
export type RequestDetailReceivedPayload = $Call<typeof createRequestDetailReceived, _RequestDetailReceivedPayload>
export type SecretKeyReceivedPayload = $Call<typeof createSecretKeyReceived, _SecretKeyReceivedPayload>
export type SecretKeySeenPayload = $Call<typeof createSecretKeySeen, _SecretKeySeenPayload>
export type SelectAccountPayload = $Call<typeof createSelectAccount, _SelectAccountPayload>
export type SendPaymentPayload = $Call<typeof createSendPayment, _SendPaymentPayload>
export type SentPaymentPayload = $Call<typeof createSentPayment, _SentPaymentPayload>
export type SetBuildingAmountPayload = $Call<typeof createSetBuildingAmount, _SetBuildingAmountPayload>
export type SetBuildingCurrencyPayload = $Call<typeof createSetBuildingCurrency, _SetBuildingCurrencyPayload>
export type SetBuildingFromPayload = $Call<typeof createSetBuildingFrom, _SetBuildingFromPayload>
export type SetBuildingPublicMemoPayload = $Call<typeof createSetBuildingPublicMemo, _SetBuildingPublicMemoPayload>
export type SetBuildingRecipientTypePayload = $Call<typeof createSetBuildingRecipientType, _SetBuildingRecipientTypePayload>
export type SetBuildingSecretNotePayload = $Call<typeof createSetBuildingSecretNote, _SetBuildingSecretNotePayload>
export type SetBuildingToPayload = $Call<typeof createSetBuildingTo, _SetBuildingToPayload>
export type ValidateAccountNamePayload = $Call<typeof createValidateAccountName, _ValidateAccountNamePayload>
export type ValidateSecretKeyPayload = $Call<typeof createValidateSecretKey, _ValidateSecretKeyPayload>
export type ValidatedAccountNamePayload = $Call<typeof createValidatedAccountName, _ValidatedAccountNamePayload>
export type ValidatedAccountNamePayloadError = $Call<typeof createValidatedAccountNameError, _ValidatedAccountNamePayloadError>
export type ValidatedSecretKeyPayload = $Call<typeof createValidatedSecretKey, _ValidatedSecretKeyPayload>
export type ValidatedSecretKeyPayloadError = $Call<typeof createValidatedSecretKeyError, _ValidatedSecretKeyPayloadError>

// All Actions
// prettier-ignore
export type Actions =
  | AccountsReceivedPayload
  | AssetsReceivedPayload
  | BuildPaymentPayload
  | BuiltPaymentReceivedPayload
  | CancelRequestPayload
  | ClearBuildingPaymentPayload
  | ClearBuiltPaymentPayload
  | ClearErrorsPayload
  | CreateNewAccountPayload
  | CreatedNewAccountPayload
  | CreatedNewAccountPayloadError
  | ExportSecretKeyPayload
  | LinkExistingAccountPayload
  | LinkedExistingAccountPayload
  | LinkedExistingAccountPayloadError
  | LoadAccountsPayload
  | LoadAssetsPayload
  | LoadPaymentDetailPayload
  | LoadPaymentsPayload
<<<<<<< HEAD
  | LoadRequestDetailPayload
=======
  | MakeRequestLocalPayload
>>>>>>> 0726f20aac... Update generated actions with makeRequestLocal
  | PaymentDetailReceivedPayload
  | PaymentsReceivedPayload
  | RefreshPaymentsPayload
  | RequestDetailReceivedPayload
  | SecretKeyReceivedPayload
  | SecretKeySeenPayload
  | SelectAccountPayload
  | SendPaymentPayload
  | SentPaymentPayload
  | SetBuildingAmountPayload
  | SetBuildingCurrencyPayload
  | SetBuildingFromPayload
  | SetBuildingPublicMemoPayload
  | SetBuildingRecipientTypePayload
  | SetBuildingSecretNotePayload
  | SetBuildingToPayload
  | ValidateAccountNamePayload
  | ValidateSecretKeyPayload
  | ValidatedAccountNamePayload
  | ValidatedAccountNamePayloadError
  | ValidatedSecretKeyPayload
  | ValidatedSecretKeyPayloadError
  | {type: 'common:resetStore', payload: void}
