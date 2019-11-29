// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
import * as RPCTypes from '../constants/types/rpc-gen'

// Constants
export const resetStore = 'common:resetStore' // not a part of pinentry but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'pinentry:'
export const close = 'pinentry:close'
export const newPinentry = 'pinentry:newPinentry'
export const onCancel = 'pinentry:onCancel'
export const onSubmit = 'pinentry:onSubmit'

// Payload Types
type _ClosePayload = void
type _NewPinentryPayload = {
  readonly showTyping: RPCTypes.Feature
  readonly type: RPCTypes.PassphraseType
  readonly prompt: string
  readonly windowTitle: string
  readonly submitLabel?: string
  readonly cancelLabel?: string
  readonly retryLabel?: string
}
type _OnCancelPayload = void
type _OnSubmitPayload = {readonly password: string}

// Action Creators
export const createClose = (payload: _ClosePayload): ClosePayload => ({payload, type: close})
export const createNewPinentry = (payload: _NewPinentryPayload): NewPinentryPayload => ({
  payload,
  type: newPinentry,
})
export const createOnCancel = (payload: _OnCancelPayload): OnCancelPayload => ({payload, type: onCancel})
export const createOnSubmit = (payload: _OnSubmitPayload): OnSubmitPayload => ({payload, type: onSubmit})

// Action Payloads
export type ClosePayload = {readonly payload: _ClosePayload; readonly type: typeof close}
export type NewPinentryPayload = {readonly payload: _NewPinentryPayload; readonly type: typeof newPinentry}
export type OnCancelPayload = {readonly payload: _OnCancelPayload; readonly type: typeof onCancel}
export type OnSubmitPayload = {readonly payload: _OnSubmitPayload; readonly type: typeof onSubmit}

// All Actions
// prettier-ignore
export type Actions =
  | ClosePayload
  | NewPinentryPayload
  | OnCancelPayload
  | OnSubmitPayload
  | {type: 'common:resetStore', payload: {}}
