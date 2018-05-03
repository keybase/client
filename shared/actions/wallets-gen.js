// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as More from '../constants/types/more'
import * as Types from '../constants/types/wallets'

// Constants
export const resetStore = 'common:resetStore' // not a part of wallets but is handled by every reducer
export const walletsRefresh = 'wallets:walletsRefresh'

// Action Creators
/**
 * Refresh out list of wallets
 */
export const createWalletsRefresh = () => ({error: false, payload: undefined, type: walletsRefresh})

// Action Payloads
export type WalletsRefreshPayload = More.ReturnType<typeof createWalletsRefresh>

// All Actions
// prettier-ignore
export type Actions =
  | More.ReturnType<typeof createWalletsRefresh>
  | {type: 'common:resetStore', payload: void}
