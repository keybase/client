// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from '../constants/types/wallets'
import * as StellarRPCTypes from '../constants/types/rpc-stellar-gen'
import HiddenString from '../util/hidden-string'

// Constants
export const resetStore = 'common:resetStore' // not a part of wallets but is handled by every reducer
export const accountsReceived = 'wallets:accountsReceived'
export const assetsReceived = 'wallets:assetsReceived'
export const changeAccountName = 'wallets:changeAccountName'
export const changeDisplayCurrency = 'wallets:changeDisplayCurrency'
export const clearErrors = 'wallets:clearErrors'
export const deleteAccount = 'wallets:deleteAccount'
export const displayCurrenciesReceived = 'wallets:displayCurrenciesReceived'
export const exportSecretKey = 'wallets:exportSecretKey'
export const getDisplayCurrency = 'wallets:getDisplayCurrency'
export const linkExistingAccount = 'wallets:linkExistingAccount'
export const linkedExistingAccount = 'wallets:linkedExistingAccount'
export const loadAccounts = 'wallets:loadAccounts'
export const loadAssets = 'wallets:loadAssets'
export const loadDisplayCurrencies = 'wallets:loadDisplayCurrencies'
export const loadPaymentDetail = 'wallets:loadPaymentDetail'
export const loadPayments = 'wallets:loadPayments'
export const paymentDetailReceived = 'wallets:paymentDetailReceived'
export const paymentsReceived = 'wallets:paymentsReceived'
export const secretKeyReceived = 'wallets:secretKeyReceived'
export const secretKeySeen = 'wallets:secretKeySeen'
export const selectAccount = 'wallets:selectAccount'
export const setAccountAsDefault = 'wallets:setAccountAsDefault'
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
type _ChangeAccountNamePayload = $ReadOnly<{|
  accountID: Types.AccountID,
  name: Types.OutsideCurrencyCode,
|}>
type _ChangeDisplayCurrencyPayload = $ReadOnly<{|
  accountID: Types.AccountID,
  currency: string,
|}>
type _ClearErrorsPayload = void
type _DeleteAccountPayload = $ReadOnly<{|accountID: Types.AccountID|}>
type _DisplayCurrenciesReceivedPayload = $ReadOnly<{|currencies: Array<Types.CurrencyLocal>|}>
type _ExportSecretKeyPayload = $ReadOnly<{|accountID: Types.AccountID|}>
type _GetDisplayCurrencyPayload = $ReadOnly<{|accountID: Types.AccountID|}>
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
type _LoadDisplayCurrenciesPayload = void
type _LoadPaymentDetailPayload = $ReadOnly<{|
  accountID: Types.AccountID,
  paymentID: StellarRPCTypes.PaymentID,
|}>
type _LoadPaymentsPayload = $ReadOnly<{|accountID: Types.AccountID|}>
type _PaymentDetailReceivedPayload = $ReadOnly<{|
  accountID: Types.AccountID,
  paymentID: StellarRPCTypes.PaymentID,
  publicNote: string,
  publicNoteType: string,
  txID: string,
|}>
type _PaymentsReceivedPayload = $ReadOnly<{|
  accountID: Types.AccountID,
  payments: Array<Types.Payment>,
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
type _SetAccountAsDefaultPayload = $ReadOnly<{|accountID: Types.AccountID|}>
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
 * Ask the service to validate an account name.
 */
export const createValidateAccountName = (payload: _ValidateAccountNamePayload) => ({error: false, payload, type: validateAccountName})
/**
 * Ask the service to validate an account secret key.
 */
export const createValidateSecretKey = (payload: _ValidateSecretKeyPayload) => ({error: false, payload, type: validateSecretKey})
/**
 * Change display currency for an account
 */
export const createChangeDisplayCurrency = (payload: _ChangeDisplayCurrencyPayload) => ({error: false, payload, type: changeDisplayCurrency})
/**
 * Change the default account
 */
export const createSetAccountAsDefault = (payload: _SetAccountAsDefaultPayload) => ({error: false, payload, type: setAccountAsDefault})
/**
 * Change the name of an account
 */
export const createChangeAccountName = (payload: _ChangeAccountNamePayload) => ({error: false, payload, type: changeAccountName})
/**
 * Clear errors from the store at times like opening or closing a form dialog.
 */
export const createClearErrors = (payload: _ClearErrorsPayload) => ({error: false, payload, type: clearErrors})
/**
 * Clear exported secret keys from our store once they've been seen
 */
export const createSecretKeySeen = (payload: _SecretKeySeenPayload) => ({error: false, payload, type: secretKeySeen})
/**
 * Delete an account
 */
export const createDeleteAccount = (payload: _DeleteAccountPayload) => ({error: false, payload, type: deleteAccount})
/**
 * Export a Stellar account's secret key
 */
export const createExportSecretKey = (payload: _ExportSecretKeyPayload) => ({error: false, payload, type: exportSecretKey})
/**
 * Link an existing Stellar account with this Keybase user.
 */
export const createLinkExistingAccount = (payload: _LinkExistingAccountPayload) => ({error: false, payload, type: linkExistingAccount})
/**
 * Load display currency for an account
 */
export const createGetDisplayCurrency = (payload: _GetDisplayCurrencyPayload) => ({error: false, payload, type: getDisplayCurrency})
/**
 * Load extra detail for one given payment
 */
export const createLoadPaymentDetail = (payload: _LoadPaymentDetailPayload) => ({error: false, payload, type: loadPaymentDetail})
/**
 * Load valid display currencies to choose from
 */
export const createLoadDisplayCurrencies = (payload: _LoadDisplayCurrenciesPayload) => ({error: false, payload, type: loadDisplayCurrencies})
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
 * Select an account. Optionally navigate to the account page.
 */
export const createSelectAccount = (payload: _SelectAccountPayload) => ({error: false, payload, type: selectAccount})
/**
 * The service responded with an error or that the account name is valid.
 */
export const createValidatedAccountName = (payload: _ValidatedAccountNamePayload) => ({error: false, payload, type: validatedAccountName})
export const createValidatedAccountNameError = (payload: _ValidatedAccountNamePayloadError) => ({error: true, payload, type: validatedAccountName})
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
 * Update our store with an exported secret key
 */
export const createSecretKeyReceived = (payload: _SecretKeyReceivedPayload) => ({error: false, payload, type: secretKeyReceived})
/**
 * Update valid display currencies to choose from
 */
export const createDisplayCurrenciesReceived = (payload: _DisplayCurrenciesReceivedPayload) => ({error: false, payload, type: displayCurrenciesReceived})

// Action Payloads
export type AccountsReceivedPayload = $Call<typeof createAccountsReceived, _AccountsReceivedPayload>
export type AssetsReceivedPayload = $Call<typeof createAssetsReceived, _AssetsReceivedPayload>
export type ChangeAccountNamePayload = $Call<typeof createChangeAccountName, _ChangeAccountNamePayload>
export type ChangeDisplayCurrencyPayload = $Call<typeof createChangeDisplayCurrency, _ChangeDisplayCurrencyPayload>
export type ClearErrorsPayload = $Call<typeof createClearErrors, _ClearErrorsPayload>
export type DeleteAccountPayload = $Call<typeof createDeleteAccount, _DeleteAccountPayload>
export type DisplayCurrenciesReceivedPayload = $Call<typeof createDisplayCurrenciesReceived, _DisplayCurrenciesReceivedPayload>
export type ExportSecretKeyPayload = $Call<typeof createExportSecretKey, _ExportSecretKeyPayload>
export type GetDisplayCurrencyPayload = $Call<typeof createGetDisplayCurrency, _GetDisplayCurrencyPayload>
export type LinkExistingAccountPayload = $Call<typeof createLinkExistingAccount, _LinkExistingAccountPayload>
export type LinkedExistingAccountPayload = $Call<typeof createLinkedExistingAccount, _LinkedExistingAccountPayload>
export type LinkedExistingAccountPayloadError = $Call<typeof createLinkedExistingAccountError, _LinkedExistingAccountPayloadError>
export type LoadAccountsPayload = $Call<typeof createLoadAccounts, _LoadAccountsPayload>
export type LoadAssetsPayload = $Call<typeof createLoadAssets, _LoadAssetsPayload>
export type LoadDisplayCurrenciesPayload = $Call<typeof createLoadDisplayCurrencies, _LoadDisplayCurrenciesPayload>
export type LoadPaymentDetailPayload = $Call<typeof createLoadPaymentDetail, _LoadPaymentDetailPayload>
export type LoadPaymentsPayload = $Call<typeof createLoadPayments, _LoadPaymentsPayload>
export type PaymentDetailReceivedPayload = $Call<typeof createPaymentDetailReceived, _PaymentDetailReceivedPayload>
export type PaymentsReceivedPayload = $Call<typeof createPaymentsReceived, _PaymentsReceivedPayload>
export type SecretKeyReceivedPayload = $Call<typeof createSecretKeyReceived, _SecretKeyReceivedPayload>
export type SecretKeySeenPayload = $Call<typeof createSecretKeySeen, _SecretKeySeenPayload>
export type SelectAccountPayload = $Call<typeof createSelectAccount, _SelectAccountPayload>
export type SetAccountAsDefaultPayload = $Call<typeof createSetAccountAsDefault, _SetAccountAsDefaultPayload>
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
  | ChangeAccountNamePayload
  | ChangeDisplayCurrencyPayload
  | ClearErrorsPayload
  | DeleteAccountPayload
  | DisplayCurrenciesReceivedPayload
  | ExportSecretKeyPayload
  | GetDisplayCurrencyPayload
  | LinkExistingAccountPayload
  | LinkedExistingAccountPayload
  | LinkedExistingAccountPayloadError
  | LoadAccountsPayload
  | LoadAssetsPayload
  | LoadDisplayCurrenciesPayload
  | LoadPaymentDetailPayload
  | LoadPaymentsPayload
  | PaymentDetailReceivedPayload
  | PaymentsReceivedPayload
  | SecretKeyReceivedPayload
  | SecretKeySeenPayload
  | SelectAccountPayload
  | SetAccountAsDefaultPayload
  | ValidateAccountNamePayload
  | ValidateSecretKeyPayload
  | ValidatedAccountNamePayload
  | ValidatedAccountNamePayloadError
  | ValidatedSecretKeyPayload
  | ValidatedSecretKeyPayloadError
  | {type: 'common:resetStore', payload: void}
