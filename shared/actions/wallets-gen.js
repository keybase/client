// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from '../constants/types/wallets'

// Constants
export const resetStore = 'common:resetStore' // not a part of wallets but is handled by every reducer
export const walletsRefresh = 'wallets:walletsRefresh'

// Payload Types
type _WalletsRefreshPayload = void

// Action Creators
/**
 * Refresh out list of wallets
 */
export const createWalletsRefresh = (payload: _WalletsRefreshPayload) => ({error: false, payload, type: walletsRefresh})

// Action Payloads
export type WalletsRefreshPayload = $Call<typeof createWalletsRefresh, _WalletsRefreshPayload>

// All Actions
// prettier-ignore
export type Actions =
  | WalletsRefreshPayload
  | {type: 'common:resetStore', payload: void}
