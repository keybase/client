/* @flow */

import type {GUIEntryFeatures} from '../constants/types/flow-types'
import type {TypedAction} from '../constants/types/flux'

export const registerPinentryListener = 'pinentry:registerPinentryListener'
export type RegisterPinentryListenerAction = TypedAction<'pinentry:registerPinentryListener', any, any>

export const newPinentry = 'pinentry:newPinentry'
export type NewPinentryAction = TypedAction<'pinentry:newPinentry', newPinentryPayload, PinentryError>

export const onSubmit = 'pinentry:onSubmit'
export type OnSubmit = TypedAction<'pinentry:onSubmit', sessionIDSpecificPayload, PinentryError>
export const onCancel = 'pinentry:onCancel'
export type OnCancel = TypedAction<'pinentry:onCancel', sessionIDSpecificPayload, PinentryError>

export type PinentryActions = NewPinentryAction | RegisterPinentryListenerAction | OnSubmit | OnCancel

type sessionIDSpecificPayload = {
  sessionID: number
}

type newPinentryPayload = {
  features: GUIEntryFeatures,
  sessionID: number,
  prompt: string,
  windowTitle: string,
  submitLabel: ?string,
  cancelLabel: ?string,
  retryLabel: ?string
}

// TODO: figure out what kind of errors we'll get here
type PinentryError = void
