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
export const walletsReceived = 'wallets:walletsReceived'
export const walletsRefresh = 'wallets:walletsRefresh'

// Payload Types
type _AssetsReceivedPayload = $ReadOnly<{|assets: any|}>
type _LoadAssetsPayload = $ReadOnly<{|accountID: string|}>
type _WalletsReceivedPayload = $ReadOnly<{|wallets: Array<Types.Wallet>|}>
type _WalletsRefreshPayload = void

// Action Creators
/**
 * Refresh our list of assets for a given account
 */
export const createLoadAssets = (payload: _LoadAssetsPayload) => ({error: false, payload, type: loadAssets})
/**
 * Refresh our list of wallets
 */
export const createWalletsRefresh = (payload: _WalletsRefreshPayload) => ({error: false, payload, type: walletsRefresh})
/**
 * Update our store of assets data
 */
export const createAssetsReceived = (payload: _AssetsReceivedPayload) => ({error: false, payload, type: assetsReceived})
/**
 * Update our store of wallet data
 */
export const createWalletsReceived = (payload: _WalletsReceivedPayload) => ({error: false, payload, type: walletsReceived})

// Action Payloads
export type AssetsReceivedPayload = $Call<typeof createAssetsReceived, _AssetsReceivedPayload>
export type LoadAssetsPayload = $Call<typeof createLoadAssets, _LoadAssetsPayload>
export type WalletsReceivedPayload = $Call<typeof createWalletsReceived, _WalletsReceivedPayload>
export type WalletsRefreshPayload = $Call<typeof createWalletsRefresh, _WalletsRefreshPayload>

// All Actions
// prettier-ignore
export type Actions =
  | AssetsReceivedPayload
  | LoadAssetsPayload
  | WalletsReceivedPayload
  | WalletsRefreshPayload
  | {type: 'common:resetStore', payload: void}
