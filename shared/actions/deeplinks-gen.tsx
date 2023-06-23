// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import type HiddenString from '../util/hidden-string'

// Constants
export const resetStore = 'common:resetStore' // not a part of deeplinks but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'deeplinks:'
export const link = 'deeplinks:link'
export const saltpackFileOpen = 'deeplinks:saltpackFileOpen'

// Action Creators
/**
 * Fired after OS notifies Electron that an associated Saltpack file has been opened.
 *
 * Path is a string when coming from Electron open-file event and HiddenString when coming from state.config.startupFile.
 */
export const createSaltpackFileOpen = (payload: {readonly path: string | HiddenString}) => ({
  payload,
  type: saltpackFileOpen as typeof saltpackFileOpen,
})
export const createLink = (payload: {readonly link: string}) => ({payload, type: link as typeof link})

// Action Payloads
export type LinkPayload = ReturnType<typeof createLink>
export type SaltpackFileOpenPayload = ReturnType<typeof createSaltpackFileOpen>

// All Actions
// prettier-ignore
export type Actions =
  | LinkPayload
  | SaltpackFileOpenPayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
