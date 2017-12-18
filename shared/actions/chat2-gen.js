// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/flow-types'
import * as More from '../constants/types/more'
import * as Types from '../constants/types/chat2'
import HiddenString from '../util/hidden-string'

// Constants
export const resetStore = 'common:resetStore' // not a part of chat2 but is handled by every reducer
export const inboxRefresh = 'chat2:inboxRefresh'
export const inboxUtrustedLoaded = 'chat2:inboxUtrustedLoaded'

// Action Creators
export const createInboxRefresh = () => ({error: false, payload: undefined, type: inboxRefresh})
export const createInboxUtrustedLoaded = (payload: {|+untrusted: Array<Types.ConversationMeta>|}) => ({error: false, payload, type: inboxUtrustedLoaded})

// Action Payloads
export type InboxRefreshPayload = More.ReturnType<typeof createInboxRefresh>
export type InboxUtrustedLoadedPayload = More.ReturnType<typeof createInboxUtrustedLoaded>

// All Actions
// prettier-ignore
export type Actions =
  | More.ReturnType<typeof createInboxRefresh>
  | More.ReturnType<typeof createInboxUtrustedLoaded>
  | {type: 'common:resetStore', payload: void}
