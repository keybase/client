// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from '../constants/types/wallets'

// Constants
export const resetStore = 'common:resetStore' // not a part of wallets but is handled by every reducer
export const walletsReceived = 'wallets:walletsReceived'
export const walletsRefresh = 'wallets:walletsRefresh'

// Payload Types
type _WalletsReceivedPayload = $ReadOnly<{|wallets: Array<Types.Wallet>|}>
type _WalletsRefreshPayload = void

// Action Creators
/**
 * Refresh our list of wallets
 */
export const createWalletsRefresh = (payload: _WalletsRefreshPayload) => ({error: false, payload, type: walletsRefresh})
/**
 * Update our store of wallet data
 */
export const createWalletsReceived = (payload: _WalletsReceivedPayload) => ({error: false, payload, type: walletsReceived})

// Action Payloads
export type WalletsReceivedPayload = $Call<typeof createWalletsReceived, _WalletsReceivedPayload>
export type WalletsRefreshPayload = $Call<typeof createWalletsRefresh, _WalletsRefreshPayload>

// All Actions
// prettier-ignore
export type Actions =
  | WalletsReceivedPayload
  | WalletsRefreshPayload
  | {type: 'common:resetStore', payload: void}
