// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import HiddenString from '../util/hidden-string'

// Constants
export const resetStore = 'common:resetStore' // not a part of deeplinks but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'deeplinks:'
export const handleKeybaseLink = 'deeplinks:handleKeybaseLink'
export const link = 'deeplinks:link'
export const saltpackFileOpen = 'deeplinks:saltpackFileOpen'
export const setKeybaseLinkError = 'deeplinks:setKeybaseLinkError'

// Payload Types
type _HandleKeybaseLinkPayload = {readonly link: string}
type _LinkPayload = {readonly link: string}
type _SaltpackFileOpenPayload = {readonly path: string | HiddenString}
type _SetKeybaseLinkErrorPayload = {readonly error: string}

// Action Creators
/**
 * Fired after OS notifies Electron that an associated Saltpack file has been opened.
 *
 * Path is a string when coming from Electron open-file event and HiddenString when coming from state.config.startupFile.
 */
export const createSaltpackFileOpen = (payload: _SaltpackFileOpenPayload): SaltpackFileOpenPayload => ({
  payload,
  type: saltpackFileOpen,
})
/**
 * Set the error field for a Keybase URL scheme link.
 */
export const createSetKeybaseLinkError = (
  payload: _SetKeybaseLinkErrorPayload
): SetKeybaseLinkErrorPayload => ({payload, type: setKeybaseLinkError})
export const createHandleKeybaseLink = (payload: _HandleKeybaseLinkPayload): HandleKeybaseLinkPayload => ({
  payload,
  type: handleKeybaseLink,
})
export const createLink = (payload: _LinkPayload): LinkPayload => ({payload, type: link})

// Action Payloads
export type HandleKeybaseLinkPayload = {
  readonly payload: _HandleKeybaseLinkPayload
  readonly type: typeof handleKeybaseLink
}
export type LinkPayload = {readonly payload: _LinkPayload; readonly type: typeof link}
export type SaltpackFileOpenPayload = {
  readonly payload: _SaltpackFileOpenPayload
  readonly type: typeof saltpackFileOpen
}
export type SetKeybaseLinkErrorPayload = {
  readonly payload: _SetKeybaseLinkErrorPayload
  readonly type: typeof setKeybaseLinkError
}

// All Actions
// prettier-ignore
export type Actions =
  | HandleKeybaseLinkPayload
  | LinkPayload
  | SaltpackFileOpenPayload
  | SetKeybaseLinkErrorPayload
  | {type: 'common:resetStore', payload: {}}
