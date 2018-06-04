// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from '../constants/types/wallets'

// Constants
export const resetStore = 'common:resetStore' // not a part of wallets but is handled by every reducer
export const assetsReceived = 'wallets:assetsReceived'
export const loadAssets = 'wallets:loadAssets'
export const loadEverything = 'wallets:loadEverything'
export const loadPayments = 'wallets:loadPayments'
export const loadWallets = 'wallets:loadWallets'
export const paymentsReceived = 'wallets:paymentsReceived'
export const walletsReceived = 'wallets:walletsReceived'

// Payload Types
type _AssetsReceivedPayload = $ReadOnly<{|
  accountID: string,
  assets: Array<Types.Assets>,
|}>
type _LoadAssetsPayload = $ReadOnly<{|accountID: string|}>
type _LoadEverythingPayload = void
type _LoadPaymentsPayload = $ReadOnly<{|accountID: string|}>
type _LoadWalletsPayload = void
type _PaymentsReceivedPayload = $ReadOnly<{|
  accountID: string,
  payments: Array<Types.Payment>,
|}>
type _WalletsReceivedPayload = $ReadOnly<{|wallets: Array<Types.Wallet>|}>

// Action Creators
/**
 * Debugging only -- load wallets/assets/payments for every account at once
 */
export const createLoadEverything = (payload: _LoadEverythingPayload) => ({error: false, payload, type: loadEverything})
/**
 * Refresh our list of assets for a given account
 */
export const createLoadAssets = (payload: _LoadAssetsPayload) => ({error: false, payload, type: loadAssets})
/**
 * Refresh our list of payments for a given account
 */
export const createLoadPayments = (payload: _LoadPaymentsPayload) => ({error: false, payload, type: loadPayments})
/**
 * Refresh our list of wallets
 */
export const createLoadWallets = (payload: _LoadWalletsPayload) => ({error: false, payload, type: loadWallets})
/**
 * Update our store of assets data
 */
export const createAssetsReceived = (payload: _AssetsReceivedPayload) => ({error: false, payload, type: assetsReceived})
/**
 * Update our store of payments data
 */
export const createPaymentsReceived = (payload: _PaymentsReceivedPayload) => ({error: false, payload, type: paymentsReceived})
/**
 * Update our store of wallet data
 */
export const createWalletsReceived = (payload: _WalletsReceivedPayload) => ({error: false, payload, type: walletsReceived})

// Action Payloads
export type AssetsReceivedPayload = $Call<typeof createAssetsReceived, _AssetsReceivedPayload>
export type LoadAssetsPayload = $Call<typeof createLoadAssets, _LoadAssetsPayload>
export type LoadEverythingPayload = $Call<typeof createLoadEverything, _LoadEverythingPayload>
export type LoadPaymentsPayload = $Call<typeof createLoadPayments, _LoadPaymentsPayload>
export type LoadWalletsPayload = $Call<typeof createLoadWallets, _LoadWalletsPayload>
export type PaymentsReceivedPayload = $Call<typeof createPaymentsReceived, _PaymentsReceivedPayload>
export type WalletsReceivedPayload = $Call<typeof createWalletsReceived, _WalletsReceivedPayload>

// All Actions
// prettier-ignore
export type Actions =
  | AssetsReceivedPayload
  | LoadAssetsPayload
  | LoadEverythingPayload
  | LoadPaymentsPayload
  | LoadWalletsPayload
  | PaymentsReceivedPayload
  | WalletsReceivedPayload
  | {type: 'common:resetStore', payload: void}
