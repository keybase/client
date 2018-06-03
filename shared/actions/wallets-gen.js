// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from '../constants/types/wallets'

// Constants
export const resetStore = 'common:resetStore' // not a part of wallets but is handled by every reducer
export const assetsReceived = 'wallets:assetsReceived'
export const loadAllAssets = 'wallets:loadAllAssets'
export const loadAssets = 'wallets:loadAssets'
export const loadPayments = 'wallets:loadPayments'
export const paymentsReceived = 'wallets:paymentsReceived'
export const walletsReceived = 'wallets:walletsReceived'
export const walletsRefresh = 'wallets:walletsRefresh'

// Payload Types
type _AssetsReceivedPayload = $ReadOnly<{|
  accountID: string,
  assets: any,
|}>
type _LoadAllAssetsPayload = void
type _LoadAssetsPayload = $ReadOnly<{|accountID: string|}>
type _LoadPaymentsPayload = $ReadOnly<{|accountID: string|}>
type _PaymentsReceivedPayload = $ReadOnly<{|
  accountID: string,
  payments: any,
|}>
type _WalletsReceivedPayload = $ReadOnly<{|wallets: Array<Types.Wallet>|}>
type _WalletsRefreshPayload = void

// Action Creators
/**
 * Debugging only -- load assets for every account at once
 */
export const createLoadAllAssets = (payload: _LoadAllAssetsPayload) => ({error: false, payload, type: loadAllAssets})
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
export const createWalletsRefresh = (payload: _WalletsRefreshPayload) => ({error: false, payload, type: walletsRefresh})
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
export type LoadAllAssetsPayload = $Call<typeof createLoadAllAssets, _LoadAllAssetsPayload>
export type LoadAssetsPayload = $Call<typeof createLoadAssets, _LoadAssetsPayload>
export type LoadPaymentsPayload = $Call<typeof createLoadPayments, _LoadPaymentsPayload>
export type PaymentsReceivedPayload = $Call<typeof createPaymentsReceived, _PaymentsReceivedPayload>
export type WalletsReceivedPayload = $Call<typeof createWalletsReceived, _WalletsReceivedPayload>
export type WalletsRefreshPayload = $Call<typeof createWalletsRefresh, _WalletsRefreshPayload>

// All Actions
// prettier-ignore
export type Actions =
  | AssetsReceivedPayload
  | LoadAllAssetsPayload
  | LoadAssetsPayload
  | LoadPaymentsPayload
  | PaymentsReceivedPayload
  | WalletsReceivedPayload
  | WalletsRefreshPayload
  | {type: 'common:resetStore', payload: void}
