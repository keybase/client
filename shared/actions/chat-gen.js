// @flow
/* eslint-disable */
import * as Constants from '../constants/chat'

type _ExtractReturn<B, F: (...args: any[]) => B> = B
export type ReturnType<F> = _ExtractReturn<*, F>
export type PayloadType<F> = $PropertyType<ReturnType<F>, 'payload'>

// Constants
export const updateBadging = 'chat:updateBadging'

// Action Creators
export const createUpdateBadging = (payload: {|conversationIDKey: Constants.ConversationIDKey|}) => ({
  type: updateBadging,
  payload,
})

// All Actions
export type Actions = ReturnType<typeof createUpdateBadging>
