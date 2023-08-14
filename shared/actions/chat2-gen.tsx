// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import type * as RPCChatTypes from '../constants/types/rpc-chat-gen'
import type * as Types from '../constants/types/chat2'

// Constants
export const resetStore = 'common:resetStore' // not a part of chat2 but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'chat2:'
export const dismissJourneycard = 'chat2:dismissJourneycard'
export const fetchUserEmoji = 'chat2:fetchUserEmoji'

// Action Creators
/**
 * Dismiss a journeycard
 */
export const createDismissJourneycard = (payload: {
  readonly conversationIDKey: Types.ConversationIDKey
  readonly cardType: RPCChatTypes.JourneycardType
  readonly ordinal: Types.Ordinal
}) => ({payload, type: dismissJourneycard as typeof dismissJourneycard})
/**
 * Refresh user emoji and put it in store for picker
 */
export const createFetchUserEmoji = (
  payload: {readonly conversationIDKey?: Types.ConversationIDKey; readonly onlyInTeam?: boolean} = {}
) => ({payload, type: fetchUserEmoji as typeof fetchUserEmoji})

// Action Payloads
export type DismissJourneycardPayload = ReturnType<typeof createDismissJourneycard>
export type FetchUserEmojiPayload = ReturnType<typeof createFetchUserEmoji>

// All Actions
// prettier-ignore
export type Actions =
  | DismissJourneycardPayload
  | FetchUserEmojiPayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
