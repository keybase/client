import * as RPCTypes from './rpc-gen'

export type State = Readonly<{
  cancelLabel?: string
  prompt: string
  retryLabel?: string
  showTyping?: RPCTypes.Feature
  submitLabel?: string
  type: RPCTypes.PassphraseType
  windowTitle: string
}>
