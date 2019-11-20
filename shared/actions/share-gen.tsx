// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import * as Types from '../constants/types/share'

// Constants
export const resetStore = 'common:resetStore' // not a part of share but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'share:'
export const shareDataIntent = 'share:shareDataIntent'
export const shareText = 'share:shareText'

// Payload Types
type _ShareDataIntentPayload = {readonly localPath: Types.LocalPath}
type _ShareTextPayload = {readonly text: string}

// Action Creators
export const createShareDataIntent = (payload: _ShareDataIntentPayload): ShareDataIntentPayload => ({
  payload,
  type: shareDataIntent,
})
export const createShareText = (payload: _ShareTextPayload): ShareTextPayload => ({payload, type: shareText})

// Action Payloads
export type ShareDataIntentPayload = {
  readonly payload: _ShareDataIntentPayload
  readonly type: typeof shareDataIntent
}
export type ShareTextPayload = {readonly payload: _ShareTextPayload; readonly type: typeof shareText}

// All Actions
// prettier-ignore
export type Actions =
  | ShareDataIntentPayload
  | ShareTextPayload
  | {type: 'common:resetStore', payload: {}}
