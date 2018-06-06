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
export const loadEverything = 'wallets:loadEverything'
export const loadPayments = 'wallets:loadPayments'
export const paymentsReceived = 'wallets:paymentsReceived'

// Payload Types
type _AccountsReceivedPayload = $ReadOnly<{|accounts: Array<Types.Account>|}>
type _AssetsReceivedPayload = $ReadOnly<{|
  accountID: string,
  assets: Array<Types.Assets>,
|}>
type _LoadAccountsPayload = void
type _LoadAssetsPayload = $ReadOnly<{|accountID: string|}>
type _LoadEverythingPayload = void
type _LoadPaymentsPayload = $ReadOnly<{|accountID: string|}>
type _PaymentsReceivedPayload = $ReadOnly<{|
  accountID: string,
  payments: Array<Types.Payment>,
|}>

// Action Creators
/**
 * Debugging only -- load accounts/assets/payments for every account at once
 */
export const createLoadEverything = (payload: _LoadEverythingPayload) => ({error: false, payload, type: loadEverything})
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
export type LoadEverythingPayload = $Call<typeof createLoadEverything, _LoadEverythingPayload>
export type LoadPaymentsPayload = $Call<typeof createLoadPayments, _LoadPaymentsPayload>
export type PaymentsReceivedPayload = $Call<typeof createPaymentsReceived, _PaymentsReceivedPayload>

// All Actions
// prettier-ignore
export type Actions =
  | AccountsReceivedPayload
  | AssetsReceivedPayload
  | LoadAccountsPayload
  | LoadAssetsPayload
  | LoadEverythingPayload
  | LoadPaymentsPayload
  | PaymentsReceivedPayload
  | {type: 'common:resetStore', payload: void}
