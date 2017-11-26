// @flow
import * as RPCTypes from './flow-types'

export type EnabledFeatures = {[key: string]: RPCTypes.Feature}

export type PinentryState = {
  closed: boolean,
  sessionID: number,
  features: RPCTypes.GUIEntryFeatures,
  type: RPCTypes.PassphraseType,
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
