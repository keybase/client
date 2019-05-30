import * as I from 'immutable'
import * as RPCTypes from './rpc-gen'

export type EnabledFeatures = {[K in string]: RPCTypes.Feature}

type _PinentryState = {
  sessionID: number
  showTyping: RPCTypes.Feature | null
  type: RPCTypes.PassphraseType
  prompt: string
  windowTitle: string
  submitted: boolean
  submitLabel: string | null
  cancelLabel: string | null
  retryLabel: string | null
}

export type PinentryState = I.RecordOf<_PinentryState>

// TODO clean this up, we only allow one of these at a time so we can remove the sessionID entirely
export type _State = {
  sessionIDToPinentry: I.Map<number, PinentryState>
}

export type State = I.RecordOf<_State>
