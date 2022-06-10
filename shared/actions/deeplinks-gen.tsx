// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import type HiddenString from '../util/hidden-string'

// Constants
export const resetStore = 'common:resetStore' // not a part of deeplinks but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'deeplinks:'
export const handleKeybaseLink = 'deeplinks:handleKeybaseLink'
export const link = 'deeplinks:link'
export const saltpackFileOpen = 'deeplinks:saltpackFileOpen'
export const setKeybaseLinkError = 'deeplinks:setKeybaseLinkError'

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
/**
 * Set the error field for a Keybase URL scheme link.
 */
export const createSetKeybaseLinkError = (payload: {readonly error: string}) => ({
  payload,
  type: setKeybaseLinkError as typeof setKeybaseLinkError,
})
export const createHandleKeybaseLink = (payload: {readonly link: string}) => ({
  payload,
  type: handleKeybaseLink as typeof handleKeybaseLink,
})
export const createLink = (payload: {readonly link: string}) => ({payload, type: link as typeof link})

// Action Payloads
export type HandleKeybaseLinkPayload = ReturnType<typeof createHandleKeybaseLink>
export type LinkPayload = ReturnType<typeof createLink>
export type SaltpackFileOpenPayload = ReturnType<typeof createSaltpackFileOpen>
export type SetKeybaseLinkErrorPayload = ReturnType<typeof createSetKeybaseLinkError>

// All Actions
// prettier-ignore
export type Actions =
  | HandleKeybaseLinkPayload
  | LinkPayload
  | SaltpackFileOpenPayload
  | SetKeybaseLinkErrorPayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
