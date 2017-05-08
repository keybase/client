// @flow
import type {Feature, GUIEntryFeatures, PassphraseType} from '../constants/types/flow-types'
import type {TypedAction} from '../constants/types/flux'

type sessionIDSpecificPayload = {
  sessionID: number,
}

type newPinentryPayload = {
  features: GUIEntryFeatures,
  type: PassphraseType,
  sessionID: number,
  prompt: string,
  windowTitle: string,
  submitLabel: ?string,
  cancelLabel: ?string,
  retryLabel: ?string,
}

// TODO: figure out what kind of errors we'll get here
type PinentryError = void

export const registerPinentryListener = 'pinentry:registerPinentryListener'
export type RegisterPinentryListenerAction = TypedAction<'pinentry:registerPinentryListener', any, any>

export const newPinentry = 'pinentry:newPinentry'
export type NewPinentryAction = TypedAction<'pinentry:newPinentry', newPinentryPayload, PinentryError>

export const onSubmit = 'pinentry:onSubmit'
export type OnSubmit = TypedAction<'pinentry:onSubmit', sessionIDSpecificPayload, PinentryError>
export const onCancel = 'pinentry:onCancel'
export type OnCancel = TypedAction<'pinentry:onCancel', sessionIDSpecificPayload, PinentryError>

export type Actions = NewPinentryAction | RegisterPinentryListenerAction | OnSubmit | OnCancel

export type EnabledFeatures = {[key: string]: Feature}

export type PinentryState = {
  closed: boolean,
  sessionID: number,
  features: GUIEntryFeatures,
  type: PassphraseType,
  prompt: string,
  windowTitle: string,
  canceled: boolean,
  submitted: boolean,
  submitLabel: ?string,
  cancelLabel: ?string,
  retryLabel: ?string,
}

export type State = {
  started: boolean,
  pinentryStates: {
    [key: string]: PinentryState,
  },
}
