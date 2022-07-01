// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
import type * as RPCTypes from '../constants/types/rpc-gen'

// Constants
export const resetStore = 'common:resetStore' // not a part of pinentry but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'pinentry:'
export const close = 'pinentry:close'
export const newPinentry = 'pinentry:newPinentry'
export const onCancel = 'pinentry:onCancel'
export const onSubmit = 'pinentry:onSubmit'

// Action Creators
export const createClose = (payload?: undefined) => ({payload, type: close as typeof close})
export const createNewPinentry = (payload: {
  readonly showTyping: RPCTypes.Feature
  readonly type: RPCTypes.PassphraseType
  readonly prompt: string
  readonly windowTitle: string
  readonly submitLabel?: string
  readonly cancelLabel?: string
  readonly retryLabel?: string
}) => ({payload, type: newPinentry as typeof newPinentry})
export const createOnCancel = (payload?: undefined) => ({payload, type: onCancel as typeof onCancel})
export const createOnSubmit = (payload: {readonly password: string}) => ({
  payload,
  type: onSubmit as typeof onSubmit,
})

// Action Payloads
export type ClosePayload = ReturnType<typeof createClose>
export type NewPinentryPayload = ReturnType<typeof createNewPinentry>
export type OnCancelPayload = ReturnType<typeof createOnCancel>
export type OnSubmitPayload = ReturnType<typeof createOnSubmit>

// All Actions
// prettier-ignore
export type Actions =
  | ClosePayload
  | NewPinentryPayload
  | OnCancelPayload
  | OnSubmitPayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
