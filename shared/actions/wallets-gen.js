// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from '../constants/types/wallets'

// Constants
export const resetStore = 'common:resetStore' // not a part of wallets but is handled by every reducer
export const accountsReceived = 'wallets:accountsReceived'
export const assetsReceived = 'wallets:assetsReceived'
export const loadAccounts = 'wallets:loadAccounts'
export const loadAssets = 'wallets:loadAssets'
export const loadPayments = 'wallets:loadPayments'
export const paymentsReceived = 'wallets:paymentsReceived'
export const selectAccount = 'wallets:selectAccount'

// Payload Types
type _AccountsReceivedPayload = $ReadOnly<{|accounts: Array<Types.Account>|}>
type _AssetsReceivedPayload = $ReadOnly<{|
  accountID: Types.AccountID,
  assets: Array<Types.Assets>,
|}>
type _LoadAccountsPayload = void
type _LoadAssetsPayload = $ReadOnly<{|accountID: Types.AccountID|}>
type _LoadPaymentsPayload = $ReadOnly<{|accountID: Types.AccountID|}>
type _PaymentsReceivedPayload = $ReadOnly<{|
  accountID: Types.AccountID,
  payments: Array<Types.Payment>,
|}>
type _SelectAccountPayload = $ReadOnly<{|accountID: Types.AccountID|}>

// Action Creators
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
 * Select an account
 */
export const createSelectAccount = (payload: _SelectAccountPayload) => ({error: false, payload, type: selectAccount})
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

// Action Payloads
export type AccountsReceivedPayload = $Call<typeof createAccountsReceived, _AccountsReceivedPayload>
export type AssetsReceivedPayload = $Call<typeof createAssetsReceived, _AssetsReceivedPayload>
export type LoadAccountsPayload = $Call<typeof createLoadAccounts, _LoadAccountsPayload>
export type LoadAssetsPayload = $Call<typeof createLoadAssets, _LoadAssetsPayload>
export type LoadPaymentsPayload = $Call<typeof createLoadPayments, _LoadPaymentsPayload>
export type PaymentsReceivedPayload = $Call<typeof createPaymentsReceived, _PaymentsReceivedPayload>
export type SelectAccountPayload = $Call<typeof createSelectAccount, _SelectAccountPayload>

// All Actions
// prettier-ignore
export type Actions =
  | AccountsReceivedPayload
  | AssetsReceivedPayload
  | LoadAccountsPayload
  | LoadAssetsPayload
  | LoadPaymentsPayload
  | PaymentsReceivedPayload
  | SelectAccountPayload
  | {type: 'common:resetStore', payload: void}
