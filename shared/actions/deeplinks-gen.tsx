// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

// Constants
export const resetStore = 'common:resetStore' // not a part of deeplinks but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'deeplinks:'
export const handleFile = 'deeplinks:handleFile'
export const handleKeybaseLink = 'deeplinks:handleKeybaseLink'
export const link = 'deeplinks:link'
export const setKeybaseLinkError = 'deeplinks:setKeybaseLinkError'

// Payload Types
type _HandleFilePayload = {readonly path: string}
type _HandleKeybaseLinkPayload = {readonly link: string}
type _LinkPayload = {readonly link: string}
type _SetKeybaseLinkErrorPayload = {readonly error: string}

// Action Creators
/**
 * Set the error field for a Keybase URL scheme link.
 */
export const createSetKeybaseLinkError = (
  payload: _SetKeybaseLinkErrorPayload
): SetKeybaseLinkErrorPayload => ({payload, type: setKeybaseLinkError})
export const createHandleFile = (payload: _HandleFilePayload): HandleFilePayload => ({
  payload,
  type: handleFile,
})
export const createHandleKeybaseLink = (payload: _HandleKeybaseLinkPayload): HandleKeybaseLinkPayload => ({
  payload,
  type: handleKeybaseLink,
})
export const createLink = (payload: _LinkPayload): LinkPayload => ({payload, type: link})

// Action Payloads
export type HandleFilePayload = {readonly payload: _HandleFilePayload; readonly type: typeof handleFile}
export type HandleKeybaseLinkPayload = {
  readonly payload: _HandleKeybaseLinkPayload
  readonly type: typeof handleKeybaseLink
}
export type LinkPayload = {readonly payload: _LinkPayload; readonly type: typeof link}
export type SetKeybaseLinkErrorPayload = {
  readonly payload: _SetKeybaseLinkErrorPayload
  readonly type: typeof setKeybaseLinkError
}

// All Actions
// prettier-ignore
export type Actions =
  | HandleFilePayload
  | HandleKeybaseLinkPayload
  | LinkPayload
  | SetKeybaseLinkErrorPayload
  | {type: 'common:resetStore', payload: {}}
