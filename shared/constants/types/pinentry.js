// @flow
import * as RPCTypes from './flow-types'

export type EnabledFeatures = {[key: string]: RPCTypes.Feature}

type _PinentryState = {
  sessionID: number,
  features: RPCTypes.GUIEntryFeatures,
  type: RPCTypes.PassphraseType,
  prompt: string,
  windowTitle: string,
  submitted: boolean,
  submitLabel: ?string,
  cancelLabel: ?string,
  retryLabel: ?string,
}

export type PinentryState = I.RecordOf<_PinentryState>

type _State = {
  sessionIDToPinentry: I.Map<number, PinentryState>,
}

export type State = I.RecordOf<_State>
