import type * as RPCTypes from './rpc-gen'

export type State = {
  readonly cancelLabel?: string
  readonly prompt: string
  readonly retryLabel?: string
  readonly showTyping?: RPCTypes.Feature
  readonly submitLabel?: string
  readonly type: RPCTypes.PassphraseType
  readonly windowTitle: string
}
