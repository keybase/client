// @flow strict
import * as I from 'immutable'
import * as RPCTypes from './rpc-gen'

export type EnabledFeatures = {[key: string]: RPCTypes.Feature}

type _PinentryState = {
  sessionID: number,
  showTyping: ?RPCTypes.Feature,
  type: RPCTypes.PassphraseType,
  prompt: string,
  windowTitle: string,
  submitted: boolean,
  submitLabel: ?string,
  cancelLabel: ?string,
  retryLabel: ?string,
}

export type PinentryState = I.RecordOf<_PinentryState>

export type _State = {
  sessionIDToPinentry: I.Map<number, PinentryState>,
}

export type State = I.RecordOf<_State>
